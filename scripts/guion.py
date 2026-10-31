"""Junta resultados y titulares del día y le pide a Gemini (gratis) el guion del episodio."""

import html
import json
import os
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from comun import EPISODIO, cargar_env, env, gemini, http, ordenar_hashtags

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
5. Frases cortas y naturales, máximo 18 palabras por escena. Total 13-15 escenas (unos 70 segundos de video, nunca menos de 65). Ritmo rápido de Reel.
6. Nada ofensivo, sin insultos a jugadores, árbitros ni aficiones.
7. "titular" solo en la escena del presentador que abre cada noticia, formato "1/3 · Texto corto" (máx 45 caracteres).
8. gesto: uno de normal, burla, enojo, risa, triste, celebrar, sorpresa.
9. Escribe también "caption" para Instagram y Facebook, pensado para que se encuentre en el buscador:
   - Primera línea (máx 120 caracteres): las 3 noticias resumidas con nombres completos de equipos
     y jugadores (ej. "Mbappé, Real Madrid y PSG: las noticias del fútbol europeo hoy").
   - Segunda línea: una frase natural con palabras que la gente busca, como "noticias de fútbol",
     "fútbol europeo", el nombre de la liga o competición de cada noticia.
   - Tercera línea: una pregunta para que comenten (ej. "¿Quién gana el pique, Merenguito o Culerín?").
   - Al final 4 hashtags concretos de ESTE episodio: equipos y jugadores de las noticias
     y uno general (#FutbolEuropeo o #NoticiasDeFutbol). Sin tildes ni espacios en los hashtags.
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


# Modelos de Groq en orden de preferencia (se puede cambiar con GROQ_MODELOS en los secretos/env)
MODELOS_GROQ = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]


def groq_texto(sistema: str, usuario: str) -> str:
    """Respaldo con Groq (API compatible con OpenAI). Prueba varios modelos y devuelve el JSON como texto."""
    errores = []
    for modelo in env("GROQ_MODELOS", ",".join(MODELOS_GROQ)).split(","):
        for modo_json in (True, False):
            cuerpo = {
                "model": modelo,
                "messages": [{"role": "system", "content": sistema}, {"role": "user", "content": usuario}],
                "temperature": 0.9,
            }
            if modo_json:
                cuerpo["response_format"] = {"type": "json_object"}
            try:
                respuesta = http(
                    "https://api.groq.com/openai/v1/chat/completions",
                    cuerpo,
                    {"Authorization": f"Bearer {env('GROQ_API_KEY')}"},
                )
                texto = respuesta["choices"][0]["message"]["content"]
                # Sin modo JSON el modelo puede rodear el JSON con texto: se recorta
                inicio, fin = texto.find("{"), texto.rfind("}")
                json.loads(texto[inicio : fin + 1])
                print(f"Texto escrito con Groq ({modelo})")
                return texto[inicio : fin + 1]
            except urllib.error.HTTPError as e:
                detalle = e.read().decode(errors="ignore")[:300]
                errores.append(f"{modelo} {e.code}: {detalle}")
                print(f"Groq {modelo} respondió {e.code}: {detalle}")
                if e.code != 400:
                    break  # 404/401/429: este modelo no sirve, probar el siguiente
            except (ValueError, KeyError) as e:
                errores.append(f"{modelo}: respuesta no válida ({e})")
                print(f"Groq {modelo}: respuesta no válida ({e})")
    raise RuntimeError("Ningún modelo de Groq respondió: " + " | ".join(errores))


def limpiar_html(texto: str) -> str:
    """Quita etiquetas y entidades (&nbsp;, &amp;) de los titulares y resúmenes del feed."""
    sin_etiquetas = re.sub(r"<[^>]+>", " ", texto)
    return re.sub(r"\s+", " ", html.unescape(sin_etiquetas)).strip()


def titulares(horas: int = 48) -> list[str]:
    """Solo titulares recientes (últimas 48 h), del más nuevo al más viejo.

    Los feeds RSS guardan artículos viejos; sin este filtro el guion podía
    contar noticias de hace años como si fueran de hoy.
    """
    limite = datetime.now(timezone.utc) - timedelta(hours=horas)
    candidatos = []
    for feed in FEEDS:
        try:
            req = urllib.request.Request(feed, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                raiz = ET.fromstring(r.read())
            for item in raiz.iter("item"):
                titulo = (item.findtext("title") or "").strip()
                desc = limpiar_html(item.findtext("description") or "")[:200]
                titulo = limpiar_html(titulo)
                fecha_txt = item.findtext("pubDate")
                if not titulo or not fecha_txt:
                    continue
                try:
                    fecha = parsedate_to_datetime(fecha_txt.strip())
                except (TypeError, ValueError):
                    continue
                if fecha.tzinfo is None:
                    fecha = fecha.replace(tzinfo=timezone.utc)
                if fecha < limite:
                    continue
                candidatos.append((fecha, f"- {titulo}. {desc}"))
        except Exception as e:
            print("feed", feed, e)
    candidatos.sort(key=lambda c: c[0], reverse=True)
    return [linea for _, linea in candidatos[:20]]


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
    texto = None
    for modelo in env("GEMINI_MODELOS_TEXTO", ",".join(MODELOS_TEXTO)).split(","):
        try:
            print("Escribiendo guion con", modelo)
            respuesta = gemini(modelo, cuerpo, reintentos=2)
            texto = respuesta["candidates"][0]["content"]["parts"][0]["text"]
            break
        except Exception as e:
            print(f"{modelo} no disponible ({e})")
    # Si Gemini no responde (caída o cupo), se intenta con Groq
    if texto is None and os.environ.get("GROQ_API_KEY"):
        print("Gemini no respondió; escribiendo guion con Groq")
        texto = groq_texto(cuerpo["systemInstruction"]["parts"][0]["text"], cuerpo["contents"][0]["parts"][0]["text"])
    if texto is None:
        raise SystemExit("Ningún modelo de texto respondió (Gemini ni Groq)")
    guion = json.loads(texto)

    hoy = date.today()
    episodio = {
        "fecha": f"{hoy.day} {MESES[hoy.month - 1]}",
        "titulo": "FÚTBOL EUROPEO HOY",
        "escenas": guion["escenas"],
        "caption": ordenar_hashtags(guion.get("caption", "")),
    }
    EPISODIO.write_text(json.dumps(episodio, ensure_ascii=False, indent=2), encoding="utf-8")
    for e in episodio["escenas"]:
        print(f"{e['personaje']:>11}: {e['texto']}")


if __name__ == "__main__":
    main()
