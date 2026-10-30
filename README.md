# Fútbol Europeo Hoy

Noticiero diario animado (Reels de Instagram) con Leo Rugido, Merenguito y Culerín. Todo gratis.

```
guion.py   noticias RSS + resultados (football-data.org) -> Gemini escribe el guion
voces.py   Gemini TTS genera una voz por escena
render     Remotion + Three.js -> out/episodio.mp4 (1080x1920)
publicar   API de Instagram sube el Reel
```

GitHub Actions lo corre cada día a las 8:00 a.m. (hora RD), con la PC apagada.

## Probar en tu PC

```bash
npm install

cp .env.example .env              # y llena las llaves
npm run studio                    # editor visual en el navegador
npm run episodio                  # guion + voces + render
```

## Llaves que necesitas (todas gratis)

1. **GEMINI_API_KEY**: entra a https://aistudio.google.com/apikey con tu cuenta de Google y crea una llave.
2. **FOOTBALL_DATA_KEY**: regístrate en https://www.football-data.org/client/register; la llave llega por correo.
3. **Instagram**:
   1. Crea la cuenta de Instagram desde la app.
   2. En Configuración, ve a *Tipo de cuenta y herramientas* y cámbiala a **cuenta profesional (Creador)**.
   3. Entra a https://developers.facebook.com, crea una app de tipo *Business* y agrega el producto **Instagram > API con inicio de sesión de Instagram**.
   4. En *Generar tokens de acceso*, agrega tu cuenta de Instagram y genera el token. Ese es **IG_ACCESS_TOKEN** y dura 60 días; renuévalo antes de que venza.
   5. Ahí mismo aparece el ID de la cuenta: ese es **IG_USER_ID**.

## Automatizar en GitHub

1. Crea un repositorio en GitHub y sube esta carpeta.
2. En *Settings > Secrets and variables > Actions*, agrega las 4 llaves con los mismos nombres.
3. En *Actions > Episodio diario > Run workflow*, prueba una vez sin publicar y descarga el video del artefacto.
4. Desde ahí sale solo cada día.
