import React from "react";
import {
  AbsoluteFill,
  Html5Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { loadFont } from "@remotion/google-fonts/Rubik";
import { Escenario } from "./Escenario";
import { TarjetaVisual } from "./Visuales";
import { tiroActual } from "./Cancha";
import { CUENTA, INTRO, PERSONAJES, VELOCIDAD, type NoticieroProps } from "./tipos";

const { fontFamily } = loadFont("normal", { weights: ["700", "900"] });

const contorno = "0 4px 0 #000, 0 0 12px rgba(0,0,0,.8)";

export const Noticiero: React.FC<NoticieroProps> = ({
  episodio,
  duraciones,
  envolventes,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  if (!episodio) return null;
  const { escenas } = episodio;

  const inicios: number[] = [];
  let acc = INTRO;
  for (const d of duraciones) {
    inicios.push(acc);
    acc += d;
  }

  let i = -1;
  for (let k = 0; k < escenas.length; k++) {
    if (frame >= inicios[k]) i = k;
  }
  // Después de la última escena: cierre con "Síguenos"
  const enOutro = frame >= acc;
  const tOutro = frame - acc;
  const escena = i >= 0 && !enOutro ? escenas[i] : null;
  const t = i >= 0 ? frame - inicios[i] : frame;
  const boca = escena ? (envolventes[i]?.[t] ?? 0) : 0;
  const anterior = enOutro ? escenas[escenas.length - 1].personaje : i > 0 ? escenas[i - 1].personaje : null;
  const visual = escena?.visual;
  const goles =
    visual?.tipo === "gol" ? { cantidad: Math.max(1, Math.min(5, visual.goles)), dur: duraciones[i] } : undefined;
  const golActual = goles ? tiroActual(t, goles.dur, goles.cantidad) : null;

  // El titular se mantiene hasta que aparece otro
  let titular: string | undefined;
  for (let k = 0; k <= i; k++) titular = escenas[k].titular ?? titular;
  let inicioTitular = 0;
  for (let k = 0; k <= i; k++) if (escenas[k].titular) inicioTitular = inicios[k];

  const palabras = escena ? escena.texto.split(" ") : [];
  const dur = i >= 0 ? duraciones[i] : 1;
  const visibles = Math.ceil(
    interpolate(t, [0, dur * 0.85], [0, palabras.length], {
      extrapolateRight: "clamp",
    }),
  );

  const introEscala = spring({ frame, fps, config: { damping: 11 } });
  const introSalida = interpolate(frame, [INTRO - 8, INTRO], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const entraTitular = spring({ frame: frame - inicioTitular, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ fontFamily, backgroundColor: "#0b1230" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 42, position: [0, 2.6, 11] }}>
        <Escenario
          frame={frame}
          hablando={enOutro ? "presentador" : (escena?.personaje ?? null)}
          anterior={anterior}
          gesto={enOutro ? "celebrar" : (escena?.gesto ?? "normal")}
          boca={boca}
          t={enOutro ? tOutro : i >= 0 ? t : 999}
          goles={goles}
        />
      </ThreeCanvas>

      {visual && <TarjetaVisual visual={visual} t={t} dur={dur} />}

      {golActual && golActual.p > 0.55 && golActual.p < 0.92 && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: -120 }}>
          <div
            style={{
              fontSize: 170,
              fontWeight: 900,
              color: "#ffd166",
              textShadow: "0 12px 0 #000",
              transform: `scale(${spring({ frame: Math.round((golActual.p - 0.55) * dur / goles!.cantidad), fps, config: { damping: 8 } })}) rotate(-6deg)`,
            }}
          >
            ¡GOOOL!
          </div>
        </AbsoluteFill>
      )}

      {enOutro && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: 520 }}>
          <div
            style={{
              transform: `scale(${spring({ frame: tOutro, fps, config: { damping: 10 } })})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 80, fontWeight: 900, color: "white", textShadow: contorno }}>
              ¡Síguenos!
            </div>
            <div
              style={{
                background: "#ffd166",
                color: "#0b1230",
                fontWeight: 900,
                fontSize: 64,
                padding: "14px 34px",
                borderRadius: 20,
                border: "6px solid #0b1230",
                boxShadow: "0 10px 0 #0b1230",
              }}
            >
              {CUENTA}
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Música: fuerte en intro y cierre, baja mientras hablan */}
      <Html5Audio
        src={staticFile("musica.wav")}
        loop
        volume={(f) =>
          interpolate(f, [0, INTRO - 10, INTRO + 5, acc - 5, acc + 10], [0.4, 0.4, 0.08, 0.08, 0.4], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* Efectos: barrido al abrir cada noticia, golpe al mostrar datos, público en cada gol */}
      {escenas.map((e, k) => (
        <React.Fragment key={`fx${k}`}>
          {e.titular && (
            <Sequence from={Math.max(0, inicios[k] - 6)} durationInFrames={20}>
              <Html5Audio src={staticFile("whoosh.wav")} volume={0.5} />
            </Sequence>
          )}
          {e.visual && e.visual.tipo !== "gol" && (
            <Sequence from={inicios[k] + 6} durationInFrames={21}>
              <Html5Audio src={staticFile("golpe.wav")} volume={0.45} />
            </Sequence>
          )}
          {e.visual?.tipo === "gol" &&
            Array.from({ length: Math.max(1, Math.min(5, e.visual.goles)) }, (_, g, arr) => (
              <Sequence
                key={g}
                from={inicios[k] + Math.round((duraciones[k] / arr.length) * (g + 0.53))}
                durationInFrames={90}
              >
                <Html5Audio src={staticFile("publico.wav")} volume={0.35} />
              </Sequence>
            ))}
        </React.Fragment>
      ))}

      {/* Cabecera */}
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 18,
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: "#e63946",
            color: "white",
            fontWeight: 900,
            fontSize: 40,
            padding: "10px 24px",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              background: "white",
              opacity: Math.floor(frame / 15) % 2 ? 1 : 0.3,
            }}
          />
          EN VIVO
        </div>
        <div
          style={{
            background: "rgba(255,255,255,.95)",
            color: "#0b1230",
            fontWeight: 900,
            fontSize: 40,
            padding: "10px 24px",
            borderRadius: 14,
          }}
        >
          {episodio.fecha}
        </div>
      </div>

      {/* Intro */}
      {frame < INTRO && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: introSalida,
          }}
        >
          <div
            style={{
              transform: `scale(${introEscala}) rotate(-4deg)`,
              background: "#ffd166",
              color: "#0b1230",
              fontWeight: 900,
              fontSize: 96,
              lineHeight: 1,
              padding: "36px 48px",
              borderRadius: 28,
              textAlign: "center",
              border: "8px solid #0b1230",
              boxShadow: "0 16px 0 #0b1230",
            }}
          >
            {episodio.titulo}
          </div>
        </AbsoluteFill>
      )}

      {/* Titular de la noticia */}
      {titular && !enOutro && (
        <div
          style={{
            position: "absolute",
            left: 50,
            right: 50,
            top: 230,
            transform: `translateX(${(1 - entraTitular) * -1200}px) rotate(-1.5deg)`,
            background: "#ffd166",
            color: "#0b1230",
            fontWeight: 900,
            fontSize: 58,
            lineHeight: 1.12,
            padding: "24px 32px",
            borderRadius: 16,
            borderLeft: "16px solid #e63946",
            boxShadow: "0 10px 0 rgba(0,0,0,.45)",
          }}
        >
          {titular}
        </div>
      )}

      {/* Subtítulos */}
      {escena && (
        <div
          style={{
            position: "absolute",
            left: 60,
            right: 60,
            top: 1370,
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              background: PERSONAJES[escena.personaje].color,
              color: "#0b1230",
              fontWeight: 900,
              fontSize: 36,
              padding: "6px 20px",
              borderRadius: 999,
              marginBottom: 18,
              border: "4px solid #0b1230",
            }}
          >
            {PERSONAJES[escena.personaje].nombre}
          </div>
          <div
            style={{
              color: "white",
              fontWeight: 900,
              fontSize: 60,
              lineHeight: 1.18,
              textShadow: contorno,
            }}
          >
            {palabras.map((p, k) => (
              <span key={k} style={{ opacity: k < visibles ? 1 : 0.25 }}>
                {p}{" "}
              </span>
            ))}
          </div>
        </div>
      )}

      {escenas.map((e, k) =>
        e.audio ? (
          <Sequence key={k} from={inicios[k]} durationInFrames={duraciones[k]}>
            <Html5Audio src={staticFile(e.audio)} playbackRate={VELOCIDAD} />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
};
