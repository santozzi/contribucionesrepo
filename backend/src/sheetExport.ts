import type { Respuesta } from './types.js';

/** Una fila de la tabla por grupo que arma Apps Script: nombre + commits por TP. */
export interface FilaGrupoSheet {
  nombre: string;
  apellido: string;
  etiqueta: string;
  [tp: string]: string | number;
}

export interface GrupoSheetPayload {
  grupo: string;
  filas: FilaGrupoSheet[];
}

export interface FilaRankingSheet {
  nombre: string;
  apellido: string;
  github: string;
  grupo: string;
  commits: number;
}

export interface PayloadSheet {
  tps: string[];
  grupos: GrupoSheetPayload[];
  ranking: FilaRankingSheet[];
}

/**
 * Misma transformacion que usan el ranking del dashboard (componentes/Ranking.tsx)
 * y el generador de graficos de Apps Script: la dejamos en un solo lugar para que
 * el boton "Actualizar Google Sheet" mande siempre lo mismo que se ve en pantalla.
 */
export function construirPayloadSheet(datos: Respuesta): PayloadSheet {
  const grupos: GrupoSheetPayload[] = datos.grupos
    .map((g) => {
      const filas = g.integrantes
        .filter((i) => i.github)
        .map((i): FilaGrupoSheet => {
          const fila: FilaGrupoSheet = { nombre: i.nombre, apellido: i.apellido, etiqueta: `@${i.github}` };
          for (const tp of datos.tps) {
            const p = g.practicos.find((x) => x.tp === tp);
            const m = p?.miembros.find((x) => x.github === i.github);
            fila[tp] = m?.commits ?? 0;
          }
          return fila;
        });
      return { grupo: g.grupo, filas };
    })
    .filter((g) => g.filas.length > 0);

  const mapaRanking = new Map<string, FilaRankingSheet>();
  for (const g of datos.grupos) {
    for (const i of g.integrantes) {
      if (!i.github) continue;
      let commits = 0;
      for (const p of g.practicos) {
        const m = p.miembros.find((x) => x.github === i.github);
        if (m) commits += m.commits;
      }
      const clave = i.github.toLowerCase();
      const previo = mapaRanking.get(clave);
      if (previo) previo.commits += commits;
      else mapaRanking.set(clave, { nombre: i.nombre, apellido: i.apellido, github: i.github, grupo: g.grupo, commits });
    }
  }
  const ranking = [...mapaRanking.values()].sort((a, b) => b.commits - a.commits);

  return { tps: datos.tps, grupos, ranking };
}
