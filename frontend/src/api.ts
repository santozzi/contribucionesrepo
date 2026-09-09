import type { Respuesta } from './types';

const base = import.meta.env.VITE_API_URL ?? '';

export async function traerDatos(refrescar = false): Promise<Respuesta> {
  const r = await fetch(`${base}/api/datos${refrescar ? '?refrescar=1' : ''}`);
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
  return json as Respuesta;
}

export async function guardarAlias(identidad: string, github: string): Promise<void> {
  const r = await fetch(`${base}/api/alias`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identidad, github }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
}

export const urlCsv = `${base}/api/exportar.csv`;

export async function actualizarSheet(): Promise<{ grupos: number; alumnos: number }> {
  const r = await fetch(`${base}/api/actualizar-sheet`, { method: 'POST' });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
  return json;
}
