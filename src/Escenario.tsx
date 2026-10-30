import React from "react";
import { useThree } from "@react-three/fiber";
import { interpolate, Easing } from "remotion";
import { Hincha } from "./Hincha";
import { Leon } from "./Leon";
import { Cancha } from "./Cancha";
import { PERSONAJES, type Gesto, type Personaje } from "./tipos";

type Toma = { x: number; y: number; dist: number };

const tomaDe = (p: Personaje | null): Toma => {
  if (!p || p === "presentador") return { x: 0, y: 1.45, dist: 14 };
  return { x: PERSONAJES[p].x * 1.02, y: 1.35, dist: 8.8 };
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
  return (
    <>
      <color attach="background" args={["#0b1230"]} />
      <fog attach="fog" args={["#0b1230", 9, 24]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[2, 6, 6]} intensity={1.6} />
      <pointLight position={[-4, 3, 2]} intensity={25} color="#9d4edd" />
      <pointLight position={[4, 3, 2]} intensity={25} color="#3a86ff" />

      {goles ? null : <Camara antes={anterior} ahora={hablando} t={t} />}
      <Cancha
        t={t}
        dur={goles?.dur ?? 1}
        goles={goles?.cantidad ?? 1}
        activa={Boolean(goles)}
      />

      {/* Pared y pantalla del estudio */}
      <mesh position={[0, 3, -3.2]}>
        <boxGeometry args={[16, 9, 0.2]} />
        <meshStandardMaterial color="#141b45" flatShading />
      </mesh>
      <mesh position={[0, 4.2, -3.0]}>
        <boxGeometry args={[5.2, 2.8, 0.15]} />
        <meshStandardMaterial color="#0f3d7a" emissive="#1f6feb" emissiveIntensity={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 4.2, 3.2, -3.0]}>
          <boxGeometry args={[0.4, 4.5, 0.2]} />
          <meshStandardMaterial
            color={s < 0 ? "#7b2cbf" : "#3a86ff"}
            emissive={s < 0 ? "#7b2cbf" : "#3a86ff"}
            emissiveIntensity={0.6 + Math.sin(frame / 12 + s) * 0.25}
          />
        </mesh>
      ))}
      <Balon frame={frame} />

      {/* Piso tipo césped en voxeles */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[16, 0.1, 12]} />
        <meshStandardMaterial color="#1b7f3b" flatShading />
      </mesh>
      {[-3, -1, 1, 3].map((fx) => (
        <mesh key={fx} position={[fx * 1.5, 0.001, 0]}>
          <boxGeometry args={[1.5, 0.1, 12]} />
          <meshStandardMaterial color="#22963f" flatShading />
        </mesh>
      ))}

      {(Object.keys(PERSONAJES) as Personaje[]).map((p) => {
        const Componente = p === "presentador" ? Leon : Hincha;
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
      <group position={[0.15, 0.7, 1.0]}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[0.9, 0.05, 0.6]} />
          <meshStandardMaterial color="#3a3d4a" flatShading />
        </mesh>
        <mesh position={[0, 0.3, -0.28]} rotation={[-0.25, 0, 0]}>
          <boxGeometry args={[0.9, 0.58, 0.04]} />
          <meshStandardMaterial color="#2b2e38" flatShading />
        </mesh>
      </group>
      <group position={[-1.05, 0.82, 1.1]}>
        <mesh>
          <boxGeometry args={[0.26, 0.3, 0.26]} />
          <meshStandardMaterial color="#15151b" flatShading />
        </mesh>
        <mesh position={[0.17, 0, 0]}>
          <boxGeometry args={[0.08, 0.16, 0.06]} />
          <meshStandardMaterial color="#15151b" flatShading />
        </mesh>
      </group>

      {/* Mesa del noticiero */}
      <mesh position={[0, 0.32, 1.15]}>
        <boxGeometry args={[7.8, 0.64, 0.9]} />
        <meshStandardMaterial color="#1d3557" flatShading />
      </mesh>
      <mesh position={[0, 0.66, 1.15]}>
        <boxGeometry args={[8.0, 0.08, 1.0]} />
        <meshStandardMaterial color="#e63946" flatShading />
      </mesh>
      <mesh position={[0, 0.32, 1.61]}>
        <boxGeometry args={[3.2, 0.3, 0.02]} />
        <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={0.4} />
      </mesh>
    </>
  );
};
