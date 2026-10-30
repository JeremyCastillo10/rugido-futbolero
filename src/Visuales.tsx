import React from "react";
import { Img, interpolate, spring, staticFile, useVideoConfig } from "remotion";
import type { Visual } from "./tipos";

const AMARILLO = "#ffd166";
const AZUL = "#0b1230";
const ROJO = "#e63946";

const Foto: React.FC<{ src: string; credito?: string; ancho: number; alto: number }> = ({
  src,
  credito,
  ancho,
  alto,
}) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
    <Img
      src={staticFile(src)}
      style={{
        width: ancho,
        height: alto,
        objectFit: "cover",
        objectPosition: "50% 20%",
        borderRadius: 28,
        border: `10px solid ${AMARILLO}`,
        boxShadow: "0 14px 0 rgba(0,0,0,.45)",
      }}
    />
    {credito && (
      <div style={{ color: "rgba(255,255,255,.85)", fontSize: 22, fontWeight: 700 }}>{credito}</div>
    )}
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = ROJO }) => (
  <div
    style={{
      background: color,
      color: "white",
      fontWeight: 900,
      fontSize: 40,
      padding: "8px 26px",
      borderRadius: 14,
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);

// Tarjeta que ilustra la noticia entre el rótulo y los subtítulos
export const TarjetaVisual: React.FC<{ visual: Visual; t: number; dur: number }> = ({
  visual,
  t,
  dur,
}) => {
  const { fps } = useVideoConfig();
  const entra = spring({ frame: t, fps, config: { damping: 13 } });
  const sale = interpolate(t, [dur - 8, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cuenta = (n: number) =>
    Math.round(interpolate(t, [8, 38], [0, n], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  let contenido: React.ReactNode = null;

  if (visual.tipo === "marcador") {
    const equipo = (nombre: string, goles: number) => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30 }}>
        <div style={{ fontSize: 62, fontWeight: 900, color: "white", lineHeight: 1.05, flex: 1 }}>
          {nombre}
        </div>
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            color: AZUL,
            background: AMARILLO,
            borderRadius: 22,
            width: 170,
            textAlign: "center",
          }}
        >
          {cuenta(goles)}
        </div>
      </div>
    );
    contenido = (
      <div
        style={{
          width: 900,
          // Foto libre del estadio de fondo, oscurecida para que se lea el marcador
          backgroundColor: AZUL,
          backgroundImage: visual.foto
            ? `linear-gradient(rgba(11,18,48,.72), rgba(11,18,48,.88)), url(${staticFile(visual.foto)})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: `8px solid ${AMARILLO}`,
          borderRadius: 34,
          padding: "36px 44px",
          display: "flex",
          flexDirection: "column",
          gap: 26,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Chip>{visual.competicion ?? "Resultado"}</Chip>
        </div>
        {equipo(visual.local, visual.golesLocal)}
        {equipo(visual.visitante, visual.golesVisitante)}
        <div style={{ textAlign: "center", color: "rgba(255,255,255,.7)", fontSize: 32, fontWeight: 700 }}>
          FINAL{visual.estadio ? ` · ${visual.estadio}` : ""}
        </div>
        {visual.credito && (
          <div style={{ position: "absolute", bottom: -40, left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,.85)", fontSize: 22, fontWeight: 700 }}>
            {visual.credito}
          </div>
        )}
      </div>
    );
  } else if (visual.tipo === "dato") {
    const n = parseInt(visual.numero.replace(/\D/g, ""), 10);
    contenido = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        {visual.foto && <Foto src={visual.foto} credito={visual.credito} ancho={420} alto={420} />}
        <div
          style={{
            fontSize: 190,
            fontWeight: 900,
            color: AMARILLO,
            lineHeight: 0.9,
            textShadow: "0 10px 0 #000",
          }}
        >
          {Number.isFinite(n) ? cuenta(n).toLocaleString("es") : visual.numero}
        </div>
        <Chip>{visual.texto}</Chip>
      </div>
    );
  } else if (visual.tipo === "jugador" && visual.foto) {
    contenido = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Foto src={visual.foto} credito={visual.credito} ancho={560} alto={620} />
        <Chip color={AZUL}>{visual.jugador}</Chip>
      </div>
    );
  } else if (visual.tipo === "gol") {
    // La animación del gol va en 3D; aquí solo el contador y la foto pequeña
    const marcados = Math.min(visual.goles, Math.floor((t / dur) * visual.goles + 0.35));
    contenido = (
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 40,
          right: 40,
          display: "flex",
          alignItems: "center",
          gap: 26,
        }}
      >
        {visual.foto && (
          <Img
            src={staticFile(visual.foto)}
            style={{
              width: 190,
              height: 190,
              objectFit: "cover",
              objectPosition: "50% 15%",
              borderRadius: 999,
              border: `8px solid ${AMARILLO}`,
            }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Chip color={AZUL}>{visual.jugador ?? "¡Gol!"}</Chip>
          <div style={{ display: "flex", gap: 14, height: 80, alignItems: "center" }}>
            {Array.from({ length: Math.max(0, marcados) }, (_, k) => (
              <div
                key={k}
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 999,
                  background: "radial-gradient(circle at 50% 50%, #111 0 22%, white 23%)",
                  border: "6px solid #111",
                  boxShadow: "0 6px 0 rgba(0,0,0,.5)",
                }}
              />
            ))}
          </div>
        </div>
        {visual.credito && (
          <div
            style={{
              position: "absolute",
              top: 200,
              left: 0,
              color: "rgba(255,255,255,.85)",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {visual.credito}
          </div>
        )}
      </div>
    );
  }

  if (!contenido) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 430,
        left: 0,
        right: 0,
        height: 860,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: sale,
        transform: `scale(${0.6 + entra * 0.4}) translateY(${(1 - entra) * 120}px)`,
      }}
    >
      {contenido}
    </div>
  );
};
