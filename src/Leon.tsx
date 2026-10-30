import React from "react";
import { Caja, BOCA, MEJILLA, OJOS, calcularPose, type MunecoProps, type V3 } from "./Muneco";

const PIEL = "#e8913a";
const HOCICO = "#f6d7a8";
const SUDADERA = "#17171f";
const NARANJA = "#f0a04b";
const MELENA = ["#8a3f1c", "#a8522a", "#6e3015"];

const CABEZA_Y = 1.95;
const FZ = 0.5; // cara frontal de la cabeza

// Mechones de la melena alrededor de la cabeza (fijos para que no cambien entre frames)
const MECHONES: { p: V3; s: number; c: string }[] = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2;
  const r = 0.82 + (i % 3) * 0.07;
  return {
    p: [Math.cos(a) * r, Math.sin(a) * r * 0.95 + 0.05, -0.12 - (i % 2) * 0.08],
    s: 0.36 + (i % 4) * 0.05,
    c: MELENA[i % 3],
  };
});

// Presentador: león voxel con sudadera negra
export const Leon: React.FC<MunecoProps> = (props) => {
  const { x, z } = props;
  const p = calcularPose(props);

  return (
    <group position={[x, p.y, z]} rotation={[p.rotX * 0.5, p.rotY, p.rotZ * 0.5]} scale={p.escala}>
      {/* Sudadera */}
      <Caja p={[0, 0.85, 0]} s={[1.35, 1.0, 0.9]} c={SUDADERA} brillo={p.rojo} />
      <Caja p={[0, 1.42, -0.32]} s={[1.0, 0.3, 0.35]} c="#26262f" />
      {/* Cordones */}
      {[-0.18, 0.18].map((cx) => (
        <Caja key={cx} p={[cx, 1.12, 0.46]} s={[0.04, 0.3, 0.03]} c={NARANJA} brillo={0.2} />
      ))}
      {/* Corona naranja en el pecho, como en el mockup */}
      <Caja p={[0, 0.72, 0.46]} s={[0.4, 0.07, 0.03]} c={NARANJA} brillo={0.4} />
      {[-0.15, 0, 0.15].map((cx) => (
        <Caja key={cx} p={[cx, 0.8, 0.46]} s={[0.07, 0.12, 0.03]} c={NARANJA} brillo={0.4} />
      ))}

      {/* Brazos: manga negra y garra */}
      {[-1, 1].map((lado) => (
        <group
          key={lado}
          position={[lado * 0.8, 1.2, 0]}
          rotation={[0, 0, lado < 0 ? p.brazoI : p.brazoD]}
        >
          <Caja p={[0, -0.28, 0]} s={[0.32, 0.6, 0.38]} c={SUDADERA} />
          <Caja p={[0, -0.66, 0.02]} s={[0.36, 0.22, 0.4]} c={PIEL} />
        </group>
      ))}

      {/* Cabeza */}
      <group position={[0, CABEZA_Y, 0]} rotation={[p.rotX, 0, p.rotZ]}>
        {/* Melena */}
        <Caja p={[0, 0.05, -0.32]} s={[1.75, 1.65, 0.5]} c={MELENA[0]} />
        {MECHONES.map((m, i) => (
          <Caja key={i} p={m.p} s={[m.s, m.s, m.s]} c={m.c} />
        ))}

        <Caja p={[0, 0, 0]} s={[1.2, 1.05, 1.0]} c={PIEL} brillo={p.rojo} />

        {/* Orejas */}
        {[-0.48, 0.48].map((ox) => (
          <group key={ox}>
            <Caja p={[ox, 0.6, 0.05]} s={[0.28, 0.26, 0.18]} c={PIEL} />
            <Caja p={[ox, 0.6, 0.15]} s={[0.14, 0.13, 0.02]} c="#f5a3a3" />
          </group>
        ))}

        {/* Ojos con blanco, pupila y brillo */}
        {[-0.26, 0.26].map((ex) => (
          <group key={ex}>
            <Caja
              p={[ex, 0.14, FZ + 0.01]}
              s={[0.26 * p.ojoS, 0.28 * p.ojoY * p.ojoS, 0.03]}
              c="#ffffff"
            />
            <Caja
              p={[ex + 0.03, 0.12, FZ + 0.03]}
              s={[0.15 * p.ojoS, 0.22 * p.ojoY * p.ojoS, 0.03]}
              c={OJOS}
            />
            {p.ojoY > 0.5 && (
              <Caja p={[ex + 0.07, 0.19, FZ + 0.05]} s={[0.05, 0.05, 0.02]} c="#ffffff" brillo={0.6} />
            )}
          </group>
        ))}

        {/* Cejas gruesas, siempre visibles */}
        {[-0.26, 0.26].map((ex) => (
          <Caja
            key={`c${ex}`}
            p={[ex, 0.36, FZ + 0.02]}
            s={[0.3, 0.07, 0.04]}
            r={[0, 0, (ex < 0 ? -0.35 : 0.35) * p.ceja + (ex < 0 ? 0.1 : -0.1)]}
            c="#6e3015"
          />
        ))}

        {/* Mejillas */}
        {[-0.42, 0.42].map((mx) => (
          <Caja key={`m${mx}`} p={[mx, -0.12, FZ + 0.005]} s={[0.16, 0.08, 0.02]} c={MEJILLA} />
        ))}

        {/* Hocico, nariz y boca */}
        <Caja p={[0, -0.2, FZ + 0.06]} s={[0.62, 0.36, 0.14]} c={HOCICO} />
        <Caja p={[0, -0.06, FZ + 0.14]} s={[0.22, 0.12, 0.06]} c="#5a2d1a" />
        <Caja
          p={[0, -0.27 - p.bocaAlto / 2, FZ + 0.14]}
          s={[p.bocaAncho * 1.1, p.bocaAlto, 0.03]}
          c={BOCA}
        />
        {p.bocaAlto > 0.12 && (
          <Caja
            p={[0, -0.27 - p.bocaAlto + 0.04, FZ + 0.155]}
            s={[p.bocaAncho * 0.6, 0.05, 0.02]}
            c="#e05a6a"
          />
        )}
      </group>
    </group>
  );
};
