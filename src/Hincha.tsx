import React from "react";
import { Caja, BOCA, MEJILLA, OJOS, calcularPose, type MunecoProps } from "./Muneco";

type Estilo = {
  piel: string;
  pelo: string;
  camiseta: string[]; // una o varias rayas verticales
  detalle: string; // cuello y puños
  short: string;
};

const ESTILOS: Record<"merengue" | "cule", Estilo> = {
  merengue: {
    piel: "#f2c9a0",
    pelo: "#e8c25a",
    camiseta: ["#f7f7f2"],
    detalle: "#6a3fb5",
    short: "#f7f7f2",
  },
  cule: {
    piel: "#d9a47a",
    pelo: "#2b1d16",
    camiseta: ["#a50044", "#1d4fa3", "#a50044", "#1d4fa3", "#a50044"],
    detalle: "#ffcd00",
    short: "#1d4fa3",
  },
};

const CABEZA_Y = 1.92;
const FZ = 0.5; // cara frontal de la cabeza

// Comentaristas: hinchas chibi de cabeza grande con la camiseta de su equipo (sin escudos)
export const Hincha: React.FC<MunecoProps> = (props) => {
  const { tipo, x, z, t } = props;
  const e = ESTILOS[tipo === "cule" ? "cule" : "merengue"];
  const p = calcularPose(props);
  const W = 1.1;
  const rayas = e.camiseta.length;
  const dientes = p.bocaAlto > 0.11;

  return (
    <group position={[x, p.y, z]} rotation={[p.rotX * 0.4, p.rotY, p.rotZ * 0.5]} scale={p.escala}>
      {/* Piernas y zapatos */}
      {[-0.25, 0.25].map((lx) => (
        <group key={lx}>
          <Caja p={[lx, 0.32, 0]} s={[0.3, 0.3, 0.32]} c={e.short} />
          <Caja p={[lx, 0.12, 0]} s={[0.26, 0.2, 0.28]} c={e.piel} />
          <Caja p={[lx, 0.04, 0.05]} s={[0.3, 0.1, 0.4]} c="#222" />
        </group>
      ))}

      {/* Camiseta */}
      {e.camiseta.map((c, i) => (
        <Caja
          key={i}
          p={[-W / 2 + W / rayas / 2 + (i * W) / rayas, 0.9, 0]}
          s={[W / rayas + 0.001, 0.85, 0.72]}
          c={c}
          brillo={p.rojo}
        />
      ))}
      <Caja p={[0, 1.3, 0.05]} s={[0.5, 0.08, 0.6]} c={e.detalle} />
      <Caja p={[0, 1.36, 0]} s={[0.3, 0.12, 0.3]} c={e.piel} />

      {/* Bufanda del culé */}
      {tipo === "cule" && (
        <>
          <Caja p={[0, 1.33, 0.02]} s={[0.95, 0.16, 0.78]} c="#ffcd00" />
          <Caja p={[0.28, 1.05, 0.39]} s={[0.18, 0.45, 0.04]} c="#a50044" />
          <Caja p={[0.28, 0.83, 0.39]} s={[0.18, 0.06, 0.05]} c="#ffcd00" />
        </>
      )}

      {/* Brazos: manga, brazo y mano */}
      {[-1, 1].map((lado) => (
        <group
          key={lado}
          position={[lado * (W / 2 + 0.14), 1.2, 0]}
          rotation={[0, 0, lado < 0 ? p.brazoI : p.brazoD]}
        >
          <Caja p={[0, -0.12, 0]} s={[0.28, 0.26, 0.32]} c={lado < 0 ? e.camiseta[0] : e.camiseta[rayas - 1]} />
          <Caja p={[0, -0.12, 0]} s={[0.29, 0.06, 0.33]} c={e.detalle} />
          <Caja p={[0, -0.38, 0]} s={[0.22, 0.28, 0.24]} c={e.piel} />
          <Caja p={[0, -0.58, 0.02]} s={[0.27, 0.18, 0.28]} c={e.piel} />
        </group>
      ))}

      {/* Cabeza */}
      <group position={[0, CABEZA_Y, 0]} rotation={[p.rotX, 0, p.rotZ]}>
        <Caja p={[0, 0, 0]} s={[1.15, 1.05, 1.0]} c={e.piel} brillo={p.rojo} />
        {/* Orejas */}
        {[-0.61, 0.61].map((ox) => (
          <Caja key={ox} p={[ox, -0.02, 0]} s={[0.1, 0.24, 0.18]} c={e.piel} />
        ))}

        {/* Pelo */}
        {tipo === "merengue" ? (
          <>
            <Caja p={[0, 0.56, -0.02]} s={[1.2, 0.18, 1.06]} c={e.pelo} />
            <Caja p={[0, 0.25, -0.53]} s={[1.2, 0.72, 0.12]} c={e.pelo} />
            {[-0.6, 0.6].map((px) => (
              <Caja key={px} p={[px, 0.3, -0.1]} s={[0.1, 0.4, 0.8]} c={e.pelo} />
            ))}
            {/* Copete engominado */}
            <Caja p={[0.15, 0.72, 0.32]} s={[0.7, 0.2, 0.36]} c={e.pelo} r={[0.35, 0, 0]} />
            <Caja p={[0.22, 0.86, 0.42]} s={[0.46, 0.16, 0.22]} c="#f3d77a" r={[0.5, 0, 0]} />
          </>
        ) : (
          <>
            <Caja p={[0, 0.55, -0.02]} s={[1.18, 0.16, 1.04]} c={e.pelo} />
            <Caja p={[0, 0.2, -0.53]} s={[1.18, 0.8, 0.12]} c={e.pelo} />
            {/* Rizos */}
            {[
              [-0.42, 0.7, 0.25], [-0.12, 0.74, 0.3], [0.2, 0.71, 0.28], [0.45, 0.68, 0.2],
              [-0.3, 0.72, -0.15], [0.05, 0.76, -0.1], [0.35, 0.73, -0.2],
              [-0.6, 0.42, 0.1], [0.6, 0.42, 0.1], [-0.6, 0.42, -0.3], [0.6, 0.42, -0.3],
            ].map(([rx, ry, rz], k) => (
              <Caja key={k} p={[rx, ry, rz]} s={[0.26, 0.24, 0.26]} c={k % 2 ? "#3a2a20" : e.pelo} />
            ))}
          </>
        )}

        {/* Corona pequeña del merengue, ladeada sobre el copete */}
        {tipo === "merengue" && (
          <group position={[-0.28, 0.78, 0]} rotation={[0, 0, 0.25]}>
            <Caja p={[0, 0, 0]} s={[0.5, 0.1, 0.4]} c="#f2b632" brillo={0.2} />
            {[-0.17, 0, 0.17].map((cx) => (
              <Caja key={cx} p={[cx, 0.12, 0]} s={[0.09, 0.14, 0.09]} c="#f2b632" brillo={0.2} />
            ))}
          </group>
        )}

        {/* Ojos */}
        {[-0.25, 0.25].map((ex) => (
          <group key={ex}>
            <Caja p={[ex, 0.08, FZ + 0.01]} s={[0.25 * p.ojoS, 0.27 * p.ojoY * p.ojoS, 0.03]} c="#ffffff" />
            <Caja
              p={[ex + 0.025, 0.06, FZ + 0.03]}
              s={[0.14 * p.ojoS, 0.2 * p.ojoY * p.ojoS, 0.03]}
              c={OJOS}
            />
            {p.ojoY > 0.5 && (
              <Caja p={[ex + 0.065, 0.12, FZ + 0.05]} s={[0.05, 0.05, 0.02]} c="#ffffff" brillo={0.6} />
            )}
          </group>
        ))}

        {/* Cejas, siempre visibles para dar expresión */}
        {[-0.25, 0.25].map((ex) => (
          <Caja
            key={`c${ex}`}
            p={[ex, 0.3, FZ + 0.02]}
            s={[0.28, 0.06, 0.04]}
            r={[0, 0, (ex < 0 ? -0.4 : 0.4) * p.ceja + (ex < 0 ? 0.08 : -0.08)]}
            c={tipo === "cule" ? "#2b1d16" : "#b8912e"}
          />
        ))}

        {/* Lágrimas */}
        {p.g === "triste" &&
          [-0.25, 0.25].map((ex) => (
            <Caja
              key={`l${ex}`}
              p={[ex, -0.08 - ((t * 0.02 + (ex > 0 ? 0.15 : 0)) % 0.4), FZ + 0.03]}
              s={[0.07, 0.11, 0.03]}
              c="#6ec6ff"
              brillo={0.5}
            />
          ))}

        {/* Nariz y mejillas */}
        <Caja p={[0, -0.08, FZ + 0.04]} s={[0.12, 0.12, 0.08]} c={tipo === "cule" ? "#c48c64" : "#e8b48a"} />
        {[-0.4, 0.4].map((mx) => (
          <Caja key={`m${mx}`} p={[mx, -0.12, FZ + 0.005]} s={[0.16, 0.07, 0.02]} c={MEJILLA} />
        ))}

        {/* Boca con dientes cuando se abre */}
        <Caja
          p={[0, -0.24 - p.bocaAlto / 2, FZ + 0.01]}
          s={[p.bocaAncho * 1.15, p.bocaAlto, 0.03]}
          c={BOCA}
        />
        {dientes && (
          <Caja
            p={[0, -0.24 - 0.025, FZ + 0.025]}
            s={[p.bocaAncho * 0.95, 0.05, 0.02]}
            c="#ffffff"
          />
        )}
        {dientes && (
          <Caja
            p={[0, -0.24 - p.bocaAlto + 0.03, FZ + 0.025]}
            s={[p.bocaAncho * 0.6, 0.04, 0.02]}
            c="#e05a6a"
          />
        )}
      </group>
    </group>
  );
};
