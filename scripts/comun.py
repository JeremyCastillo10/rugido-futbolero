"""Utilidades compartidas: rutas, .env y llamadas HTTP sin dependencias."""

import json
import os
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
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())


def gemini(modelo: str, cuerpo: dict) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
    return http(url, cuerpo, {"x-goog-api-key": env("GEMINI_API_KEY")})
