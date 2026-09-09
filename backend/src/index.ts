import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import cors from 'cors';
import express from 'express';
import { analizarGrupo, enTanda } from './analysis.js';
import { limpiarCache } from './cache.js';
import { config } from './config.js';
import { rateLimit } from './github.js';
import { leerPlanilla, modoPlanilla } from './sheets.js';
import { construirPayloadSheet } from './sheetExport.js';
import type { GrupoAnalisis, Respuesta } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

async function leerAlias(): Promise<Record<string, string>> {
  try {
    const crudo = await readFile(config.aliasFile, 'utf8');
    const json = JSON.parse(crudo) as Record<string, string>;
    // Las claves se comparan en minuscula (email o nombre del commit).
    return Object.fromEntries(Object.entries(json).map(([k, v]) => [k.toLowerCase().trim(), v]));
  } catch {
    return {};
  }
}

async function construirRespuesta(forzar: boolean): Promise<Respuesta> {
  const { tps, grupos } = await leerPlanilla();
  const alias = await leerAlias();

  const analizados = await enTanda<(typeof grupos)[number], GrupoAnalisis>(
    grupos,
    config.concurrencia,
    (g) => analizarGrupo(g, tps, alias, forzar)
  );

  const aviso: string[] = [];
  if (!config.githubToken) {
    aviso.push(
      'Sin GITHUB_TOKEN la API de GitHub permite solo 60 pedidos por hora: con varios grupos ' +
        'se agota enseguida y los repos aparecen como inaccesibles. Cargá un token en el .env.'
    );
  }
  if (rateLimit.restante !== null && rateLimit.restante < 100) {
    aviso.push(`Quedan ${rateLimit.restante} pedidos de cuota en GitHub (se renueva ${rateLimit.reinicia}).`);
  }

  return { generado: new Date().toISOString(), tps, grupos: analizados, aviso, rateLimit };
}

app.get('/api/estado', async (_req, res) => {
  const modo = await modoPlanilla();
  try {
    const { tps, grupos } = await leerPlanilla();
    res.json({
      ok: true,
      planilla: {
        modo,
        sheetId: config.sheetId,
        tps,
        grupos: grupos.length,
        gruposConRepo: grupos.filter((g) => Object.keys(g.repos).length > 0).length,
      },
      githubToken: Boolean(config.githubToken),
      rateLimit,
    });
  } catch (e) {
    res.status(500).json({ ok: false, modo, error: (e as Error).message });
  }
});

app.get('/api/datos', async (req, res) => {
  try {
    res.json(await construirRespuesta(req.query.refrescar === '1'));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/refrescar', async (_req, res) => {
  await limpiarCache();
  res.json({ ok: true });
});

/**
 * Empuja los graficos por grupo + el ranking general a la hoja "Graficos por
 * grupo" de la planilla, via la Aplicacion web publicada del Apps Script.
 * Ver README para como publicarla y de donde salen SHEET_WEBHOOK_URL/SECRET.
 */
app.post('/api/actualizar-sheet', async (_req, res) => {
  if (!config.sheetWebhookUrl || !config.sheetWebhookSecret) {
    res.status(400).json({
      error: 'Falta SHEET_WEBHOOK_URL y/o SHEET_WEBHOOK_SECRET en el .env. Ver README para publicar la Aplicacion web.',
    });
    return;
  }
  try {
    const datos = await construirRespuesta(false);
    const payload = construirPayloadSheet(datos);
    const r = await fetch(config.sheetWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Sin un User-Agent de navegador, el frontend de Google (ESF) devuelve
        // una pagina generica de error al seguir el redirect a googleusercontent.com.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({ secret: config.sheetWebhookSecret, ...payload }),
    });
    const texto = await r.text();
    let json: { ok?: boolean; error?: string };
    try {
      json = JSON.parse(texto);
    } catch {
      throw new Error(`Respuesta inesperada de Apps Script (HTTP ${r.status}): ${texto.slice(0, 200)}`);
    }
    if (!json.ok) throw new Error(json.error ?? 'Apps Script devolvio un error sin detalle.');
    res.json({ ok: true, grupos: payload.grupos.length, alumnos: payload.ranking.length });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/alias', async (_req, res) => res.json(await leerAlias()));

/** Permite atribuir a mano un commit hecho con un email/nombre que no matchea la planilla. */
app.post('/api/alias', async (req, res) => {
  const { identidad, github } = req.body as { identidad?: string; github?: string };
  if (!identidad || !github) {
    res.status(400).json({ error: 'Faltan "identidad" y "github".' });
    return;
  }
  const actual = await leerAlias();
  actual[identidad.toLowerCase().trim()] = github.trim();
  await mkdir(dirname(config.aliasFile), { recursive: true });
  await writeFile(config.aliasFile, JSON.stringify(actual, null, 2));
  res.json({ ok: true, alias: actual });
});

app.get('/api/exportar.csv', async (_req, res) => {
  try {
    const datos = await construirRespuesta(false);
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const filas: string[][] = [
      [
        'grupo', 'tp', 'estado', 'nombre', 'apellido', 'usuario_github',
        'commits', 'porcentaje', 'indice_equidad', 'adiciones', 'eliminaciones',
        'dias_activos', 'primer_commit', 'ultimo_commit', 'total_commits_grupo', 'gini_grupo',
      ],
    ];
    for (const g of datos.grupos) {
      for (const p of g.practicos) {
        if (p.estado !== 'ok' && p.estado !== 'vacio') {
          filas.push([g.grupo, p.tp, p.estado, '', '', '', '', '', '', '', '', '', '', '', '', '']);
          continue;
        }
        for (const m of p.miembros) {
          const i = g.integrantes.find((x) => x.github === m.github);
          filas.push([
            g.grupo, p.tp, p.estado, i?.nombre ?? '', i?.apellido ?? '', m.github,
            String(m.commits), String(m.porcentaje), String(m.indiceEquidad),
            String(m.adiciones), String(m.eliminaciones), String(m.diasActivos),
            m.primerCommit ?? '', m.ultimoCommit ?? '',
            String(p.totalCommits), String(p.gini),
          ]);
        }
      }
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contribuciones.csv"');
    res.send('﻿' + filas.map((f) => f.map(esc).join(',')).join('\n'));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get('/api/salud', (_req, res) => res.json({ ok: true }));

app.listen(config.puerto, () => {
  console.log(`[contribuciones-tp] backend escuchando en :${config.puerto}`);
  if (!config.githubToken) console.warn('[contribuciones-tp] sin GITHUB_TOKEN: cuota de 60 pedidos/hora');
  if (!config.sheetId) console.warn('[contribuciones-tp] falta SHEET_ID en el .env');
});
