"""Genera un audio por escena con Gemini TTS (plan gratis de Google AI Studio)."""

import base64
import json
import time
import wave

from comun import EPISODIO, PUBLIC, cargar_env, env, gemini

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
    modelo = env("GEMINI_MODELO_TTS", "gemini-3.8-flash-tts")
    episodio = json.loads(EPISODIO.read_text(encoding="utf-8"))
    carpeta = PUBLIC / "audio"
    carpeta.mkdir(exist_ok=True)
    for viejo in carpeta.glob("*.*"):
        viejo.unlink()

    for i, escena in enumerate(episodio["escenas"]):
        p = escena["personaje"]
        indicacion = f"Dilo rápido, con ritmo ágil de video corto, {ACENTO[p]}{TONO.get(escena.get('gesto', 'normal'), '')}: {escena['texto']}"
        for intento in range(4):
            try:
                r = gemini(
                    modelo,
                    {
                        "contents": [{"parts": [{"text": indicacion}]}],
                        "generationConfig": {
                            "responseModalities": ["AUDIO"],
                            "speechConfig": {
                                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOCES[p]}}
                            },
                        },
                    },
                )
                break
            except Exception as e:  # límite por minuto del plan gratis
                print("reintentando:", e)
                time.sleep(25 * (intento + 1))
        else:
            raise SystemExit("Gemini TTS no respondió")

        pcm = base64.b64decode(r["candidates"][0]["content"]["parts"][0]["inlineData"]["data"])
        archivo = carpeta / f"{i:02d}.wav"
        guardar_wav(pcm, archivo)
        escena["audio"] = f"audio/{archivo.name}"
        print(f"{archivo.name}  {p}: {escena['texto'][:60]}")

    EPISODIO.write_text(json.dumps(episodio, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
