import { createSign } from 'node:crypto';
import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { config } from './config.js';

interface ClaveServicio {
  client_email: string;
  private_key: string;
}

let cacheToken: { token: string; vence: number } | null = null;
let cacheClave: ClaveServicio | null = null;

const b64url = (s: string | Buffer) =>
  Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function leerClave(): Promise<ClaveServicio> {
  if (cacheClave) return cacheClave;

  const crudo = config.serviceAccountJson
    ? config.serviceAccountJson
    : await readFile(config.serviceAccountFile, 'utf8');

  const json = JSON.parse(crudo) as Partial<ClaveServicio>;
  if (!json.client_email || !json.private_key) {
    throw new Error('El JSON de la service account no tiene client_email / private_key.');
  }
  // En el .env la clave viaja con "\n" literales.
  cacheClave = {
    client_email: json.client_email,
    private_key: json.private_key.replace(/\\n/g, '\n'),
  };
  return cacheClave;
}

/**
 * Firma un JWT y lo canjea por un access token (flujo "JWT bearer" de Google).
 * Evita traer googleapis entero solo para leer una planilla.
 */
export async function tokenDeServicio(): Promise<string> {
  if (cacheToken && Date.now() < cacheToken.vence) return cacheToken.token;

  const clave = await leerClave();
  const ahora = Math.floor(Date.now() / 1000);
  const encabezado = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64url(
    JSON.stringify({
      iss: clave.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: ahora,
      exp: ahora + 3600,
    })
  );

  const firma = createSign('RSA-SHA256').update(`${encabezado}.${cuerpo}`).end().sign(clave.private_key);
  const jwt = `${encabezado}.${cuerpo}.${b64url(firma)}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = (await r.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !json.access_token) {
    throw new Error(`Google rechazo la service account: ${json.error_description ?? `HTTP ${r.status}`}`);
  }

  cacheToken = {
    token: json.access_token,
    vence: Date.now() + (json.expires_in ?? 3600) * 1000 - 60_000,
  };
  return cacheToken.token;
}

/** Hay service account si esta el JSON en el .env o si el archivo montado existe. */
export async function hayServiceAccount(): Promise<boolean> {
  if (config.serviceAccountJson) return true;
  try {
    await access(config.serviceAccountFile, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
