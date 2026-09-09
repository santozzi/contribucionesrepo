/** Un alumno tal como figura en la planilla. */
export interface Integrante {
  nombre: string;
  apellido: string;
  github: string;
}

/** Una fila de la planilla: el grupo, sus integrantes y un repo por TP. */
export interface GrupoSheet {
  grupo: string;
  integrantes: Integrante[];
  /** "TP 1" -> "https://github.com/owner/repo" (solo los que estan cargados) */
  repos: Record<string, string>;
}

export interface PlanillaParseada {
  /** Nombres de las columnas de TP, en el orden de la planilla. */
  tps: string[];
  grupos: GrupoSheet[];
}

export type CodigoAlerta =
  | 'SIN_REPO'
  | 'REPO_INACCESIBLE'
  | 'REPO_VACIO'
  | 'SIN_ACTIVIDAD'
  | 'BAJA_CONTRIBUCION'
  | 'CARGA_DESPAREJA'
  | 'AUTOR_NO_MAPEADO'
  | 'ENTREGA_ULTIMO_MOMENTO'
  | 'SIN_USUARIO_GITHUB';

export interface Alerta {
  codigo: CodigoAlerta;
  /** 'alta' = requiere mirarlo, 'media' = revisar, 'info' = contexto. */
  nivel: 'alta' | 'media' | 'info';
  mensaje: string;
  /** Usuario de github al que aplica, si aplica a una persona. */
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
  /** commits / (total / cantidadDeIntegrantes). 1 = aporte parejo. */
  indiceEquidad: number;
}

export interface PuntoTimeline {
  fecha: string;
  /** github login -> commits ese dia */
  [autor: string]: string | number;
}

export interface IdentidadNoMapeada {
  nombre: string;
  email: string;
  login: string | null;
  commits: number;
}

export type EstadoRepo = 'ok' | 'sin-repo' | 'inaccesible' | 'vacio' | 'error';

export interface RepoAnalisis {
  tp: string;
  url: string | null;
  owner: string | null;
  repo: string | null;
  estado: EstadoRepo;
  mensaje?: string;
  totalCommits: number;
  /** false cuando se llego al tope de MAX_COMMITS y hay mas historia sin leer. */
  historialCompleto: boolean;
  statsDisponibles: boolean;
  miembros: ContribMiembro[];
  noMapeados: IdentidadNoMapeada[];
  /** 0 = trabajo perfectamente repartido, 1 = lo hizo una sola persona. */
  gini: number;
  timeline: PuntoTimeline[];
  /** % de commits del grupo hechos en las ultimas 24 h antes del ultimo commit. */
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
