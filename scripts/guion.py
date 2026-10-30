"""Junta resultados y titulares del día y le pide a Gemini (gratis) el guion del episodio."""

import json
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, timedelta

from comun import EPISODIO, cargar_env, env, gemini, http

# Feeds RSS de noticias de fútbol europeo; si alguno falla se ignora
FEEDS = [
    "https://www.espn.com/espn/rss/soccer/news",
    "https://feeds.bbci.co.uk/sport/football/rss.xml",
    "https://e00-marca.uecdn.es/rss/futbol/primera-division.xml",
    "https://as.com/rss/futbol/primera.xml",
    "https://www.mundodeportivo.com/rss/futbol/fc-barcelona.xml",
]

# Competiciones del plan gratis de football-data.org
COMPETICIONES = "PD,PL,SA,BL1,FL1,CL"

MODELOS_TEXTO = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.8-flash", "gemini-3.7-flash"]

MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]

INSTRUCCIONES = """Eres el guionista de "Fútbol Europeo Hoy", un noticiero diario animado y gracioso para Instagram Reels.

Personajes:
- presentador: Leo Rugido, un león, presentador serio pero simpático. Da las noticias.
- merengue: Merenguito, hincha fanático del Real Madrid, presumido, siempre habla de Champions.
- cule: Culerín, hincha fanático del Barça, dramático, presume de La Masia y del juego bonito.

Reglas:
1. Usa SOLO hechos que aparezcan en los DATOS. No inventes resultados, fichajes, cifras ni declaraciones.
2. El humor va en los comentarios y piques entre Merenguito y Culerín, nunca en datos falsos.
3. Elige las 3 noticias más interesantes (prioriza Madrid/Barça si las hay, luego grandes de Europa).
4. Estructura: saludo del presentador; para cada noticia: presentador la cuenta (con "titular") y 1-2 réplicas de los comentaristas; cierre del presentador con una pregunta para que la gente comente.
5. Frases MUY cortas y naturales, máximo 16 palabras por escena. Total 8-10 escenas (unos 45 segundos). Ritmo rápido de Reel.
6. Nada ofensivo, sin insultos a jugadores, árbitros ni aficiones.
7. "titular" solo en la escena del presentador que abre cada noticia, formato "1/3 · Texto corto" (máx 45 caracteres).
8. gesto: uno de normal, burla, enojo, risa, triste, celebrar, sorpresa.
9. Escribe también "caption" para Instagram (2-3 líneas + 5 hashtags).
10. En cada escena del presentador que abre una noticia agrega "visual" para ilustrarla, con datos SOLO de los DATOS:
   - Si hubo goles de un jugador: {"tipo":"gol","goles":N,"jugador":"Nombre Apellido"} (N = goles que marcó, máx 5)
   - Si es un resultado de partido: {"tipo":"marcador","local":"Equipo","visitante":"Equipo","golesLocal":N,"golesVisitante":N,"competicion":"Liga"}
   - Si la noticia es una cifra: {"tipo":"dato","numero":"985","texto":"goles oficiales","jugador":"Nombre Apellido (opcional)"}
   - Si trata de un jugador concreto: {"tipo":"jugador","jugador":"Nombre Apellido","texto":"frase corta"}
   Usa nombres completos reales (como en Wikipedia) para que se pueda buscar su foto.

Responde SOLO con JSON:
{"escenas":[{"personaje":"presentador|merengue|cule","texto":"...","gesto":"...","titular":"opcional","visual":{...opcional}}],"caption":"..."}"""


def partidos_de_ayer() -> list[str]:
    ayer = (date.today() - timedelta(days=1)).isoformat()
    hoy = date.today().isoformat()
    url = (
        "https://api.football-data.org/v4/matches"
        f"?competitions={COMPETICIONES}&dateFrom={ayer}&dateTo={hoy}"
    )
    try:
        datos = http(url, headers={"X-Auth-Token": env("FOOTBALL_DATA_KEY")})
    except Exception as e:  # sin key o caída: seguimos solo con noticias
        print("football-data:", e)
        return []
    lineas = []
    for m in datos.get("matches", []):
        comp = m["competition"]["name"]
        local = m["homeTeam"]["shortName"] or m["homeTeam"]["name"]
        visita = m["awayTeam"]["shortName"] or m["awayTeam"]["name"]
        if m["status"] == "FINISHED":
            g = m["score"]["fullTime"]
            lineas.append(f"[{comp}] {local} {g['home']}-{g['away']} {visita}")
        else:
            lineas.append(f"[{comp}] Próximo: {local} vs {visita} ({m['utcDate'][:16]} UTC)")
    return lineas


def titulares() -> list[str]:
    lineas = []
    for feed in FEEDS:
        try:
            req = urllib.request.Request(feed, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                raiz = ET.fromstring(r.read())
            for item in list(raiz.iter("item"))[:12]:
                titulo = (item.findtext("title") or "").strip()
                desc = (item.findtext("description") or "").strip()[:200]
                if titulo:
                    lineas.append(f"- {titulo}. {desc}")
        except Exception as e:
            print("feed", feed, e)
    return lineas


def main() -> None:
    cargar_env()
    resultados = partidos_de_ayer()
    noticias = titulares()
    datos = "RESULTADOS Y PARTIDOS:\n" + "\n".join(resultados or ["(sin datos)"])
    datos += "\n\nTITULARES:\n" + "\n".join(noticias or ["(sin datos)"])
    print(datos[:1500], "...\n")

    # Si un modelo está saturado o sin cupo, se prueba el siguiente
    cuerpo = {
        "systemInstruction": {"parts": [{"text": INSTRUCCIONES}]},
        "contents": [{"parts": [{"text": f"Fecha: {date.today().isoformat()}\n\nDATOS:\n{datos}"}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.9},
    }
    respuesta = None
    for modelo in env("GEMINI_MODELOS_TEXTO", ",".join(MODELOS_TEXTO)).split(","):
        try:
            print("Escribiendo guion con", modelo)
            respuesta = gemini(modelo, cuerpo, reintentos=2)
            break
        except Exception as e:
            print(f"{modelo} no disponible ({e})")
    if respuesta is None:
        raise SystemExit("Ningún modelo de Gemini respondió")
    texto = respuesta["candidates"][0]["content"]["parts"][0]["text"]
    guion = json.loads(texto)

    hoy = date.today()
    episodio = {
        "fecha": f"{hoy.day} {MESES[hoy.month - 1]}",
        "titulo": "FÚTBOL EUROPEO HOY",
        "escenas": guion["escenas"],
        "caption": guion.get("caption", ""),
    }
    EPISODIO.write_text(json.dumps(episodio, ensure_ascii=False, indent=2), encoding="utf-8")
    for e in episodio["escenas"]:
        print(f"{e['personaje']:>11}: {e['texto']}")


if __name__ == "__main__":
    main()
