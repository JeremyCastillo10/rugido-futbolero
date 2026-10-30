export type Personaje = "presentador" | "merengue" | "cule";

export type Gesto =
  | "normal"
  | "burla"
  | "enojo"
  | "risa"
  | "triste"
  | "celebrar"
  | "sorpresa";

// Apoyo visual de la noticia; foto y crédito los agrega scripts/fotos.py
type ConFoto = { jugador?: string; foto?: string; credito?: string };
export type Visual =
  | ({ tipo: "gol"; goles: number } & ConFoto)
  | {
      tipo: "marcador";
      local: string;
      visitante: string;
      golesLocal: number;
      golesVisitante: number;
      competicion?: string;
    }
  | ({ tipo: "dato"; numero: string; texto: string } & ConFoto)
  | ({ tipo: "jugador"; texto?: string } & ConFoto);

export type Escena = {
  visual?: Visual;
  personaje: Personaje;
  texto: string;
  gesto?: Gesto;
  // Rótulo que aparece en pantalla y se mantiene hasta el siguiente
  titular?: string;
  // Ruta dentro de public/, la genera scripts/voces.py
  audio?: string;
};

export type Episodio = {
  fecha: string;
  titulo: string;
  escenas: Escena[];
};

export type NoticieroProps = {
  episodio: Episodio | null;
  // Duración en frames de cada escena
  duraciones: number[];
  // Volumen de la voz por frame (0..1) para mover la boca
  envolventes: number[][];
};

export const PERSONAJES: Record<
  Personaje,
  { nombre: string; color: string; x: number; z: number }
> = {
  merengue: { nombre: "Merenguito", color: "#f4f1ea", x: -2.3, z: 0 },
  presentador: { nombre: "Leo Rugido", color: "#f0a04b", x: 0, z: -0.35 },
  cule: { nombre: "Culerín", color: "#e3245e", x: 2.3, z: 0 },
};

export const CUENTA = "@rugidofutbolero_";
export const FPS = 30;
export const INTRO = 45;
export const OUTRO = 75;
export const PAUSA = 6;
// Velocidad de la voz. Antes 1.15 para compensar; ahora a ritmo natural para que el video dure 1:00-1:20
export const VELOCIDAD = 1.0;
