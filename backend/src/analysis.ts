import { config } from './config.js';
import { conCache } from './cache.js';
import { traerDatosRepo, type CommitCrudo } from './github.js';
import type {
  Alerta,
  ContribMiembro,
  GrupoAnalisis,
  GrupoSheet,
  IdentidadNoMapeada,
  PuntoTimeline,
  RepoAnalisis,
} from './types.js';

/**
 * Desigualdad del reparto de commits (coeficiente de Gini).
 * 0 = todos aportaron lo mismo, 1 = un solo integrante hizo todo.
 */
export function gini(valores: number[]): number {
  const n = valores.length;
  const total = valores.reduce((a, b) => a + b, 0);
  if (n < 2 || total === 0) return 0;
  let suma = 0;
  for (const a of valores) for (const b of valores) suma += Math.abs(a - b);
  return suma / (2 * n * total);
}

const etiquetaDe = (i: { nombre: string; apellido: string; github: string }) => {
  const persona = `${i.nombre} ${i.apellido}`.trim();
  return persona ? `${persona} (@${i.github})` : `@${i.github}`;
};

/**
 * Resuelve a que integrante pertenece un commit. GitHub no siempre atribuye el
 * commit a una cuenta (pasa cuando el alumno tiene mal el git config), asi que
 * se cae a los alias cargados a mano por email o por nombre.
 */
function resolverAutor(
  c: CommitCrudo,
  porLogin: Map<string, string>,
  alias: Record<string, string>
): string | null {
  if (c.login) {
    const m = porLogin.get(c.login.toLowerCase());
    if (m) return m;
  }
  const porAlias =
    alias[c.email.toLowerCase()] ?? alias[c.nombre.toLowerCase()] ?? undefined;
  if (porAlias) {
    const m = porLogin.get(porAlias.toLowerCase());
    if (m) return m;
  }
  return null;
}

export async function analizarRepo(
  tp: string,
  url: string | null,
  grupo: GrupoSheet,
  alias: Record<string, string>,
  forzar: boolean
): Promise<RepoAnalisis> {
  const base: RepoAnalisis = {
    tp,
    url,
    owner: null,
    repo: null,
    estado: 'sin-repo',
    totalCommits: 0,
    historialCompleto: true,
    statsDisponibles: false,
    miembros: [],
    noMapeados: [],
    gini: 0,
    timeline: [],
    concentracionFinal: 0,
    ultimoPush: null,
    alertas: [],
  };

  const integrantes = grupo.integrantes.filter((i) => i.github);

  if (!url) {
    return {
      ...base,
      alertas: [{ codigo: 'SIN_REPO', nivel: 'info', mensaje: `${tp}: todavia no hay repo cargado.` }],
    };
  }

  const datos = await conCache(`repo:${url}`, forzar, () => traerDatosRepo(url));

  if (datos.estado === 'inaccesible') {
    return {
      ...base,
      estado: 'inaccesible',
      mensaje: datos.mensaje,
      alertas: [
        { codigo: 'REPO_INACCESIBLE', nivel: 'alta', mensaje: `${tp}: ${datos.mensaje}` },
      ],
    };
  }

  const porLogin = new Map(integrantes.map((i) => [i.github.toLowerCase(), i.github]));

  const commitsPorMiembro = new Map<string, CommitCrudo[]>(integrantes.map((i) => [i.github, []]));
  const noMapeados = new Map<string, IdentidadNoMapeada>();

  for (const c of datos.commits) {
    const duenio = resolverAutor(c, porLogin, alias);
    if (duenio) commitsPorMiembro.get(duenio)!.push(c);
    else {
      const k = `${c.login ?? ''}|${c.email.toLowerCase()}`;
      const prev = noMapeados.get(k);
      if (prev) prev.commits++;
      else
        noMapeados.set(k, {
          nombre: c.nombre,
          email: c.email,
          login: c.login,
          commits: 1,
        });
    }
  }

  const total = datos.commits.length;
  const statsPorLogin = new Map(
    (datos.stats ?? []).map((s) => [s.login.toLowerCase(), s])
  );

  const miembros: ContribMiembro[] = integrantes.map((i) => {
    const cs = commitsPorMiembro.get(i.github)!;
    const fechas = cs.map((c) => c.fecha).filter(Boolean).sort();
    const st = statsPorLogin.get(i.github.toLowerCase());
    const cuota = total / Math.max(integrantes.length, 1);
    return {
      github: i.github,
      etiqueta: etiquetaDe(i),
      commits: cs.length,
      porcentaje: total ? Number(((cs.length / total) * 100).toFixed(1)) : 0,
      adiciones: st?.adiciones ?? 0,
      eliminaciones: st?.eliminaciones ?? 0,
      primerCommit: fechas[0] ?? null,
      ultimoCommit: fechas[fechas.length - 1] ?? null,
      diasActivos: new Set(fechas.map((f) => f.slice(0, 10))).size,
      indiceEquidad: cuota ? Number((cs.length / cuota).toFixed(2)) : 0,
    };
  });

  // Timeline diario: una serie por integrante mas "otros" para lo no atribuido.
  const porDia = new Map<string, Record<string, number>>();
  const sumar = (fecha: string, serie: string) => {
    const d = fecha.slice(0, 10);
    if (!d) return;
    const fila = porDia.get(d) ?? {};
    fila[serie] = (fila[serie] ?? 0) + 1;
    porDia.set(d, fila);
  };
  for (const [gh, cs] of commitsPorMiembro) for (const c of cs) sumar(c.fecha, gh);
  for (const c of datos.commits) {
    if (!resolverAutor(c, porLogin, alias)) sumar(c.fecha, 'otros');
  }
  const timeline: PuntoTimeline[] = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, filas]) => ({ fecha, ...filas }) as PuntoTimeline);

  // Cuanto del trabajo entro en las ultimas 24 h antes del ultimo commit.
  const fechasOrdenadas = datos.commits.map((c) => c.fecha).filter(Boolean).sort();
  let concentracionFinal = 0;
  if (fechasOrdenadas.length) {
    const fin = new Date(fechasOrdenadas[fechasOrdenadas.length - 1]).getTime();
    const enUltimas24 = fechasOrdenadas.filter(
      (f) => fin - new Date(f).getTime() <= 24 * 3600 * 1000
    ).length;
    concentracionFinal = Number(((enUltimas24 / fechasOrdenadas.length) * 100).toFixed(0));
  }

  const g = gini(miembros.map((m) => m.commits));
  const alertas: Alerta[] = [];

  if (datos.estado === 'vacio') {
    alertas.push({ codigo: 'REPO_VACIO', nivel: 'alta', mensaje: `${tp}: el repo existe pero no tiene commits.` });
  } else {
    for (const m of miembros) {
      if (m.commits === 0) {
        alertas.push({
          codigo: 'SIN_ACTIVIDAD',
          nivel: 'alta',
          github: m.github,
          mensaje: `${tp}: ${m.etiqueta} no tiene ningun commit.`,
        });
      } else if (m.indiceEquidad < config.umbralBaja) {
        alertas.push({
          codigo: 'BAJA_CONTRIBUCION',
          nivel: 'media',
          github: m.github,
          mensaje: `${tp}: ${m.etiqueta} aporto ${m.porcentaje}% (${m.commits} de ${total} commits).`,
        });
      }
    }
    if (g > config.umbralGini) {
      alertas.push({
        codigo: 'CARGA_DESPAREJA',
        nivel: 'media',
        mensaje: `${tp}: reparto muy desparejo (Gini ${g.toFixed(2)}).`,
      });
    }
    if (concentracionFinal >= config.umbralUltimoMomento && total >= 5) {
      alertas.push({
        codigo: 'ENTREGA_ULTIMO_MOMENTO',
        nivel: 'media',
        mensaje: `${tp}: el ${concentracionFinal}% de los commits entro en las ultimas 24 h.`,
      });
    }
  }

  for (const nm of noMapeados.values()) {
    alertas.push({
      codigo: 'AUTOR_NO_MAPEADO',
      nivel: 'media',
      mensaje:
        `${tp}: ${nm.commits} commit(s) de "${nm.nombre} <${nm.email}>"` +
        `${nm.login ? ` (@${nm.login})` : ''} no coinciden con ningun usuario de la planilla.`,
    });
  }

  const ref = url.match(/github\.com[/:]([^/\s]+)\/([^/\s?#]+)/i);

  return {
    tp,
    url,
    owner: ref?.[1] ?? null,
    repo: ref?.[2]?.replace(/\.git$/i, '') ?? null,
    estado: datos.estado === 'vacio' ? 'vacio' : 'ok',
    totalCommits: total,
    historialCompleto: datos.historialCompleto,
    statsDisponibles: datos.stats !== null,
    miembros,
    noMapeados: [...noMapeados.values()].sort((a, b) => b.commits - a.commits),
    gini: Number(g.toFixed(3)),
    timeline,
    concentracionFinal,
    ultimoPush: datos.ultimoPush,
    alertas,
  };
}

export async function analizarGrupo(
  grupo: GrupoSheet,
  tps: string[],
  alias: Record<string, string>,
  forzar: boolean
): Promise<GrupoAnalisis> {
  const practicos: RepoAnalisis[] = [];
  for (const tp of tps) {
    practicos.push(await analizarRepo(tp, grupo.repos[tp] ?? null, grupo, alias, forzar));
  }

  const alertas: Alerta[] = practicos.flatMap((p) => p.alertas);
  const sinUsuario = grupo.integrantes.filter((i) => !i.github);
  for (const i of sinUsuario) {
    alertas.push({
      codigo: 'SIN_USUARIO_GITHUB',
      nivel: 'media',
      mensaje: `${`${i.nombre} ${i.apellido}`.trim() || 'Un integrante'} no tiene usuario de GitHub cargado en la planilla.`,
    });
  }

  return { grupo: grupo.grupo, integrantes: grupo.integrantes, practicos, alertas };
}

/** Corre `tarea` sobre `items` con un tope de tareas en vuelo, para no saturar la API. */
export async function enTanda<T, R>(
  items: T[],
  limite: number,
  tarea: (item: T) => Promise<R>
): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (true) {
      const i = siguiente++;
      if (i >= items.length) return;
      resultados[i] = await tarea(items[i]);
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}
