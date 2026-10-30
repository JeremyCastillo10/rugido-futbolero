import React from "react";
import { Composition, staticFile, type CalculateMetadataFunction } from "remotion";
import { getAudioData } from "@remotion/media-utils";
import { Noticiero } from "./Noticiero";
import { Avatar } from "./Avatar";
import { FPS, INTRO, PAUSA, VELOCIDAD, type Episodio, type NoticieroProps } from "./tipos";

// Volumen por frame normalizado a 0..1
const envolvente = (canal: Float32Array, sampleRate: number): number[] => {
  const porFrame = Math.floor((sampleRate * VELOCIDAD) / FPS);
  const valores: number[] = [];
  for (let i = 0; i + porFrame <= canal.length; i += porFrame) {
    let suma = 0;
    for (let j = i; j < i + porFrame; j++) suma += canal[j] * canal[j];
    valores.push(Math.sqrt(suma / porFrame));
  }
  const max = Math.max(...valores, 0.0001);
  return valores.map((v) => Math.round(Math.min(1, (v / max) * 1.3) * 100) / 100);
};

// Sin audio: boca falsa según el largo del texto
const envolventeFalsa = (frames: number): number[] =>
  Array.from({ length: frames }, (_, f) =>
    Math.round(Math.abs(Math.sin(f / 2.3) * Math.sin(f / 5.1)) * 100) / 100,
  );

const calcularMetadata: CalculateMetadataFunction<NoticieroProps> = async ({ props }) => {
  const episodio: Episodio =
    props.episodio ?? (await fetch(staticFile("episodio.json")).then((r) => r.json()));

  const duraciones: number[] = [];
  const envolventes: number[][] = [];
  for (const e of episodio.escenas) {
    if (e.audio) {
      const datos = await getAudioData(staticFile(e.audio));
      duraciones.push(Math.ceil((datos.durationInSeconds / VELOCIDAD) * FPS) + PAUSA);
      envolventes.push(envolvente(datos.channelWaveforms[0], datos.sampleRate));
    } else {
      const frames = Math.ceil((e.texto.split(" ").length / 2.6) * FPS);
      duraciones.push(frames + PAUSA);
      envolventes.push(envolventeFalsa(frames));
    }
  }

  return {
    durationInFrames: INTRO + duraciones.reduce((a, b) => a + b, 0),
    props: { episodio, duraciones, envolventes },
  };
};

export const RemotionRoot: React.FC = () => (
  <>
  <Composition id="Avatar" component={Avatar} width={1080} height={1080} fps={FPS} durationInFrames={1} />
  <Composition
    id="Noticiero"
    component={Noticiero}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={300}
    defaultProps={{ episodio: null, duraciones: [], envolventes: [] }}
    calculateMetadata={calcularMetadata}
  />
  </>
);
