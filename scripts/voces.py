"""Genera un audio por escena con Gemini TTS (plan gratis de Google AI Studio)."""

import base64
import json
import urllib.error
import wave

from comun import EPISODIO, PUBLIC, CuotaDiaria, cargar_env, env, gemini

MODELOS_TTS = [
    "gemini-3.8-flash-tts",
    "gemini-3.1-flash-tts-preview",
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
    "gemini-3.8-flash-lite-tts",
]

VOCES = {
    "presentador": "Charon",  # informativo, grave
    "merengue": "Puck",  # animado
    "cule": "Fenrir",  # expresivo
}

ACENTO = {
    "presentador": "como un presentador de noticias deportivas de España, con energía",
    "merengue": "como un hincha del Real Madrid presumido, con acento español",
    "cule": "como un hincha del Barça muy dramático, con acento español",
}

TONO = {
    "normal": "",
    "burla": ", en tono burlón y riéndose un poco",
    "enojo": ", muy indignado",
    "risa": ", riéndose a carcajadas",
    "triste": ", triste y casi llorando",
    "celebrar": ", celebrando eufórico",
    "sorpresa": ", muy sorprendido",
}


def guardar_wav(pcm: bytes, ruta) -> None:
    with wave.open(str(ruta), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24000)
        w.writeframes(pcm)


def main() -> None:
    cargar_env()
    # Cada modelo tiene su propio cupo diario gratis; al agotarse uno se pasa al siguiente
    modelos = env("GEMINI_MODELOS_TTS", ",".join(MODELOS_TTS)).split(",")
    episodio = json.loads(EPISODIO.read_text(encoding="utf-8"))
    carpeta = PUBLIC / "audio"
    carpeta.mkdir(exist_ok=True)
    for viejo in carpeta.glob("*.*"):
        viejo.unlink()

    for i, escena in enumerate(episodio["escenas"]):
        p = escena["personaje"]
        texto = escena["texto"]
        estilo = f"rápido y con ritmo ágil, {ACENTO[p]}{TONO.get(escena.get('gesto', 'normal'), '')}"
        # El estilo va aparte y marcado; la voz solo debe leer lo que está entre comillas
        indicacion = (
            f"Instrucción de actuación (NO la leas en voz alta): habla {estilo}.\n"
            f'Lee en voz alta únicamente este texto, palabra por palabra: "{texto}"'
        )
        # Duración razonable para esas palabras; si se pasa mucho, leyó las instrucciones
        maximo = len(texto.split()) / 2.0 + 2.5

        pcm = None
        con_estilo = True
        while pcm is None:
            if not modelos:
                raise SystemExit("Se agotó el cupo gratis de todos los modelos de voz por hoy")
            # Los modelos "lite" leen en voz alta cualquier instrucción: a esos solo el texto
            if "lite" in modelos[0]:
                con_estilo = False
            try:
                r = gemini(
                    modelos[0],
                    {
                        "contents": [{"parts": [{"text": indicacion if con_estilo else texto}]}],
                        "generationConfig": {
                            "responseModalities": ["AUDIO"],
                            "speechConfig": {
                                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOCES[p]}}
                            },
                        },
                    },
                )
            except (CuotaDiaria, urllib.error.HTTPError) as e:
                print(f"{modelos[0]} no disponible ({e}), probando el siguiente modelo")
                modelos.pop(0)
                continue
            audio = base64.b64decode(r["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
            segundos = len(audio) / (24000 * 2)
            if con_estilo and segundos > maximo:
                print(f"  {i:02d}: duró {segundos:.1f}s (máx {maximo:.1f}s), leyó las instrucciones; repitiendo solo con el texto")
                con_estilo = False
                continue
            pcm = audio
        archivo = carpeta / f"{i:02d}.wav"
        guardar_wav(pcm, archivo)
        escena["audio"] = f"audio/{archivo.name}"
        print(f"{archivo.name}  {p}: {escena['texto'][:60]}")

    EPISODIO.write_text(json.dumps(episodio, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
