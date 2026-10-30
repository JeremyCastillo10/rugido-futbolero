import React from "react";
import { Easing, Img, interpolate, staticFile } from "remotion";
import type { Personaje } from "./tipos";

// Escena del mockup (1024x612 originales) mostrada a 1080 px de ancho
const ANCHO = 1080;
const ALTO = 645;
const ESCALA = ANCHO / 1024;

// Punto de enfoque y zoom de cada personaje, en coordenadas de la imagen original
const TOMA: Record<Personaje, { x: number; y: number; zoom: number }> = {
  presentador: { x: 512, y: 300, zoom: 1.0 },
  merengue: { x: 230, y: 300, zoom: 1.7 },
  cule: { x: 830, y: 300, zoom: 1.7 },
};

// Boca de cada personaje en la imagen original (centro y ancho)
const BOCA: Record<Personaje, { x: number; y: number; w: number }> = {
  presentador: { x: 508, y: 341, w: 50 },
  merengue: { x: 242, y: 416, w: 52 },
  cule: { x: 827, y: 420, w: 57 },
};

type Props = {
  hablando: Personaje | null;
  anterior: Personaje | null;
  boca: number; // 0..1 según el volumen de la voz
  t: number; // frames desde que empezó la escena
};

export const EscenaFoto: React.FC<Props> = ({ hablando, anterior, boca, t }) => {
  const objetivo = TOMA[hablando ?? "presentador"];
  const previo = TOMA[anterior ?? hablando ?? "presentador"];
  const k = interpolate(t, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const zoom = previo.zoom + (objetivo.zoom - previo.zoom) * k;
  const fx = (previo.x + (objetivo.x - previo.x) * k) * ESCALA;
  const fy = (previo.y + (objetivo.y - previo.y) * k) * ESCALA;

  // Latido suave mientras habla
  const s = zoom * (1 + boca * 0.012);
  // Centrar el punto de enfoque sin mostrar bordes vacíos
  let tx = ANCHO / 2 - s * fx;
  let ty = ALTO / 2 - s * fy;
  tx = Math.min(0, Math.max(ANCHO - s * ANCHO, tx));
  ty = Math.min(0, Math.max(ALTO - s * ALTO, ty));

  const bocaHablante = hablando ? BOCA[hablando] : null;
  const altoBoca = boca * 26;

  return (
    <div style={{ position: "absolute", left: 0, top: 470, width: ANCHO, height: ALTO, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: ANCHO,
          height: ALTO,
          transformOrigin: "0 0",
          transform: `translate(${tx}px, ${ty}px) scale(${s})`,
        }}
      >
        <Img src={staticFile("escena/escena.jpg")} style={{ width: ANCHO, height: ALTO }} />
        {/* Boca que se abre con la voz; cuando está en silencio no se ve */}
        {bocaHablante && altoBoca > 0.5 && (
          <div
            style={{
              position: "absolute",
              left: bocaHablante.x * ESCALA - (bocaHablante.w * ESCALA) / 2,
              top: bocaHablante.y * ESCALA - altoBoca / 2,
              width: bocaHablante.w * ESCALA,
              height: altoBoca,
              borderRadius: "50%",
              background: "#3a0a12",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "25%",
                bottom: -altoBoca * 0.2,
                width: "50%",
                height: altoBoca * 0.5,
                borderRadius: "50%",
                background: "#e05a6a",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
