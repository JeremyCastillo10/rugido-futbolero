"""Busca partidos terminados del Madrid y el Barça, escribe la crónica con Gemini y la publica en Facebook.

Uso:
  python scripts/cronica.py           revisa partidos de las últimas 30 horas y publica los nuevos
  python scripts/cronica.py --prueba  genera imagen y texto del último partido sin publicar
"""

import json
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import fotos
from comun import PUBLIC, RAIZ, cargar_env, env, gemini, http
from guion import MODELOS_TEXTO, titulares

# IDs de football-data.org: Real Madrid y FC Barcelona
EQUIPOS = {86: "Real Madrid", 81: "FC Barcelona"}
PUBLICADAS = RAIZ / "data" / "cronicas_publicadas.json"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]

INSTRUCCIONES = """Eres redactor de "Leo Rugido | Fútbol Europeo", una página de Facebook de noticias de fútbol en español.
Escribe la crónica de un partido que acaba de terminar.

Reglas:
1. Usa SOLO los hechos de los DATOS (resultado, descanso, competición, estadio, árbitro, titulares de prensa).
   No inventes goleadores, minutos, jugadas, lesiones ni declaraciones. Si no hay datos de goleadores, no los nombres.
   Tampoco saques conclusiones que no estén en los datos (rachas, posición en la tabla, "lucha por el título", "gran momento").
2. Formato:
   - "titular": frase corta y con gancho (máx 70 caracteres), sin emojis.
   - "texto": 3-4 párrafos cortos separados por una línea en blanco. Empieza con un emoji y el resultado en mayúsculas
     (ej: "⚽ FINAL | Barça 3-1 Alavés"). Cuenta qué significa el resultado, el contexto (competición, rachas o titulares
     si los hay) y qué viene después si aparece en los datos.
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


def escribir(m: dict) -> dict:
    local, visita = nombre(m["homeTeam"]), nombre(m["awayTeam"])
    ft, ht = m["score"]["fullTime"], m["score"].get("halfTime") or {}
    claves = [local.lower(), visita.lower(), m["homeTeam"]["name"].lower(), m["awayTeam"]["name"].lower()]
    relacionados = [t for t in titulares() if any(k in t.lower() for k in claves)][:12]
    arbitro = ", ".join(r["name"] for r in m.get("referees", []) if r.get("type") == "REFEREE")
    datos = (
        f"Competición: {m['competition']['name']} (jornada {m.get('matchday')}, fase {m.get('stage')})\n"
        f"Fecha UTC: {m['utcDate']}\n"
        f"Resultado final: {local} {ft['home']}-{ft['away']} {visita}\n"
        f"Descanso: {ht.get('home')}-{ht.get('away')}\n"
        f"Estadio: {m.get('venue') or 'desconocido'}\n"
        f"Árbitro: {arbitro or 'desconocido'}\n\n"
        "Titulares de prensa relacionados:\n" + ("\n".join(relacionados) or "(ninguno todavía)")
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
    publicadas = cargar_publicadas()
    partidos = partidos_terminados(30 if not prueba else 24 * 10)
    if prueba:
        partidos = sorted(partidos, key=lambda m: m["utcDate"])[-1:]
    else:
        partidos = [m for m in partidos if m["id"] not in publicadas]
    if not partidos:
        print("No hay partidos nuevos terminados")
        return

    for m in partidos:
        print(f"== {nombre(m['homeTeam'])} vs {nombre(m['awayTeam'])} ==")
        cronica = escribir(m)
        png = imagen(m, cronica["titular"])
        (RAIZ / "out" / "cronica.txt").write_text(cronica["texto"], encoding="utf-8")
        print("\n" + cronica["titular"] + "\n\n" + cronica["texto"])
        if prueba:
            print(f"\n(prueba: no se publica) imagen en {png}")
            continue
        from facebook import publicar_foto

        publicar_foto(png, cronica["texto"])
        publicadas.append(m["id"])
        PUBLICADAS.parent.mkdir(exist_ok=True)
        PUBLICADAS.write_text(json.dumps(publicadas))


if __name__ == "__main__":
    main()
