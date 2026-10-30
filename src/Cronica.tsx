import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Rubik";
import { CUENTA } from "./tipos";

const { fontFamily } = loadFont("normal", { weights: ["700", "900"] });

export type CronicaProps = {
  local: string;
  visitante: string;
  golesLocal: number;
  golesVisitante: number;
  competicion: string;
  fecha: string;
  titular: string;
  estadio?: string;
  foto?: string;
  credito?: string;
};

const AMARILLO = "#ffd166";
const AZUL = "#0b1230";

// Imagen de la crónica para el feed (1080x1350): marcador final sobre foto libre del estadio
export const Cronica: React.FC<CronicaProps> = (p) => (
  <AbsoluteFill style={{ fontFamily, backgroundColor: AZUL }}>
    {p.foto && (
      <Img
        src={staticFile(p.foto)}
        style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }}
      />
    )}
    <AbsoluteFill
      style={{ background: "linear-gradient(180deg, rgba(11,18,48,.55) 0%, rgba(11,18,48,.85) 55%, rgba(11,18,48,.97) 100%)" }}
    />

    <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16 }}>
      <div style={{ background: "#e63946", color: "white", fontWeight: 900, fontSize: 40, padding: "10px 26px", borderRadius: 14 }}>
        FINAL
      </div>
      <div style={{ background: "white", color: AZUL, fontWeight: 900, fontSize: 40, padding: "10px 26px", borderRadius: 14 }}>
        {p.competicion.toUpperCase()}
      </div>
    </div>

    {/* Marcador */}
    <div
      style={{
        position: "absolute",
        top: 330,
        left: 60,
        right: 60,
        background: "rgba(11,18,48,.9)",
        border: `8px solid ${AMARILLO}`,
        borderRadius: 36,
        padding: "40px 46px",
        display: "flex",
        flexDirection: "column",
        gap: 28,
        boxShadow: "0 18px 0 rgba(0,0,0,.4)",
      }}
    >
      {[
        [p.local, p.golesLocal],
        [p.visitante, p.golesVisitante],
      ].map(([nombre, goles]) => (
        <div key={String(nombre)} style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ flex: 1, color: "white", fontWeight: 900, fontSize: 68, lineHeight: 1.05 }}>{nombre}</div>
          <div
            style={{
              background: AMARILLO,
              color: AZUL,
              fontWeight: 900,
              fontSize: 130,
              width: 190,
              textAlign: "center",
              borderRadius: 24,
            }}
          >
            {goles}
          </div>
        </div>
      ))}
      <div style={{ textAlign: "center", color: "rgba(255,255,255,.75)", fontSize: 32, fontWeight: 700 }}>
        {p.fecha}
        {p.estadio ? ` · ${p.estadio}` : ""}
      </div>
    </div>

    {/* Titular */}
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        top: 900,
        color: "white",
        fontWeight: 900,
        fontSize: 64,
        lineHeight: 1.1,
        textShadow: "0 6px 0 #000",
      }}
    >
      {p.titular}
    </div>

    {/* Marca del canal y crédito de la foto */}
    <div
      style={{
        position: "absolute",
        bottom: 50,
        left: 60,
        right: 60,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}
    >
      <div style={{ background: AMARILLO, color: AZUL, fontWeight: 900, fontSize: 38, padding: "10px 24px", borderRadius: 14 }}>
        {CUENTA}
      </div>
      {p.credito && (
        <div style={{ color: "rgba(255,255,255,.8)", fontSize: 20, fontWeight: 700, maxWidth: 420, textAlign: "right" }}>
          {p.credito}
        </div>
      )}
    </div>
  </AbsoluteFill>
);
