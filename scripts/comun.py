"""Utilidades compartidas: rutas, .env y llamadas HTTP sin dependencias."""

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PUBLIC = RAIZ / "public"
EPISODIO = PUBLIC / "episodio.json"


def cargar_env() -> None:
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if linea and not linea.startswith("#") and "=" in linea:
            k, v = linea.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def env(nombre: str, defecto: str | None = None) -> str:
    valor = os.environ.get(nombre, defecto)
    if valor is None:
        raise SystemExit(f"Falta la variable {nombre} (ponla en .env o en los secrets de GitHub)")
    return valor


def http(url: str, datos: dict | bytes | None = None, headers: dict | None = None, metodo: str | None = None) -> dict:
    cuerpo = json.dumps(datos).encode() if isinstance(datos, dict) else datos
    h = {"Content-Type": "application/json", "User-Agent": "futbol-animado"} | (headers or {})
    req = urllib.request.Request(url, data=cuerpo, headers=h, method=metodo)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def gemini(modelo: str, cuerpo: dict, reintentos: int = 4) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
    # El plan gratis a veces tarda o limita por minuto: reintentar con espera
    for intento in range(reintentos):
        try:
            return http(url, cuerpo, {"x-goog-api-key": env("GEMINI_API_KEY")})
        except urllib.error.HTTPError as e:
            detalle = e.read().decode(errors="ignore")
            if "PerDay" in detalle:
                raise CuotaDiaria(modelo) from e
            if e.code not in (429, 500, 503) or intento == reintentos - 1:
                raise
            print(f"Gemini respondió {e.code}, reintentando...")
        except (TimeoutError, urllib.error.URLError) as e:
            if intento == reintentos - 1:
                raise
            print(f"Gemini falló ({e}), reintentando...")
        time.sleep(20 * (intento + 1))
    raise AssertionError


class CuotaDiaria(Exception):
    """Se agotó el cupo gratis diario de ese modelo."""
