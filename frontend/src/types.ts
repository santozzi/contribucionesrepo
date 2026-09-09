export interface Integrante {
  nombre: string;
  apellido: string;
  github: string;
}

export interface Alerta {
  codigo: string;
  nivel: 'alta' | 'media' | 'info';
  mensaje: string;
  github?: string;
}

export interface ContribMiembro {
  github: string;
  etiqueta: string;
  commits: number;
  porcentaje: number;
  adiciones: number;
  eliminaciones: number;
  primerCommit: string | null;
  ultimoCommit: string | null;
  diasActivos: number;
  indiceEquidad: number;
}

export interface IdentidadNoMapeada {
  nombre: string;
  email: string;
  login: string | null;
  commits: number;
}

export interface RepoAnalisis {
  tp: string;
  url: string | null;
  owner: string | null;
  repo: string | null;
  estado: 'ok' | 'sin-repo' | 'inaccesible' | 'vacio' | 'error';
  mensaje?: string;
  totalCommits: number;
  historialCompleto: boolean;
  statsDisponibles: boolean;
  miembros: ContribMiembro[];
  noMapeados: IdentidadNoMapeada[];
  gini: number;
  timeline: Record<string, string | number>[];
  concentracionFinal: number;
  ultimoPush: string | null;
  alertas: Alerta[];
}

export interface GrupoAnalisis {
  grupo: string;
  integrantes: Integrante[];
  practicos: RepoAnalisis[];
  alertas: Alerta[];
}

export interface Respuesta {
  generado: string;
  tps: string[];
  grupos: GrupoAnalisis[];
  aviso: string[];
  rateLimit: { restante: number | null; limite: number | null; reinicia: string | null };
}
