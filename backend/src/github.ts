import { config } from './config.js';

export interface CommitCrudo {
  sha: string;
  fecha: string;
  login: string | null;
  nombre: string;
  email: string;
}

export interface StatsAutor {
  login: string;
  commits: number;
  adiciones: number;
  eliminaciones: number;
}

export interface DatosRepo {
  estado: 'ok' | 'inaccesible' | 'vacio';
  mensaje?: string;
  ultimoPush: string | null;
  commits: CommitCrudo[];
  historialCompleto: boolean;
  stats: StatsAutor[] | null;
}

/** Ultimo estado de cuota visto, para mostrarlo en el dashboard. */
export const rateLimit = {
  restante: null as number | null,
  limite: null as number | null,
  reinicia: null as string | null,
};

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'contribuciones-tp',
  };
  if (config.githubToken) h.Authorization = `Bearer ${config.githubToken}`;
  return h;
}

async function api(path: string): Promise<Response> {
  const r = await fetch(`https://api.github.com${path}`, { headers: headers() });
  const restante = r.headers.get('x-ratelimit-remaining');
  const limite = r.headers.get('x-ratelimit-limit');
  const reset = r.headers.get('x-ratelimit-reset');
  if (restante !== null) rateLimit.restante = Number(restante);
  if (limite !== null) rateLimit.limite = Number(limite);
  if (reset !== null) rateLimit.reinicia = new Date(Number(reset) * 1000).toISOString();
  return r;
}

/** Acepta https://github.com/owner/repo, con o sin .git, /tree/main, etc. */
export function parsearRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/github\.com[/:]([^/\s]+)\/([^/\s?#]+)/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/i, '') };
}

async function traerCommits(owner: string, repo: string) {
  const commits: CommitCrudo[] = [];
  const porPagina = 100;
  const maxPaginas = Math.ceil(config.maxCommits / porPagina);
  let completo = true;

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const r = await api(
      `/repos/${owner}/${repo}/commits?per_page=${porPagina}&page=${pagina}`
    );
    if (r.status === 409) return { commits, completo }; // repo sin commits
    if (!r.ok) throw new Error(`commits HTTP ${r.status}`);

    const lote = (await r.json()) as any[];
    for (const c of lote) {
      commits.push({
        sha: c.sha,
        fecha: c.commit?.author?.date ?? c.commit?.committer?.date ?? '',
        login: c.author?.login ?? null,
        nombre: c.commit?.author?.name ?? '',
        email: c.commit?.author?.email ?? '',
      });
    }
    if (lote.length < porPagina) return { commits, completo };
    if (pagina === maxPaginas) completo = false;
  }
  return { commits, completo };
}

/**
 * /stats/contributors devuelve 202 mientras GitHub arma el calculo. Se reintenta
 * un rato; si no llega, se sigue solo con el conteo de commits (sin lineas).
 */
async function traerStats(owner: string, repo: string): Promise<StatsAutor[] | null> {
  for (let intento = 0; intento < 4; intento++) {
    const r = await api(`/repos/${owner}/${repo}/stats/contributors`);
    if (r.status === 202) {
      await new Promise((res) => setTimeout(res, 1500 * (intento + 1)));
      continue;
    }
    if (r.status === 204) return [];
    if (!r.ok) return null;

    const json = (await r.json()) as any;
    if (!Array.isArray(json)) return null;
    return json.map((a: any) => ({
      login: a.author?.login ?? '',
      commits: a.total ?? 0,
      adiciones: (a.weeks ?? []).reduce((s: number, w: any) => s + (w.a ?? 0), 0),
      eliminaciones: (a.weeks ?? []).reduce((s: number, w: any) => s + (w.d ?? 0), 0),
    }));
  }
  return null;
}

export async function traerDatosRepo(url: string): Promise<DatosRepo> {
  const ref = parsearRepo(url);
  if (!ref) {
    return {
      estado: 'inaccesible',
      mensaje: `La celda no parece un repo de GitHub: "${url}"`,
      ultimoPush: null,
      commits: [],
      historialCompleto: true,
      stats: null,
    };
  }

  const meta = await api(`/repos/${ref.owner}/${ref.repo}`);
  if (!meta.ok) {
    const mensaje =
      meta.status === 404
        ? 'Repo inexistente o privado (404). Si es privado, el token no tiene acceso.'
        : meta.status === 403
          ? 'GitHub rechazo el pedido (403). Suele ser la cuota agotada: cargá GITHUB_TOKEN.'
          : `GitHub respondio HTTP ${meta.status}.`;
    return {
      estado: 'inaccesible',
      mensaje,
      ultimoPush: null,
      commits: [],
      historialCompleto: true,
      stats: null,
    };
  }
  const infoRepo = (await meta.json()) as any;

  const [{ commits, completo }, stats] = await Promise.all([
    traerCommits(ref.owner, ref.repo),
    traerStats(ref.owner, ref.repo),
  ]);

  return {
    estado: commits.length ? 'ok' : 'vacio',
    ultimoPush: infoRepo.pushed_at ?? null,
    commits,
    historialCompleto: completo,
    stats,
  };
}
