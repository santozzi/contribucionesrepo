import { readFile } from 'node:fs/promises';
import { config, urlCsvPlanilla } from './config.js';
import { hayServiceAccount, tokenDeServicio } from './googleAuth.js';
import type { GrupoSheet, Integrante, PlanillaParseada } from './types.js';

/** Parser CSV RFC4180 minimo: respeta comillas, comas adentro de comillas y saltos de linea. */
export function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') enComillas = true;
    else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

export type ModoPlanilla = 'csv-local' | 'service-account' | 'api-key' | 'csv-publico';

/** Que via se va a usar para leer la planilla, en orden de preferencia. */
export async function modoPlanilla(): Promise<ModoPlanilla> {
  if (config.planillaCsvFile) return 'csv-local';
  if (await hayServiceAccount()) return 'service-account';
  if (config.googleApiKey) return 'api-key';
  return 'csv-publico';
}

async function leerPorApi(auth: { key?: string; token?: string }): Promise<string[][]> {
  const rango = config.sheetNombreHoja ? `${config.sheetNombreHoja}!A:ZZ` : 'A:ZZ';
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/` +
    `${encodeURIComponent(rango)}?majorDimension=ROWS` +
    (auth.key ? `&key=${auth.key}` : '');

  const r = await fetch(url, {
    headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
  });
  if (!r.ok) {
    const cuerpo = await r.text();
    const pista =
      r.status === 403 && auth.token
        ? ' Compartí la planilla (aunque sea como Lector) con el client_email de la service account.'
        : r.status === 403 && auth.key
          ? ' Con API key la planilla tiene que estar compartida como "cualquiera con el enlace".'
          : '';
    throw new Error(`Google Sheets API ${r.status}: ${cuerpo.slice(0, 240)}.${pista}`);
  }
  const json = (await r.json()) as { values?: string[][] };
  return json.values ?? [];
}

async function traerMatriz(): Promise<string[][]> {
  const modo = await modoPlanilla();

  // CSV exportado a mano: no toca Google para nada.
  if (modo === 'csv-local') {
    return parseCsv(await readFile(config.planillaCsvFile, 'utf8'));
  }

  if (!config.sheetId) throw new Error('Falta SHEET_ID en el .env');

  // Service account: anda con la planilla restringida, alcanza con compartirsela.
  if (modo === 'service-account') {
    return leerPorApi({ token: await tokenDeServicio() });
  }

  // API key: solo si la planilla esta compartida "cualquiera con el enlace".
  if (modo === 'api-key') {
    return leerPorApi({ key: config.googleApiKey });
  }

  // Ultimo recurso: el export CSV publico. Google lo corta con 401 apenas la
  // planilla deja de ser publica, y a veces tambien limita el acceso anonimo.
  const r = await fetch(urlCsvPlanilla(), { redirect: 'follow' });
  if (!r.ok) {
    throw new Error(
      `Google devolvio HTTP ${r.status} al bajar la planilla como CSV. ` +
        'Esa via solo funciona si la planilla esta compartida como "cualquiera con el enlace puede ver". ' +
        'Para una planilla privada, configurá una service account (GOOGLE_SERVICE_ACCOUNT_FILE) — ver el README.'
    );
  }
  const texto = await r.text();
  if (texto.trimStart().startsWith('<')) {
    throw new Error(
      'Google devolvio HTML en vez de CSV: la planilla no es publica. ' +
        'Configurá una service account o una API key — ver el README.'
    );
  }
  return parseCsv(texto);
}

const norm = (s: string | undefined) =>
  (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Extrae el login de github tanto de "pepe" como de "https://github.com/pepe". */
function limpiarLogin(valor: string): string {
  const v = valor.trim();
  if (!v) return '';
  const m = v.match(/github\.com\/([^/\s?#]+)/i);
  return (m ? m[1] : v).replace(/^@/, '').trim();
}

/**
 * Detecta la estructura leyendo los encabezados en vez de asumir posiciones fijas:
 * asi la planilla puede crecer con un TP 5 o un septimo integrante sin tocar el codigo.
 */
export async function leerPlanilla(): Promise<PlanillaParseada> {
  const matriz = await traerMatriz();

  const filaEnc = matriz.findIndex((f) => f.some((c) => norm(c) === 'grupo'));
  if (filaEnc === -1) {
    throw new Error('No se encontro la columna "grupo" en la planilla.');
  }
  const enc = matriz[filaEnc];

  const colGrupo = enc.findIndex((c) => norm(c) === 'grupo');
  // Cada integrante aporta la terna Nombre / Apellido / Usuario Github.
  const colsGithub = enc
    .map((c, i) => (/usuario\s*github/.test(norm(c)) ? i : -1))
    .filter((i) => i >= 0);
  const colsTp = enc
    .map((c, i) => (/^tp\s*\d+/.test(norm(c)) ? { i, nombre: enc[i].trim() } : null))
    .filter((x): x is { i: number; nombre: string } => x !== null);

  if (!colsGithub.length) throw new Error('No hay columnas "Usuario Github" en la planilla.');
  if (!colsTp.length) throw new Error('No hay columnas "TP 1", "TP 2", ... en la planilla.');

  const grupos: GrupoSheet[] = [];
  for (const fila of matriz.slice(filaEnc + 1)) {
    const grupo = (fila[colGrupo] ?? '').trim();
    if (!grupo) continue;

    const integrantes: Integrante[] = [];
    for (const cg of colsGithub) {
      const github = limpiarLogin(fila[cg] ?? '');
      const nombre = (fila[cg - 2] ?? '').trim();
      const apellido = (fila[cg - 1] ?? '').trim();
      if (!github && !nombre && !apellido) continue;
      integrantes.push({ nombre, apellido, github });
    }

    const repos: Record<string, string> = {};
    for (const { i, nombre } of colsTp) {
      const url = (fila[i] ?? '').trim();
      if (url) repos[nombre] = url;
    }

    grupos.push({ grupo, integrantes, repos });
  }

  return { tps: colsTp.map((c) => c.nombre), grupos };
}
