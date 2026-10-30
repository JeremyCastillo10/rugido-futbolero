"""Sube out/episodio.mp4 como Reel con la API de Instagram (subida directa, sin hosting)."""

import json
import time

from comun import EPISODIO, RAIZ, cargar_env, env, http

API = "https://graph.facebook.com/v21.0"


def main() -> None:
    cargar_env()
    usuario = env("IG_USER_ID")
    token = env("IG_ACCESS_TOKEN")
    video = (RAIZ / "out" / "episodio.mp4").read_bytes()
    caption = json.loads(EPISODIO.read_text(encoding="utf-8")).get("caption", "")

    # 1. Crear contenedor del Reel con subida reanudable
    contenedor = http(
        f"{API}/{usuario}/media",
        {"media_type": "REELS", "upload_type": "resumable", "caption": caption, "access_token": token},
    )["id"]

    # 2. Subir el MP4 directo a los servidores de Meta
    http(
        f"https://rupload.facebook.com/ig-api-upload/v21.0/{contenedor}",
        video,
        {
            "Authorization": f"OAuth {token}",
            "offset": "0",
            "file_size": str(len(video)),
            "Content-Type": "application/octet-stream",
        },
        "POST",
    )

    # 3. Esperar a que Instagram procese el video
    for _ in range(40):
        estado = http(f"{API}/{contenedor}?fields=status_code,status&access_token={token}")
        print("estado:", estado.get("status_code"))
        if estado.get("status_code") == "FINISHED":
            break
        if estado.get("status_code") == "ERROR":
            raise SystemExit(f"Instagram rechazó el video: {estado}")
        time.sleep(15)
    else:
        raise SystemExit("Instagram tardó demasiado procesando el video")

    # 4. Publicar
    publicado = http(f"{API}/{usuario}/media_publish", {"creation_id": contenedor, "access_token": token})
    print("Publicado:", publicado["id"])


if __name__ == "__main__":
    main()
