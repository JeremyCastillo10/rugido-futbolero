import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { loadFont } from "@remotion/google-fonts/Rubik";
import { Leon } from "./Leon";
import { Muneco } from "./Muneco";

const { fontFamily } = loadFont("normal", { weights: ["700", "900"] });

const Camara: React.FC = () => {
  const camera = useThree((s) => s.camera);
  camera.position.set(0.9, 2.4, 11);
  camera.lookAt(0.9, 1.5, 0);
  return null;
};

// Portada de Facebook (1640x624): el estudio con los tres personajes y el nombre del canal
export const Portada: React.FC = () => {
  const { width, height } = useVideoConfig();
  const comun = { t: 4, frame: 30, boca: 0.4 };
  return (
    <AbsoluteFill style={{ fontFamily, background: "#0b1230" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 32 }}>
        <Camara />
        <color attach="background" args={["#0b1230"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 6, 6]} intensity={1.6} />
        <pointLight position={[-6, 3, 2]} intensity={30} color="#9d4edd" />
        <pointLight position={[3, 3, 2]} intensity={30} color="#3a86ff" />

        {/* Pared con luces del estudio */}
        <mesh position={[0, 3, -3.2]}>
          <boxGeometry args={[30, 9, 0.2]} />
          <meshStandardMaterial color="#141b45" />
        </mesh>
        {[-9, -5, 1.5, 5.5].map((x, k) => (
          <mesh key={x} position={[x, 2.6, -3.0]}>
            <boxGeometry args={[0.35, 4.5, 0.2]} />
            <meshStandardMaterial
              color={k % 2 ? "#3a86ff" : "#7b2cbf"}
              emissive={k % 2 ? "#3a86ff" : "#7b2cbf"}
              emissiveIntensity={0.8}
            />
          </mesh>
        ))}

        <Muneco tipo="merengue" x={-4.4} z={0} gesto="burla" activo {...comun} mirarX={0} />
        <Leon tipo="presentador" x={-2.2} z={-0.35} gesto="celebrar" activo {...comun} mirarX={0} />
        <Muneco tipo="cule" x={0} z={0} gesto="enojo" activo {...comun} mirarX={-4} />

        {/* Mesa */}
        <mesh position={[-2.2, 0.32, 1.15]}>
          <boxGeometry args={[8.2, 0.64, 0.9]} />
          <meshStandardMaterial color="#1d3557" />
        </mesh>
        <mesh position={[-2.2, 0.66, 1.15]}>
          <boxGeometry args={[8.4, 0.08, 1.0]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
      </ThreeCanvas>

      {/* Nombre del canal a la derecha, dentro de la zona que se ve en el celular */}
      <div
        style={{
          position: "absolute",
          right: 290,
          top: 135,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div
          style={{
            background: "#e63946",
            color: "white",
            fontWeight: 900,
            fontSize: 30,
            padding: "6px 18px",
            borderRadius: 10,
          }}
        >
          NOTICIAS CADA DÍA
        </div>
        <div style={{ color: "white", fontWeight: 900, fontSize: 76, lineHeight: 0.95, textShadow: "0 8px 0 #000" }}>
          LEO RUGIDO
        </div>
        <div
          style={{
            background: "#ffd166",
            color: "#0b1230",
            fontWeight: 900,
            fontSize: 40,
            padding: "8px 22px",
            borderRadius: 14,
            transform: "rotate(-2deg)",
          }}
        >
          FÚTBOL EUROPEO
        </div>
        <div style={{ color: "rgba(255,255,255,.85)", fontWeight: 700, fontSize: 26, marginTop: 6 }}>
          Merenguito vs Culerín · ¿quién gana hoy?
        </div>
      </div>
    </AbsoluteFill>
  );
};
