import React from "react";
import { useThree } from "@react-three/fiber";

// La cancha está lejos del estudio; la cámara salta aquí durante las noticias de goles
export const CANCHA_X = 60;

const DESTINOS: [number, number][] = [
  [-1.2, 0.7],
  [1.15, 0.25],
  [0.3, 1.05],
  [-0.7, 0.2],
  [1.3, 1.0],
];

const B: React.FC<{
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  o?: number;
}> = ({ p, s, c, o }) => (
  <mesh position={p}>
    <boxGeometry args={s} />
    <meshStandardMaterial color={c} flatShading transparent={o !== undefined} opacity={o ?? 1} />
  </mesh>
);

// Progreso del tiro actual (0..1) y su índice
export const tiroActual = (t: number, dur: number, goles: number) => {
  const ventana = dur / Math.max(1, goles);
  const k = Math.min(goles - 1, Math.floor(t / ventana));
  return { k, p: (t - k * ventana) / ventana };
};

const CamaraCancha: React.FC<{ p: number }> = ({ p }) => {
  const camera = useThree((s) => s.camera);
  camera.position.set(CANCHA_X - 0.6, 4.2 - p * 0.4, 11 - p * 0.8);
  camera.lookAt(CANCHA_X, 0.4, -3.5);
  return null;
};

export const Cancha: React.FC<{ t: number; dur: number; goles: number; activa: boolean }> = ({
  t,
  dur,
  goles,
  activa,
}) => {
  const { k, p } = tiroActual(t, dur, goles);
  const [tx, ty] = DESTINOS[k % DESTINOS.length];

  // Balón: espera, vuela en parábola y queda en la red
  const vuelo = Math.min(1, Math.max(0, (p - 0.15) / 0.4));
  const inicio: [number, number, number] = [0.6, 0.25, 3];
  const fin: [number, number, number] = [tx, 0.25 + ty, -5.5];
  let bx = inicio[0] + (fin[0] - inicio[0]) * vuelo;
  let by = inicio[1] + (fin[1] - inicio[1]) * vuelo + Math.sin(vuelo * Math.PI) * 0.9;
  let bz = inicio[2] + (fin[2] - inicio[2]) * vuelo;
  if (p > 0.55) {
    const caida = Math.min(1, (p - 0.55) / 0.15);
    by = fin[1] + (0.25 - fin[1]) * caida;
    bz = -5.75;
    bx = fin[0];
  }
  const redBulto = p > 0.53 ? Math.max(0, 1 - (p - 0.53) / 0.2) * 0.35 : 0;

  // El portero se tira al lado contrario
  const salto = Math.min(1, Math.max(0, (p - 0.3) / 0.2));
  const porteroX = -Math.sign(tx || 1) * salto * 1.1;
  const porteroRot = -Math.sign(tx || 1) * salto * 1.2;

  // Pateador que corre hacia el balón
  const carrera = Math.min(1, p / 0.15);

  return (
    <group position={[CANCHA_X, 0, 0]}>
      {activa && <CamaraCancha p={p} />}
      <pointLight position={[0, 6, 4]} intensity={40} color="#ffffff" />

      {/* Tribunas al fondo y a los lados, con franjas de color */}
      {[0, 1, 2].map((nivel) => (
        <B key={`t${nivel}`} p={[0, 0.5 + nivel * 0.9, -9.5 - nivel * 0.9]} s={[24, 0.9, 1.2]} c={nivel % 2 ? "#243363" : "#1a2750"} />
      ))}
      {[-4, -2, 0, 2, 4].map((x) => (
        <B key={`f${x}`} p={[x * 2.4, 2.4, -8.8]} s={[1.6, 0.2, 0.2]} c={x % 4 === 0 ? "#f0a04b" : "#3a86ff"} o={undefined} />
      ))}
      <B p={[-12, 1.5, -2]} s={[1.2, 3, 16]} c="#1a2750" />
      <B p={[12, 1.5, -2]} s={[1.2, 3, 16]} c="#1a2750" />

      {/* Césped a rayas y líneas */}
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <B key={i} p={[0, -0.05, i * 3]} s={[16, 0.1, 3]} c={i % 2 ? "#1b7f3b" : "#22963f"} />
      ))}
      <B p={[0, 0.01, -5]} s={[9, 0.02, 0.1]} c="#ffffff" />
      <B p={[-3.5, 0.01, -3]} s={[0.1, 0.02, 4]} c="#ffffff" />
      <B p={[3.5, 0.01, -3]} s={[0.1, 0.02, 4]} c="#ffffff" />
      <B p={[0, 0.01, -1]} s={[7.1, 0.02, 0.1]} c="#ffffff" />
      <B p={[0, 0.01, 1.8]} s={[0.25, 0.02, 0.25]} c="#ffffff" />

      {/* Portería */}
      <B p={[-1.9, 0.85, -5]} s={[0.14, 1.7, 0.14]} c="#ffffff" />
      <B p={[1.9, 0.85, -5]} s={[0.14, 1.7, 0.14]} c="#ffffff" />
      <B p={[0, 1.7, -5]} s={[3.94, 0.14, 0.14]} c="#ffffff" />
      <B p={[0, 0.85, -6 - redBulto]} s={[3.8, 1.7, 0.03]} c="#ffffff" o={0.3} />
      <B p={[-1.9, 0.85, -5.5]} s={[0.03, 1.7, 1]} c="#ffffff" o={0.25} />
      <B p={[1.9, 0.85, -5.5]} s={[0.03, 1.7, 1]} c="#ffffff" o={0.25} />
      <B p={[0, 1.7, -5.5]} s={[3.8, 0.03, 1]} c="#ffffff" o={0.25} />

      {/* Portero */}
      <group position={[porteroX, 0, -4.6]} rotation={[0, 0, porteroRot]}>
        <B p={[0, 0.75, 0]} s={[0.55, 0.7, 0.35]} c="#2ec4b6" />
        <B p={[0, 1.3, 0]} s={[0.42, 0.4, 0.4]} c="#f0c08a" />
        <B p={[-0.38, 1.05, 0]} s={[0.18, 0.5, 0.18]} c="#2ec4b6" />
        <B p={[0.38, 1.05, 0]} s={[0.18, 0.5, 0.18]} c="#2ec4b6" />
        <B p={[-0.14, 0.2, 0]} s={[0.18, 0.4, 0.18]} c="#222" />
        <B p={[0.14, 0.2, 0]} s={[0.18, 0.4, 0.18]} c="#222" />
      </group>

      {/* Pateador */}
      <group position={[1.6 - carrera * 0.9, Math.abs(Math.sin(carrera * 9)) * 0.08, 3.6 - carrera * 0.3]}>
        <B p={[0, 0.75, 0]} s={[0.55, 0.7, 0.35]} c="#ffd166" />
        <B p={[0, 1.3, 0]} s={[0.42, 0.4, 0.4]} c="#c68b59" />
        <B p={[-0.14, 0.2, 0]} s={[0.18, 0.4, 0.18]} c="#222" />
        <group position={[0.14, 0.4, 0]} rotation={[p > 0.12 && p < 0.25 ? -1.1 : 0, 0, 0]}>
          <B p={[0, -0.2, 0]} s={[0.18, 0.4, 0.18]} c="#222" />
        </group>
      </group>

      {/* Balón */}
      <mesh position={[bx, by, bz]} rotation={[vuelo * 12, vuelo * 6, 0]}>
        <icosahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color="#ffffff" flatShading emissive="#ffffff" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
};
