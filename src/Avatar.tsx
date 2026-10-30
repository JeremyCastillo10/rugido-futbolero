import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Leon } from "./Leon";

const Camara: React.FC = () => {
  const camera = useThree((s) => s.camera);
  camera.position.set(0.9, 2.3, 5.2);
  camera.lookAt(0, 1.75, 0);
  return null;
};

// Foto de perfil cuadrada del presentador
export const Avatar: React.FC = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, #2f5bd3, #0b1230 70%)" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 38 }} gl={{ alpha: true }}>
        <Camara />
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 5, 6]} intensity={1.7} />
        <pointLight position={[-3, 3, 2]} intensity={20} color="#9d4edd" />
        <pointLight position={[3, 3, 2]} intensity={20} color="#3a86ff" />
        <Leon
          tipo="presentador"
          x={0}
          z={0}
          boca={0.45}
          gesto="celebrar"
          activo
          t={3}
          frame={30}
          mirarX={0}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
