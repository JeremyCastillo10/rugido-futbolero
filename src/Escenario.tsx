import React from "react";
import { useThree } from "@react-three/fiber";
import { interpolate, Easing } from "remotion";
import { Muneco } from "./Muneco";
import { Leon } from "./Leon";
import { Cancha } from "./Cancha";
import { PERSONAJES, type Gesto, type Personaje } from "./tipos";

const NARANJA = "#f0a04b";
const NOCHE = "#0d1638";

type Toma = { x: number; y: number; dist: number };

const tomaDe = (p: Personaje | null): Toma => {
  if (!p || p === "presentador") return { x: 0, y: 1.5, dist: 13.5 };
  return { x: PERSONAJES[p].x * 1.05, y: 1.15, dist: 7.4 };
};

const Camara: React.FC<{
  antes: Personaje | null;
  ahora: Personaje | null;
  t: number;
}> = ({ antes, ahora, t }) => {
  const camera = useThree((s) => s.camera);
  const a = tomaDe(antes);
  const b = tomaDe(ahora);
  const k = interpolate(t, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  // Pequeño acercamiento lento durante la escena
  const empuje = Math.min(t, 150) * 0.004;
  const x = a.x + (b.x - a.x) * k;
  const y = a.y + (b.y - a.y) * k;
  const dist = a.dist + (b.dist - a.dist) * k - empuje;
  camera.position.set(x, y + 1.1, dist);
  camera.lookAt(x, y, 0);
  return null;
};

const Balon: React.FC<{ frame: number }> = ({ frame }) => (
  <group position={[0, 4.3, -2.6]} rotation={[frame / 40, frame / 25, 0]}>
    <mesh>
      <icosahedronGeometry args={[0.9, 1]} />
      <meshStandardMaterial color="#ffffff" flatShading roughness={0.6} emissive="#ffffff" emissiveIntensity={0.25} />
    </mesh>
    {/* Parches negros en los vértices del icosaedro */}
    {[
      [0, 1, 1.618], [0, -1, 1.618], [0, 1, -1.618], [0, -1, -1.618],
      [1, 1.618, 0], [-1, 1.618, 0], [1, -1.618, 0], [-1, -1.618, 0],
      [1.618, 0, 1], [-1.618, 0, 1], [1.618, 0, -1], [-1.618, 0, -1],
    ].map(([a, b, c], k) => (
      <mesh key={k} position={[a * 0.47, b * 0.47, c * 0.47]}>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshStandardMaterial color="#1a1a2e" flatShading />
      </mesh>
    ))}
  </group>
);

// Corona de la marca, hecha con cajas
const Corona: React.FC<{ p: [number, number, number]; s: number; c: string }> = ({ p, s, c }) => (
  <group position={p} scale={s}>
    <mesh position={[0, -0.05, 0]}>
      <boxGeometry args={[1, 0.22, 0.12]} />
      <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} flatShading />
    </mesh>
    {[-0.4, 0, 0.4].map((x) => (
      <mesh key={x} position={[x, 0.2, 0]}>
        <boxGeometry args={[0.2, 0.3, 0.12]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} flatShading />
      </mesh>
    ))}
  </group>
);

// Pantalla de fondo: panel LED con pulso suave
const Pantalla: React.FC<{
  p: [number, number, number];
  s: [number, number, number];
  color: string;
  intensidad: number;
}> = ({ p, s, color, intensidad }) => (
  <mesh position={p}>
    <boxGeometry args={s} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensidad} flatShading />
  </mesh>
);

export const Escenario: React.FC<{
  frame: number;
  hablando: Personaje | null;
  anterior: Personaje | null;
  gesto: Gesto;
  boca: number;
  t: number;
  // Si la escena es de goles, la cámara va a la cancha
  goles?: { cantidad: number; dur: number };
}> = ({ frame, hablando, anterior, gesto, boca, t, goles }) => {
  const mirarX = hablando ? PERSONAJES[hablando].x : 0;
  const pulso = 0.3 + Math.sin(frame / 14) * 0.08;
  return (
    <>
      <color attach="background" args={["#060b1f"]} />
      <fog attach="fog" args={["#060b1f", 11, 26]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 6, 6]} intensity={1.5} />
      <pointLight position={[-4, 3, 2]} intensity={22} color="#3a86ff" />
      <pointLight position={[4, 3, 2]} intensity={22} color="#3a86ff" />
      <pointLight position={[0, 1.6, 2.6]} intensity={14} color={NARANJA} />

      {goles ? null : <Camara antes={anterior} ahora={hablando} t={t} />}
      <Cancha
        t={t}
        dur={goles?.dur ?? 1}
        goles={goles?.cantidad ?? 1}
        activa={Boolean(goles)}
      />

      {/* Muro del set */}
      <Pantalla p={[0, 4.5, -3.2]} s={[18, 9, 0.2]} color="#0a1230" intensidad={0} />
      {/* Panel central con la marca */}
      <Pantalla p={[0, 4.0, -3.05]} s={[6.2, 3.4, 0.12]} color="#0f2f6b" intensidad={pulso + 0.1} />
      <Pantalla p={[0, 4.0, -2.98]} s={[6.0, 0.08, 0.02]} color={NARANJA} intensidad={0.6} />
      <Corona p={[0, 5.95, -2.95]} s={0.55} c={NARANJA} />
      {/* Pantalla central con un campo y luces de la grada, como en el mockup */}
      <Pantalla p={[0, 2.6, -2.99]} s={[6.0, 0.9, 0.03]} color="#1b7f3b" intensidad={0.45} />
      {Array.from({ length: 36 }, (_, i) => (
        <Pantalla
          key={`luz${i}`}
          p={[-2.8 + (i % 12) * 0.52, 3.55 + Math.floor(i / 12) * 0.5, -2.97]}
          s={[0.14, 0.14, 0.02]}
          color={i % 3 === 0 ? NARANJA : "#dfe9ff"}
          intensidad={0.5 + Math.sin(frame / 9 + i) * 0.3}
        />
      ))}
      {/* Paneles laterales */}
      <Pantalla p={[-4.9, 3.6, -3.0]} s={[2.9, 4.4, 0.12]} color="#123a86" intensidad={pulso} />
      <Pantalla p={[4.9, 3.6, -3.0]} s={[2.9, 4.4, 0.12]} color="#1b4fa8" intensidad={pulso} />
      {/* Menú lateral derecho */}
      <Pantalla p={[6.7, 3.0, -2.9]} s={[2.4, 3.6, 0.1]} color={NOCHE} intensidad={0} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Pantalla
          key={i}
          p={[6.7, 4.5 - i * 0.6, -2.84]}
          s={[1.6, 0.14, 0.02]}
          color={i === 0 ? NARANJA : "#3a86ff"}
          intensidad={i === 0 ? 0.7 : 0.35}
        />
      ))}
      <Balon frame={frame} />

      {/* Piso oscuro con anillo naranja */}
      <mesh position={[0, -0.05, 0.5]}>
        <boxGeometry args={[18, 0.1, 12]} />
        <meshStandardMaterial color="#0a1028" roughness={0.3} metalness={0.2} flatShading />
      </mesh>
      <mesh position={[0, 0.01, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[5.2, 0.05, 8, 96]} />
        <meshStandardMaterial color={NARANJA} emissive={NARANJA} emissiveIntensity={0.9} />
      </mesh>

      {(Object.keys(PERSONAJES) as Personaje[]).map((p) => {
        const Componente = p === "presentador" ? Leon : Muneco;
        return (
          <Componente
            key={p}
            tipo={p}
            x={PERSONAJES[p].x}
            z={PERSONAJES[p].z}
            activo={p === hablando}
            boca={p === hablando ? boca : 0}
            gesto={p === hablando ? gesto : "normal"}
            t={t}
            frame={frame}
            mirarX={mirarX}
          />
        );
      })}

      {/* Laptop y taza del presentador */}
      <group position={[0.15, 0.8, 1.0]}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.9, 0.05, 0.6]} />
          <meshStandardMaterial color="#3a3d4a" flatShading />
        </mesh>
        <mesh position={[0, 0.3, -0.28]} rotation={[-0.25, 0, 0]}>
          <boxGeometry args={[0.9, 0.58, 0.04]} />
          <meshStandardMaterial color="#2b2e38" flatShading />
        </mesh>
      </group>
      <group position={[-1.05, 0.95, 1.1]}>
        <mesh>
          <boxGeometry args={[0.26, 0.3, 0.26]} />
          <meshStandardMaterial color="#15151b" flatShading />
        </mesh>
        <mesh position={[0.17, 0, 0]}>
          <boxGeometry args={[0.08, 0.16, 0.06]} />
          <meshStandardMaterial color="#15151b" flatShading />
        </mesh>
      </group>

      {/* Mesa del noticiero: cuerpo oscuro, tapa y franja naranja */}
      <mesh position={[0, 0.36, 1.15]}>
        <boxGeometry args={[8.0, 0.66, 1.1]} />
        <meshStandardMaterial color={NOCHE} flatShading />
      </mesh>
      <mesh position={[0, 0.74, 1.15]}>
        <boxGeometry args={[8.2, 0.12, 1.3]} />
        <meshStandardMaterial color="#18214a" flatShading />
      </mesh>
      <mesh position={[0, 0.52, 1.71]}>
        <boxGeometry args={[7.6, 0.06, 0.03]} />
        <meshStandardMaterial color={NARANJA} emissive={NARANJA} emissiveIntensity={0.9} />
      </mesh>
      <Corona p={[0, 0.36, 1.73]} s={0.42} c={NARANJA} />
    </>
  );
};
