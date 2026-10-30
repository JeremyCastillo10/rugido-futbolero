"""Busca fotos de jugadores en Wikimedia Commons y usa solo las de licencia libre, con crédito."""

import json
import re
import urllib.parse
import urllib.request

from comun import EPISODIO, PUBLIC, http

# Licencias que permiten uso comercial con atribución
LIBRES = re.compile(r"^(CC0|CC BY(-SA)? [\d.]+|Public domain|PD)", re.I)
UA = {"User-Agent": "futbol-animado/1.0 (noticiero animado; contacto via GitHub)"}


def limpiar(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html or "").strip()


def foto_libre(jugador: str) -> dict | None:
    # 1. Imagen principal del artículo de Wikipedia (casi siempre viene de Commons)
    q = urllib.parse.urlencode(
        {
            "action": "query",
            "titles": jugador,
            "prop": "pageimages",
            "piprop": "name",
            "redirects": 1,
            "format": "json",
        }
    )
    paginas = http(f"https://en.wikipedia.org/w/api.php?{q}", headers=UA)["query"]["pages"]
    nombre = next((p.get("pageimage") for p in paginas.values() if p.get("pageimage")), None)
    if not nombre:
        return None

    # 2. Licencia y autor desde Commons; si no está en Commons no es libre
    q = urllib.parse.urlencode(
        {
            "action": "query",
            "titles": f"File:{nombre}",
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": 800,
            "format": "json",
        }
    )
    paginas = http(f"https://commons.wikimedia.org/w/api.php?{q}", headers=UA)["query"]["pages"]
    info = next(iter(paginas.values())).get("imageinfo")
    if not info:
        return None
    meta = info[0]["extmetadata"]
    licencia = limpiar(meta.get("LicenseShortName", {}).get("value", ""))
    if not LIBRES.match(licencia):
        print(f"  {jugador}: licencia no libre ({licencia}), se omite")
        return None
    autor = limpiar(meta.get("Artist", {}).get("value", "")) or "Wikimedia Commons"
    return {"url": info[0]["thumburl"], "credito": f"Foto: {autor[:40]} · {licencia}"}


def main() -> None:
    episodio = json.loads(EPISODIO.read_text(encoding="utf-8"))
    carpeta = PUBLIC / "fotos"
    carpeta.mkdir(exist_ok=True)
    for viejo in carpeta.glob("*.*"):
        viejo.unlink()

    for i, escena in enumerate(episodio["escenas"]):
        visual = escena.get("visual")
        if not visual or not visual.get("jugador"):
            continue
        try:
            foto = foto_libre(visual["jugador"])
        except Exception as e:
            print(f"  {visual['jugador']}: error buscando foto ({e})")
            foto = None
        if not foto:
            continue
        archivo = carpeta / f"{i:02d}.jpg"
        req = urllib.request.Request(foto["url"], headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r:
            archivo.write_bytes(r.read())
        visual["foto"] = f"fotos/{archivo.name}"
        visual["credito"] = foto["credito"]
        print(f"{archivo.name}  {visual['jugador']}  ({foto['credito']})")

    EPISODIO.write_text(json.dumps(episodio, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
