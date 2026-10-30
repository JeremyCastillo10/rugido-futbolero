"""Busca partidos terminados de los grandes de Europa, escribe la crónica con Gemini y la publica en Facebook.

Uso:
  python scripts/cronica.py           revisa partidos de las últimas 30 horas y publica los nuevos
  python scripts/cronica.py --prueba  genera imagen y texto del último partido sin publicar
  python scripts/cronica.py --ultimo  publica la crónica del último partido aunque sea de hace días
"""

import json
import os
from email.utils import parsedate_to_datetime
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import fotos
from comun import PUBLIC, RAIZ, cargar_env, env, gemini, http
import xml.etree.ElementTree as ET

from guion import FEEDS, MODELOS_TEXTO, groq_texto

# IDs de football-data.org de los clubes que cubre la página, con los nombres que usa la prensa
EQUIPOS = {
    86: {"real madrid", "madrid", "merengue"},
    81: {"barcelona", "barça", "barca", "azulgrana", "culé"},
    78: {"atlético", "atletico", "atleti", "colchonero"},
    64: {"liverpool"},
    65: {"manchester city", "man city", "city"},
    66: {"manchester united", "man united", "united"},
    5: {"bayern"},
    524: {"psg", "paris saint-germain", "parís saint-germain", "paris sg"},
    109: {"juventus", "juve"},
    113: {"napoli", "nápoles"},
    100: {"roma"},
    7397: {"como 1907", "como"},
}
COMPETICIONES = "PD,PL,SA,BL1,FL1,CL"
PUBLICADAS = RAIZ / "data" / "cronicas_publicadas.json"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]

INSTRUCCIONES = """Eres redactor de "Leo Rugido - Fútbol Europeo", una página de Facebook de fútbol en español
con un estilo de ÚLTIMA HORA: emocionante, apasionado y muy directo, como los posts virales de páginas de fútbol.
Escribe la crónica de un partido que acaba de terminar.

Reglas de contenido:
1. Habla SOLO de este partido. Usa SOLO los hechos de los DATOS: resultado, descanso, competición, estadio, árbitro,
   la tabla de la liga y las noticias de prensa sobre el partido (goleadores, asistencias, cambios clave, protagonistas).
   No menciones otras noticias. No inventes goleadores, minutos, jugadas, lesiones, cifras ni declaraciones.
2. Puedes hablar de la tabla (posición, puntos, distancia al líder) SOLO con los números de los DATOS.

Estilo:
3. "titular": empieza con "¡¡ÚLTIMA HORA:" y termina con "!!", en MAYÚSCULAS, con el hecho principal
   (máx 80 caracteres). Ejemplo de forma: "¡¡ÚLTIMA HORA: EL BAYERN APLASTÓ AL DORTMUND!!".
4. "texto": empieza repitiendo el titular. Luego 3-4 párrafos cortos separados por una línea en blanco:
   - Contexto emocional del partido (dónde, contra quién, qué estaba en juego según los datos).
   - Cómo se ganó: goleadores y protagonistas si las noticias los nombran.
   - Qué significa el resultado en la tabla (con los números de los DATOS) o en la competición.
   Resalta en MAYÚSCULAS y entre ¡¡ !! los datos más fuertes (el resultado, un doblete, los puntos).
   Cierra con una frase final en mayúsculas celebrando o lamentando el resultado.
   Después, en una línea aparte, una reacción corta de Merenguito (hincha del Madrid) o Culerín (hincha del Barça)
   si el partido es de su equipo o de un rival directo; si no, omite la reacción.
   Termina con 3-5 hashtags. No pongas enlaces.
5. Nada ofensivo hacia jugadores, árbitros ni aficiones.

Responde SOLO con JSON: {"titular": "...", "texto": "..."}"""


def cargar_publicadas() -> list[int]:
    return json.loads(PUBLICADAS.read_text()) if PUBLICADAS.exists() else []


def _partidos_football_data(horas: int) -> list[dict]:
    """Una sola consulta para todas las ligas (el plan gratis permite 10 por minuto)."""
    desde = (datetime.now(timezone.utc) - timedelta(hours=horas)).date().isoformat()
    hasta = datetime.now(timezone.utc).date().isoformat()
    datos = http(
        "https://api.football-data.org/v4/matches"
        f"?competitions={COMPETICIONES}&status=FINISHED&dateFrom={desde}&dateTo={hasta}",
        headers={"X-Auth-Token": env("FOOTBALL_DATA_KEY")},
    )
    return [
        m for m in datos.get("matches", [])
        if m["homeTeam"]["id"] in EQUIPOS or m["awayTeam"]["id"] in EQUIPOS
    ]


# Respaldo: el endpoint público de ESPN (sin clave) para partidos que football-data no tenga
ESPN_LIGAS = ["fra.1", "esp.1", "eng.1", "ger.1", "ita.1", "uefa.champions"]


def _de_interes(equipo: dict) -> bool:
    return any(alias(equipo) & grupo for grupo in EQUIPOS.values())


def _partidos_espn(horas: int) -> list[dict]:
    """Partidos terminados de ESPN, con la misma forma que los de football-data."""
    ahora = datetime.now(timezone.utc)
    desde = (ahora - timedelta(hours=horas)).date()
    dias = [(desde + timedelta(days=i)).strftime("%Y%m%d") for i in range((ahora.date() - desde).days + 1)]
    salida, vistos = [], set()
    for liga, dia in [(l, d) for l in ESPN_LIGAS for d in dias]:
        try:
            datos = http(f"https://site.api.espn.com/apis/site/v2/sports/soccer/{liga}/scoreboard?dates={dia}")
        except Exception as e:
            # Los avisos van a stderr: lo que sale por stdout se guarda en GITHUB_OUTPUT
            print("espn", liga, dia, e, file=sys.stderr)
            continue
        nombre_liga = (datos.get("leagues") or [{}])[0].get("name", liga)
        for ev in datos.get("events", []):
            if ev["id"] in vistos:
                continue
            vistos.add(ev["id"])
            comp = ev["competitions"][0]
            if not comp["status"]["type"].get("completed"):
                continue
            casa = next(c for c in comp["competitors"] if c["homeAway"] == "home")
            fuera = next(c for c in comp["competitors"] if c["homeAway"] == "away")
            equipo_casa = {"id": None, "name": casa["team"]["displayName"], "shortName": casa["team"].get("shortDisplayName")}
            equipo_fuera = {"id": None, "name": fuera["team"]["displayName"], "shortName": fuera["team"].get("shortDisplayName")}
            if not (_de_interes(equipo_casa) or _de_interes(equipo_fuera)):
                continue
            salida.append({
                "id": int(ev["id"]),
                "utcDate": comp["date"],
                "competition": {"code": liga, "name": nombre_liga},
                "homeTeam": equipo_casa,
                "awayTeam": equipo_fuera,
                "score": {"fullTime": {"home": int(casa["score"]), "away": int(fuera["score"])}, "halfTime": {}},
                "venue": (comp.get("venue") or {}).get("fullName"),
                "referees": [],
                "matchday": None,
                "stage": None,
                "fuente": "espn",
            })
    return salida


def partidos_terminados(horas: int) -> list[dict]:
    """football-data primero; ESPN solo para los partidos que football-data no tenga."""
    partidos = _partidos_football_data(horas)
    for p in _partidos_espn(horas):
        repetido = any(
            p["utcDate"][:10] == f["utcDate"][:10]
            and (alias(p["homeTeam"]) & alias(f["homeTeam"]) or alias(p["awayTeam"]) & alias(f["awayTeam"]))
            for f in partidos
        )
        if not repetido:
            partidos.append(p)
    return partidos


def tabla(m: dict) -> str:
    """Posición, puntos y distancia al líder de los dos equipos (solo partidos de liga)."""
    codigo = m["competition"].get("code")
    if codigo == "CL" or m.get("fuente") == "espn":
        return ""
    datos = http(
        f"https://api.football-data.org/v4/competitions/{codigo}/standings",
        headers={"X-Auth-Token": env("FOOTBALL_DATA_KEY")},
    )
    total = next((t["table"] for t in datos.get("standings", []) if t["type"] == "TOTAL"), [])
    if not total:
        return ""
    lider = total[0]
    lineas = [f"Líder: {nombre(lider['team'])} con {lider['points']} puntos"]
    for fila in total:
        if fila["team"]["id"] in (m["homeTeam"]["id"], m["awayTeam"]["id"]):
            lineas.append(
                f"{nombre(fila['team'])}: {fila['position']}º, {fila['points']} puntos, "
                f"a {lider['points'] - fila['points']} del líder ({fila['won']}G {fila['draw']}E {fila['lost']}P)"
            )
    return "Tabla después del partido:\n" + "\n".join(lineas)


def nombre(equipo: dict) -> str:
    return equipo.get("shortName") or equipo["name"]


def estadio_de(equipo_id: int) -> str | None:
    datos = http(
        f"https://api.football-data.org/v4/teams/{equipo_id}",
        headers={"X-Auth-Token": env("FOOTBALL_DATA_KEY")},
    )
    return datos.get("venue")


# Feeds extra donde salen las crónicas de los partidos (si alguno falla se ignora)
FEEDS_CLUBES = [
    "https://e00-marca.uecdn.es/rss/futbol/real-madrid.xml",
    "https://e00-marca.uecdn.es/rss/futbol/barcelona.xml",
    "https://e00-marca.uecdn.es/rss/futbol/atletico.xml",
    "https://e00-marca.uecdn.es/rss/futbol/futbol-internacional.xml",
    "https://e00-marca.uecdn.es/rss/futbol/champions-league.xml",
    "https://as.com/rss/futbol/real_madrid.xml",
    "https://as.com/rss/futbol/barcelona.xml",
    "https://as.com/rss/futbol/internacional.xml",
    "https://www.mundodeportivo.com/rss/futbol/futbol-internacional.xml",
]


def alias(equipo: dict) -> set[str]:
    """Formas en que la prensa nombra a un equipo."""
    if equipo["id"] in EQUIPOS:
        return EQUIPOS[equipo["id"]]
    limpio = set()
    for n in (equipo["name"], equipo.get("shortName") or ""):
        for palabra in ("FC ", " FC", "CF ", " CF", "Club ", "Deportivo ", "AS ", "SSC ", "AFC ", " 1907"):
            n = n.replace(palabra, "")
        if len(n) > 3:
            limpio.add(n.strip().lower())
    return limpio


def noticias_partido(m: dict) -> list[dict]:
    """Crónicas de prensa de este partido: nombran a los dos equipos, salen en las 48 h siguientes
    y hablan del resultado (traen el marcador o palabras de crónica)."""
    local, visita = alias(m["homeTeam"]), alias(m["awayTeam"])
    ft = m["score"]["fullTime"]
    marcadores = {f"{ft['home']}-{ft['away']}", f"{ft['away']}-{ft['home']}",
                  f"{ft['home']} - {ft['away']}", f"{ft['away']} - {ft['home']}"}
    palabras = ("crónica", "resumen", "gol", "golazo", "remontada", "victoria", "derrota", "empate", "report", "win", "beat")
    inicio = datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00"))
    vistos, encontradas = set(), []
    for feed in FEEDS_CLUBES + FEEDS:
        try:
            req = urllib.request.Request(feed, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                raiz = ET.fromstring(r.read())
        except Exception as e:
            print("feed", feed, e)
            continue
        for item in raiz.iter("item"):
            titulo = (item.findtext("title") or "").strip()
            desc = fotos.limpiar(item.findtext("description") or "")[:300]
            enlace = (item.findtext("link") or "").strip()
            texto = f"{titulo} {desc}".lower()
            if not enlace or enlace in vistos:
                continue
            if not (any(a in texto for a in local) and any(a in texto for a in visita)):
                continue
            try:
                publicado = parsedate_to_datetime(item.findtext("pubDate") or "")
            except (TypeError, ValueError):
                continue
            if not inicio <= publicado <= inicio + timedelta(hours=48):
                continue
            con_marcador = any(s in texto for s in marcadores)
            if not con_marcador and not any(p in texto for p in palabras):
                continue
            vistos.add(enlace)
            encontradas.append({"titulo": titulo, "desc": desc, "enlace": enlace, "marcador": con_marcador})
    # Primero las que traen el marcador (son las crónicas de verdad) y, entre ellas, los medios en español
    ingles = ("bbc.", "espn.com/", "skysports.")
    encontradas.sort(key=lambda n: (not n["marcador"], any(d in n["enlace"] for d in ingles)))
    return encontradas[:6]


def escribir(m: dict, noticias: list[dict]) -> dict:
    local, visita = nombre(m["homeTeam"]), nombre(m["awayTeam"])
    ft, ht = m["score"]["fullTime"], m["score"].get("halfTime") or {}
    relacionados = [f"- {n['titulo']}. {n['desc']}" for n in noticias]
    arbitro = ", ".join(r["name"] for r in m.get("referees", []) if r.get("type") == "REFEREE")
    datos = (
        f"Competición: {m['competition']['name']} (jornada {m.get('matchday')}, fase {m.get('stage')})\n"
        f"Fecha UTC: {m['utcDate']}\n"
        f"Resultado final: {local} {ft['home']}-{ft['away']} {visita}\n"
        f"Descanso: {ht.get('home')}-{ht.get('away')}\n"
        f"Estadio: {m.get('venue') or 'desconocido'}\n"
        f"Árbitro: {arbitro or 'desconocido'}\n\n"
        f"{tabla(m)}\n\n"
        "Noticias de prensa sobre ESTE partido:\n" + ("\n".join(relacionados) or "(ninguna todavía)")
    )
    print(datos, "\n")
    cuerpo = {
        "systemInstruction": {"parts": [{"text": INSTRUCCIONES}]},
        "contents": [{"parts": [{"text": f"DATOS:\n{datos}"}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.8},
    }
    for modelo in MODELOS_TEXTO:
        try:
            r = gemini(modelo, cuerpo, reintentos=2)
            return json.loads(r["candidates"][0]["content"]["parts"][0]["text"])
        except Exception as e:
            print(f"{modelo} no disponible ({e})")
    # Respaldo: Groq, si hay clave
    if os.environ.get("GROQ_API_KEY"):
        print("Gemini no respondió; escribiendo la crónica con Groq")
        return json.loads(groq_texto(INSTRUCCIONES, f"DATOS:\n{datos}"))
    raise SystemExit("Ningún modelo de texto respondió (Gemini ni Groq)")


def imagen(m: dict, titular: str) -> object:
    estadio = m.get("venue") or (estadio_de(m["homeTeam"]["id"]) if m["homeTeam"]["id"] else None)
    fecha = datetime.fromisoformat(m["utcDate"].replace("Z", "+00:00"))
    props = {
        "local": nombre(m["homeTeam"]),
        "visitante": nombre(m["awayTeam"]),
        "golesLocal": m["score"]["fullTime"]["home"],
        "golesVisitante": m["score"]["fullTime"]["away"],
        "competicion": m["competition"]["name"],
        "fecha": f"{fecha.day} de {MESES[fecha.month - 1]}",
        "titular": titular,
        "estadio": estadio,
    }
    # Foto libre del estadio (Wikimedia) con su crédito
    if estadio:
        foto = fotos.foto_libre(estadio)
        if foto:
            (PUBLIC / "fotos").mkdir(exist_ok=True)
            req = urllib.request.Request(foto["url"], headers=fotos.UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                (PUBLIC / "fotos" / "cronica.jpg").write_bytes(r.read())
            props |= {"foto": "fotos/cronica.jpg", "credito": foto["credito"]}
    (PUBLIC / "cronica.json").write_text(json.dumps(props, ensure_ascii=False, indent=2), encoding="utf-8")
    salida = RAIZ / "out" / f"cronica-{m['id']}.png"
    salida.parent.mkdir(exist_ok=True)
    subprocess.run(
        ["npx", "remotion", "still", "Cronica", str(salida), "--log=error"],
        cwd=RAIZ,
        check=True,
        shell=sys.platform == "win32",
    )
    return salida


def main() -> None:
    cargar_env()
    prueba = "--prueba" in sys.argv
    ultimo = "--ultimo" in sys.argv
    publicadas = cargar_publicadas()
    partidos = partidos_terminados(24 * 10 if prueba or ultimo else 30)
    if prueba or ultimo:
        partidos = sorted(partidos, key=lambda m: m["utcDate"])[-1:]
    else:
        partidos = [m for m in partidos if m["id"] not in publicadas]
    if not partidos:
        print("No hay partidos nuevos terminados")
        return

    for m in partidos:
        print(f"== {nombre(m['homeTeam'])} vs {nombre(m['awayTeam'])} ==")
        noticias = noticias_partido(m)
        print(f"{len(noticias)} noticias del partido encontradas")
        cronica = escribir(m, noticias)
        enlace = noticias[0]["enlace"] if noticias else None
        png = None if enlace else imagen(m, cronica["titular"])
        (RAIZ / "out" / "cronica.txt").write_text(cronica["texto"], encoding="utf-8")
        print("\n" + cronica["titular"] + "\n\n" + cronica["texto"])
        if prueba:
            destino = f"enlace con foto del medio: {enlace}" if enlace else f"imagen propia: {png}"
            print(f"\n(prueba: no se publica) {destino}")
            continue
        from facebook import publicar_enlace, publicar_foto

        if enlace:
            publicar_enlace(enlace, cronica["texto"])
        else:
            publicar_foto(png, cronica["texto"])
        publicadas.append(m["id"])
        PUBLICADAS.parent.mkdir(exist_ok=True)
        PUBLICADAS.write_text(json.dumps(publicadas))


if __name__ == "__main__":
    main()
