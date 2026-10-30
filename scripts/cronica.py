"""Busca partidos terminados del Madrid y el Barça, escribe la crónica con Gemini y la publica en Facebook.

Uso:
  python scripts/cronica.py           revisa partidos de las últimas 30 horas y publica los nuevos
  python scripts/cronica.py --prueba  genera imagen y texto del último partido sin publicar
  python scripts/cronica.py --ultimo  publica la crónica del último partido aunque sea de hace días
"""

import json
from email.utils import parsedate_to_datetime
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import fotos
from comun import PUBLIC, RAIZ, cargar_env, env, gemini, http
import xml.etree.ElementTree as ET

from guion import FEEDS, MODELOS_TEXTO

# IDs de football-data.org: Real Madrid y FC Barcelona
EQUIPOS = {86: "Real Madrid", 81: "FC Barcelona"}
PUBLICADAS = RAIZ / "data" / "cronicas_publicadas.json"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]

INSTRUCCIONES = """Eres redactor de "Leo Rugido | Fútbol Europeo", una página de Facebook de noticias de fútbol en español.
Escribe la crónica de un partido que acaba de terminar.

Reglas:
1. Habla SOLO de este partido. Usa SOLO los hechos de los DATOS (resultado, descanso, competición, estadio, árbitro
   y las noticias de prensa sobre el partido: goleadores, jugadas o protagonistas que mencionen). No menciones otras noticias.
   No inventes goleadores, minutos, jugadas, lesiones ni declaraciones. Si no hay datos de goleadores, no los nombres.
   Tampoco saques conclusiones que no estén en los datos (rachas, posición en la tabla, "lucha por el título", "gran momento").
2. Formato:
   - "titular": frase corta y con gancho (máx 70 caracteres), sin emojis.
   - "texto": 3-4 párrafos cortos separados por una línea en blanco. Empieza con un emoji y el resultado en mayúsculas
     (ej: "⚽ FINAL | Barça 3-1 Alavés"). Cuenta cómo fue el partido: resultado, cómo iba al descanso y, si las
     noticias lo dicen, quién marcó y los momentos clave. No pongas enlaces en el texto.
   - Termina con una pregunta para que la gente comente y 4-5 hashtags.
3. Tono: periodístico pero cercano y con un toque de humor; al final, una línea de Merenguito o Culerín (los hinchas del canal)
   reaccionando, por ejemplo: "Merenguito: ..." o "Culerín: ...".
4. Nada ofensivo.

Responde SOLO con JSON: {"titular": "...", "texto": "..."}"""


def cargar_publicadas() -> list[int]:
    return json.loads(PUBLICADAS.read_text()) if PUBLICADAS.exists() else []


def partidos_terminados(horas: int) -> list[dict]:
    desde = (datetime.now(timezone.utc) - timedelta(hours=horas)).date().isoformat()
    hasta = datetime.now(timezone.utc).date().isoformat()
    vistos, partidos = set(), []
    for equipo in EQUIPOS:
        datos = http(
            f"https://api.football-data.org/v4/teams/{equipo}/matches?status=FINISHED&dateFrom={desde}&dateTo={hasta}",
            headers={"X-Auth-Token": env("FOOTBALL_DATA_KEY")},
        )
        for m in datos.get("matches", []):
            if m["id"] not in vistos:
                vistos.add(m["id"])
                partidos.append(m)
    return partidos


def nombre(equipo: dict) -> str:
    return equipo.get("shortName") or equipo["name"]


def estadio_de(equipo_id: int) -> str | None:
    datos = http(
        f"https://api.football-data.org/v4/teams/{equipo_id}",
        headers={"X-Auth-Token": env("FOOTBALL_DATA_KEY")},
    )
    return datos.get("venue")


# Feeds extra de los dos clubes, donde salen las crónicas de sus partidos
FEEDS_CLUBES = [
    "https://e00-marca.uecdn.es/rss/futbol/real-madrid.xml",
    "https://e00-marca.uecdn.es/rss/futbol/barcelona.xml",
    "https://as.com/rss/futbol/real_madrid.xml",
    "https://as.com/rss/futbol/barcelona.xml",
]


def alias(equipo: dict) -> set[str]:
    """Formas en que la prensa nombra a un equipo (Barça, Barcelona, FC Barcelona...)."""
    nombres = {equipo["name"], equipo.get("shortName") or "", equipo.get("tla") or ""}
    limpio = set()
    for n in nombres:
        for palabra in ("FC ", " FC", "CF ", " CF", "Club ", "Deportivo "):
            n = n.replace(palabra, "")
        if len(n) > 2:
            limpio.add(n.lower())
    if "barcelona" in limpio or "barça" in limpio:
        limpio |= {"barça", "barcelona", "barca"}
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
    raise SystemExit("Ningún modelo de Gemini respondió")


def imagen(m: dict, titular: str) -> object:
    estadio = m.get("venue") or estadio_de(m["homeTeam"]["id"])
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
    salida = RAIZ / "out" / "cronica.png"
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
