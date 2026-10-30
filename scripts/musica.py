"""Genera public/musica.wav: un loop original de fondo (sin derechos de terceros)."""

import array
import math
import random
import wave

from comun import PUBLIC

SR = 22050
BPM = 118
BEAT = 60 / BPM
COMPASES = 8  # loop de 8 compases de 4 tiempos

# Progresión I - V - vi - IV en Do, dos vueltas
ACORDES = [
    [60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60],
    [60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60],
]
# Melodía en corcheas (None = silencio)
MELODIA = [
    72, None, 74, 76, None, 76, 74, 72,  71, None, 67, 71, 74, None, 71, None,
    69, None, 72, 76, None, 74, 72, 69,  65, None, 69, 72, 74, 72, 69, None,
    72, None, 74, 76, 79, 76, 74, 72,  71, 74, 79, None, 74, None, 71, 67,
    69, 72, 76, None, 77, 76, 72, 69,  65, 69, 72, 77, 76, None, 72, None,
]


def hz(nota: int) -> float:
    return 440 * 2 ** ((nota - 69) / 12)


def tono(buf, inicio, dur, frec, vol, forma="pulso", ataque=0.005, caida=0.15):
    n0 = int(inicio * SR)
    n = int(dur * SR)
    for i in range(n):
        t = i / SR
        fase = (t * frec) % 1
        if forma == "pulso":
            s = 1.0 if fase < 0.25 else -1.0
        elif forma == "tri":
            s = 4 * abs(fase - 0.5) - 1
        else:
            s = math.sin(2 * math.pi * fase)
        env = min(1, t / ataque) * math.exp(-t / caida)
        k = n0 + i
        if k < len(buf):
            buf[k] += s * vol * env


def main() -> None:
    total = COMPASES * 4 * BEAT
    buf = [0.0] * int(total * SR)
    rnd = random.Random(7)

    for c, acorde in enumerate(ACORDES):
        base = c * 4 * BEAT
        # Bajo en negras
        for b in range(4):
            tono(buf, base + b * BEAT, BEAT * 0.9, hz(acorde[0] - 24), 0.28, "tri", caida=0.3)
        # Acordes a contratiempo
        for b in range(4):
            for nota in acorde:
                tono(buf, base + (b + 0.5) * BEAT, BEAT * 0.4, hz(nota), 0.05, "pulso", caida=0.08)
        # Batería: bombo en 1 y 3, caja en 2 y 4, hi-hat en corcheas
        for b in range(4):
            t0 = int((base + b * BEAT) * SR)
            if b % 2 == 0:
                for i in range(int(0.15 * SR)):
                    t = i / SR
                    buf[t0 + i] += math.sin(2 * math.pi * (110 - 300 * t) * t) * 0.5 * math.exp(-t / 0.05)
            else:
                for i in range(int(0.12 * SR)):
                    buf[t0 + i] += (rnd.random() * 2 - 1) * 0.22 * math.exp(-i / SR / 0.04)
            for h in (0, 0.5):
                th = int((base + (b + h) * BEAT) * SR)
                for i in range(int(0.03 * SR)):
                    buf[th + i] += (rnd.random() * 2 - 1) * 0.07 * math.exp(-i / SR / 0.008)

    for i, nota in enumerate(MELODIA):
        if nota:
            tono(buf, i * BEAT / 2, BEAT / 2 * 0.95, hz(nota), 0.09, "pulso", caida=0.12)

    pico = max(abs(x) for x in buf)
    datos = array.array("h", (int(x / pico * 0.8 * 32767) for x in buf))
    with wave.open(str(PUBLIC / "musica.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(datos.tobytes())
    print(f"musica.wav: {total:.1f} s")


if __name__ == "__main__":
    main()
