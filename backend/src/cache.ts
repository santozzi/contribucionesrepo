import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.js';

interface Entrada<T> {
  guardado: number;
  valor: T;
}

const clave = (k: string) => createHash('sha1').update(k).digest('hex') + '.json';

/**
 * Cachea el resultado de `fn` en disco. GitHub limita los pedidos por hora y la
 * historia de un repo no cambia entre recargas de la pagina, asi que sin esto
 * cada visita al dashboard quemaria la cuota.
 */
export async function conCache<T>(k: string, forzar: boolean, fn: () => Promise<T>): Promise<T> {
  const archivo = join(config.cacheDir, clave(k));

  if (!forzar) {
    try {
      const crudo = await readFile(archivo, 'utf8');
      const entrada = JSON.parse(crudo) as Entrada<T>;
      if (Date.now() - entrada.guardado < config.cacheTtlMin * 60_000) return entrada.valor;
    } catch {
      // sin cache o cache corrupta: se recalcula
    }
  }

  const valor = await fn();
  try {
    await mkdir(config.cacheDir, { recursive: true });
    await writeFile(archivo, JSON.stringify({ guardado: Date.now(), valor } satisfies Entrada<T>));
  } catch (e) {
    console.warn('[cache] no se pudo escribir', (e as Error).message);
  }
  return valor;
}

export async function limpiarCache(): Promise<void> {
  await rm(config.cacheDir, { recursive: true, force: true });
  await mkdir(config.cacheDir, { recursive: true });
}
