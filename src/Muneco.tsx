import React from "react";
import type { Gesto, Personaje } from "./tipos";

export type V3 = [number, number, number];

export const Caja: React.FC<{
  p: V3;
  s: V3;
  c: string;
  r?: V3;
  brillo?: number;
}> = ({ p, s, c, r, brillo = 0 }) => (
  <mesh position={p} rotation={r}>
    <boxGeometry args={s} />
    <meshStandardMaterial
      color={c}
      flatShading
      roughness={0.85}
      emissive={c}
      emissiveIntensity={brillo}
    />
  </mesh>
);

export const OJOS = "#2b1a12";
export const BOCA = "#5b1620";
export const MEJILLA = "#f28b82";

export type MunecoProps = {
  tipo: Personaje;
  x: number;
  z: number;
  // 0..1 apertura de boca
  boca: number;
  gesto: Gesto;
  activo: boolean;
  // frames desde que empezó la escena actual
  t: number;
  frame: number;
  // x del personaje que está hablando, para mirarlo
  mirarX: number;
};

export type Pose = {
  y: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  escala: number;
  brazoI: number;
  brazoD: number;
  ojoY: number;
  ojoS: number;
  ceja: number; // >0 enojo, <0 triste
  rojo: number;
  bocaAlto: number;
  bocaAncho: number;
  g: Gesto;
};

// Animación común a todos los personajes según gesto y voz
export const calcularPose = ({
  x,
  boca,
  gesto,
  activo,
  t,
  frame,
  mirarX,
}: MunecoProps): Pose => {
  const fase = x * 3.1;
  const g = activo ? gesto : "normal";

  let y = Math.sin(frame / 14 + fase) * 0.03;
  let rotX = 0;
  let rotY = activo ? 0 : Math.max(-0.45, Math.min(0.45, (mirarX - x) * 0.22));
  let rotZ = 0;
  let escala = 1;
  let brazoI = -0.12 + Math.sin(frame / 10 + fase) * 0.06;
  let brazoD = 0.12 - Math.sin(frame / 10 + fase) * 0.06;
  let ojoY = 1;
  let ojoS = 1;
  let ceja = 0;
  let rojo = 0;

  if (activo) {
    y += boca * 0.05;
    rotZ = Math.sin(frame / 7) * 0.03;
  }

  switch (g) {
    case "celebrar":
      y += Math.abs(Math.sin(t / 5)) * 0.45;
      brazoI = -2.5 + Math.sin(t / 3) * 0.3;
      brazoD = 2.5 - Math.sin(t / 3) * 0.3;
      rotY = Math.sin(t / 9) * 0.25;
      break;
    case "burla":
      rotZ = Math.sin(t / 4) * 0.18;
      rotY = Math.sign(-x || 1) * 0.25;
      brazoI = x > 0 ? -1.4 : -0.2;
      brazoD = x > 0 ? 0.2 : 1.4;
      ojoY = 0.45;
      break;
    case "enojo":
      rotZ = Math.sin(t * 1.3) * 0.06;
      y += Math.abs(Math.sin(t / 2.5)) * 0.08;
      brazoI = -0.9 + Math.sin(t / 1.5) * 0.5;
      brazoD = 0.9 - Math.sin(t / 1.5) * 0.5;
      ceja = 1;
      rojo = 0.25 + Math.sin(t / 3) * 0.1;
      break;
    case "risa":
      y += Math.abs(Math.sin(t / 2)) * 0.12;
      rotX = -0.15;
      rotZ = Math.sin(t / 2.5) * 0.1;
      brazoI = 0.45;
      brazoD = -0.45;
      ojoY = 0.2;
      break;
    case "triste":
      rotX = 0.25;
      y -= 0.08;
      brazoI = 0.05;
      brazoD = -0.05;
      ceja = -1;
      ojoY = 0.8;
      break;
    case "sorpresa": {
      const pop = Math.max(0, 1 - t / 10);
      escala = 1 + pop * 0.25;
      y += pop * 0.3;
      brazoI = -1.9;
      brazoD = 1.9;
      ojoS = 1.35;
      break;
    }
  }

  // Parpadeo cada ~3.5 s
  const ciclo = (frame + Math.round(fase * 10)) % 105;
  if (ciclo < 4 && g !== "risa") ojoY *= 0.12;

  return {
    y,
    rotX,
    rotY,
    rotZ,
    escala,
    brazoI,
    brazoD,
    ojoY,
    ojoS,
    ceja,
    rojo,
    bocaAlto: 0.05 + boca * 0.24 + (g === "sorpresa" ? 0.12 : 0),
    bocaAncho: g === "risa" || g === "celebrar" ? 0.34 : 0.22 + boca * 0.06,
    g,
  };
};

// Medidas del cuerpo
const W = 1.4;
const H = 1.2;
const D = 1.1;
const CY = 1.0; // centro del cuerpo
const FZ = D / 2 + 0.02; // cara frontal

// Comentaristas: cubo con cara (merengue y culé)
export const Muneco: React.FC<MunecoProps> = (props) => {
  const { tipo, x, z, t } = props;
  const p = calcularPose(props);
  const esCule = tipo === "cule";
  const extremidad = esCule ? "#1d4fa3" : "#d9d4c7";

  const cuerpo = esCule ? (
    // Rayas azulgranas
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <Caja
          key={i}
          p={[-W / 2 + W / 10 + (i * W) / 5, CY, 0]}
          s={[W / 5 + 0.001, H, D]}
          c={i % 2 === 0 ? "#a50044" : "#1d4fa3"}
          brillo={p.rojo}
        />
      ))}
    </>
  ) : (
    <Caja p={[0, CY, 0]} s={[W, H, D]} c="#f4f1ea" brillo={p.rojo} />
  );

  return (
    <group position={[x, p.y, z]} rotation={[p.rotX, p.rotY, p.rotZ]} scale={p.escala}>
      {cuerpo}

      {/* Patas */}
      {[-0.42, 0.42].map((px) =>
        [-0.3, 0.3].map((pz) => (
          <Caja key={`${px}${pz}`} p={[px, 0.2, pz]} s={[0.26, 0.4, 0.26]} c={extremidad} />
        )),
      )}

      {/* Brazos con pivote en el hombro */}
      <group position={[-W / 2 - 0.12, CY + 0.25, 0]} rotation={[0, 0, p.brazoI]}>
        <Caja p={[0, -0.25, 0]} s={[0.22, 0.5, 0.3]} c={esCule ? "#a50044" : "#e9e4d8"} />
      </group>
      <group position={[W / 2 + 0.12, CY + 0.25, 0]} rotation={[0, 0, p.brazoD]}>
        <Caja p={[0, -0.25, 0]} s={[0.22, 0.5, 0.3]} c={esCule ? "#1d4fa3" : "#e9e4d8"} />
      </group>

      {/* Ojos */}
      {[-0.33, 0.33].map((ex) => (
        <group key={ex}>
          <Caja
            p={[ex, CY + 0.17, FZ]}
            s={[0.24 * p.ojoS, 0.3 * p.ojoY * p.ojoS, 0.04]}
            c={OJOS}
          />
          {p.ojoY > 0.5 && (
            <Caja p={[ex + 0.05, CY + 0.24, FZ + 0.025]} s={[0.07, 0.07, 0.02]} c="#ffffff" brillo={0.6} />
          )}
        </group>
      ))}

      {/* Cejas */}
      {p.ceja !== 0 &&
        [-0.33, 0.33].map((ex) => (
          <Caja
            key={`c${ex}`}
            p={[ex, CY + 0.42, FZ + 0.01]}
            s={[0.32, 0.06, 0.04]}
            r={[0, 0, (ex < 0 ? -0.4 : 0.4) * p.ceja]}
            c={OJOS}
          />
        ))}

      {/* Lágrimas */}
      {p.g === "triste" &&
        [-0.33, 0.33].map((ex) => (
          <Caja
            key={`l${ex}`}
            p={[ex, CY - 0.05 - ((t * 0.02 + (ex > 0 ? 0.15 : 0)) % 0.45), FZ + 0.02]}
            s={[0.08, 0.12, 0.03]}
            c="#6ec6ff"
            brillo={0.5}
          />
        ))}

      {/* Mejillas */}
      {[-0.5, 0.5].map((mx) => (
        <Caja key={`m${mx}`} p={[mx, CY - 0.06, FZ - 0.005]} s={[0.18, 0.08, 0.03]} c={MEJILLA} />
      ))}

      {/* Boca */}
      <Caja p={[0, CY - 0.12 - p.bocaAlto / 2, FZ]} s={[p.bocaAncho, p.bocaAlto, 0.04]} c={BOCA} />

      {/* Corona del merengue */}
      {tipo === "merengue" && (
        <group position={[0.15, CY + H / 2, 0]} rotation={[0, 0, -0.12]}>
          <Caja p={[0, 0.07, 0]} s={[0.75, 0.14, 0.55]} c="#f2b632" brillo={0.15} />
          {[-0.28, 0, 0.28].map((cx) => (
            <Caja key={cx} p={[cx, 0.24, 0]} s={[0.14, 0.2, 0.14]} c="#f2b632" brillo={0.15} />
          ))}
          <Caja p={[0, 0.07, 0.29]} s={[0.12, 0.08, 0.02]} c="#7b2cbf" brillo={0.3} />
        </group>
      )}

      {/* Bufanda azulgrana del culé */}
      {esCule && (
        <>
          <Caja p={[0, CY + H / 2 + 0.05, 0]} s={[0.9, 0.1, 0.7]} c="#ffcd00" />
          <Caja p={[0.25, CY + H / 2 + 0.16, 0]} s={[0.14, 0.14, 0.14]} c="#a50044" />
        </>
      )}
    </group>
  );
};
