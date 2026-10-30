"""Genera la música y los efectos originales del noticiero (sin derechos de terceros).

public/musica.wav   tema de noticiero deportivo en loop (metales, bajo y batería con energía)
public/whoosh.wav   barrido para cambios de noticia
public/publico.wav  público celebrando para los goles
public/golpe.wav    golpe de impacto para rótulos y marcadores
"""

import array
import math
import random
import wave

from comun import PUBLIC

SR = 22050
BPM = 128
BEAT = 60 / BPM
rnd = random.Random(11)


def hz(nota: int) -> float:
    return 440 * 2 ** ((nota - 69) / 12)


def guardar(nombre: str, buf: list[float], pico_obj: float = 0.85) -> None:
    pico = max(abs(x) for x in buf) or 1
    datos = array.array("h", (int(max(-1, min(1, x / pico * pico_obj)) * 32767) for x in buf))
    with wave.open(str(PUBLIC / nombre), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(datos.tobytes())
    print(f"{nombre}: {len(buf) / SR:.1f} s")


def metal(buf, inicio, dur, notas, vol, corte=0.12):
    """Acorde tipo sección de metales: sierras desafinadas con filtro que se abre."""
    n0, n = int(inicio * SR), int(dur * SR)
    for nota in notas:
        for desaf in (-0.12, 0.12):
            f = hz(nota) * 2 ** (desaf / 12)
            y = 0.0
            for i in range(n):
                t = i / SR
                s = 2 * ((t * f) % 1) - 1
                # Filtro paso bajo de un polo; se abre al atacar y se cierra al caer
                a = 0.08 + 0.35 * math.exp(-t / corte)
                y += a * (s - y)
                env = min(1, t / 0.012) * (1 if t < dur * 0.7 else max(0, 1 - (t - dur * 0.7) / (dur * 0.3)))
                k = n0 + i
                if k < len(buf):
                    buf[k] += y * vol * env


def bajo(buf, inicio, dur, nota, vol):
    n0, n = int(inicio * SR), int(dur * SR)
    f = hz(nota)
    y = 0.0
    for i in range(n):
        t = i / SR
        s = 2 * ((t * f) % 1) - 1
        y += 0.18 * (s - y)
        k = n0 + i
        if k < len(buf):
            buf[k] += y * vol * math.exp(-t / 0.25)


def bombo(buf, inicio, vol=0.9):
    n0 = int(inicio * SR)
    for i in range(int(0.22 * SR)):
        t = i / SR
        if n0 + i < len(buf):
            buf[n0 + i] += math.sin(2 * math.pi * (55 + 140 * math.exp(-t / 0.03)) * t) * vol * math.exp(-t / 0.09)


def caja(buf, inicio, vol=0.45):
    n0 = int(inicio * SR)
    for i in range(int(0.18 * SR)):
        t = i / SR
        if n0 + i < len(buf):
            ruido = rnd.random() * 2 - 1
            buf[n0 + i] += (ruido * 0.8 + math.sin(2 * math.pi * 190 * t) * 0.4) * vol * math.exp(-t / 0.05)


def plato(buf, inicio, vol=0.08, dur=0.03):
    n0 = int(inicio * SR)
    prev = 0.0
    for i in range(int(dur * 6 * SR)):
        t = i / SR
        r = rnd.random() * 2 - 1
        alto = r - prev  # paso alto simple: brillo metálico
        prev = r
        if n0 + i < len(buf):
            buf[n0 + i] += alto * vol * math.exp(-t / dur)


def tema() -> None:
    # Re mayor heroico: I - V - vi - IV y cierre con IV - V
    progresion = [
        (62, [62, 66, 69]), (57, [57, 61, 64]), (59, [59, 62, 66]), (55, [55, 59, 62]),
        (62, [62, 66, 69]), (57, [57, 61, 64]), (55, [55, 59, 62]), (57, [57, 61, 64]),
    ]
    compases = len(progresion)
    buf = [0.0] * int(compases * 4 * BEAT * SR)

    for c, (raiz, acorde) in enumerate(progresion):
        base = c * 4 * BEAT
        # Bajo galopante en corcheas
        for b in range(8):
            octava = 12 if b % 4 == 3 else 0
            bajo(buf, base + b * BEAT / 2, BEAT / 2 * 0.9, raiz - 24 + octava, 0.32)
        # Metales: golpe largo en el 1 y síncopa "ta-ta" al final del compás
        metal(buf, base, BEAT * 1.4, [n + 12 for n in acorde], 0.055)
        metal(buf, base + 2.5 * BEAT, BEAT * 0.4, [n + 12 for n in acorde], 0.05, corte=0.06)
        metal(buf, base + 3.0 * BEAT, BEAT * 0.8, [n + 12 for n in acorde], 0.05, corte=0.08)
        # Batería
        for b in range(4):
            bombo(buf, base + b * BEAT)
            if b in (1, 3):
                caja(buf, base + b * BEAT)
            for h in (0, 0.5):
                plato(buf, base + (b + h) * BEAT)
        if c % 4 == 0:
            plato(buf, base, vol=0.25, dur=0.35)  # platillo de choque al empezar la frase
        if c == compases - 1:
            for r in range(4):  # redoble antes de volver al inicio
                caja(buf, base + 3 * BEAT + r * BEAT / 4, vol=0.3 + r * 0.06)

    # Melodía de trompeta (una nota por tiempo, con algunas corcheas)
    melodia = [
        (0, 74, 1.5), (1.5, 76, 0.5), (2, 78, 1), (3, 76, 1),
        (4, 73, 1.5), (5.5, 74, 0.5), (6, 76, 2),
        (8, 78, 1), (9, 79, 1), (10, 81, 1.5), (11.5, 79, 0.5),
        (12, 78, 1), (13, 76, 1), (14, 74, 2),
        (16, 74, 1.5), (17.5, 76, 0.5), (18, 78, 1), (19, 81, 1),
        (20, 83, 1.5), (21.5, 81, 0.5), (22, 78, 2),
        (24, 79, 1), (25, 78, 1), (26, 76, 1), (27, 79, 1),
        (28, 81, 2), (30, 78, 0.5), (30.5, 79, 0.5), (31, 81, 1),
    ]
    for tiempo, nota, dur in melodia:
        metal(buf, tiempo * BEAT, dur * BEAT * 0.95, [nota], 0.07, corte=0.2)

    guardar("musica.wav", buf, 0.8)


def whoosh() -> None:
    dur = 0.6
    buf = [0.0] * int(dur * SR)
    y = 0.0
    for i in range(len(buf)):
        t = i / SR
        a = 0.02 + 0.5 * math.sin(math.pi * t / dur) ** 2  # el filtro sube y baja
        y += a * ((rnd.random() * 2 - 1) - y)
        buf[i] = y * math.sin(math.pi * t / dur)
    guardar("whoosh.wav", buf, 0.7)


def publico() -> None:
    dur = 3.0
    buf = [0.0] * int(dur * SR)
    y1 = y2 = 0.0
    for i in range(len(buf)):
        t = i / SR
        r = rnd.random() * 2 - 1
        y1 += 0.12 * (r - y1)  # rumor grave del estadio
        y2 += 0.35 * (r - y2)
        env = min(1, t / 0.25) * (1 if t < 1.8 else max(0, 1 - (t - 1.8) / 1.2))
        buf[i] = (y1 * 1.4 + (y2 - y1) * 0.6) * env
    # Gritos: barridos de tono que simulan voces de euforia
    for _ in range(40):
        t0 = rnd.uniform(0.05, 1.6)
        f = rnd.uniform(300, 700)
        for i in range(int(rnd.uniform(0.3, 0.9) * SR)):
            t = i / SR
            k = int(t0 * SR) + i
            if k < len(buf):
                vib = 1 + 0.03 * math.sin(2 * math.pi * 6 * t)
                buf[k] += math.sin(2 * math.pi * f * vib * t) * 0.025 * math.sin(math.pi * min(1, t / 0.9))
    guardar("publico.wav", buf, 0.75)


def golpe() -> None:
    dur = 0.7
    buf = [0.0] * int(dur * SR)
    bombo(buf, 0, 1.0)
    plato(buf, 0, vol=0.35, dur=0.25)
    for i in range(len(buf)):
        t = i / SR
        buf[i] += math.sin(2 * math.pi * 73.4 * t) * 0.5 * math.exp(-t / 0.25)
    guardar("golpe.wav", buf, 0.8)


if __name__ == "__main__":
    tema()
    whoosh()
    publico()
    golpe()
