import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GrupoAnalisis, Integrante, RepoAnalisis } from './types';

/**
 * Orden fijo de la paleta categorica (validada para daltonismo en claro y oscuro).
 * El color sigue a la entidad — TP o integrante — nunca a su posicion en el ranking.
 */
export const COLORES = [
  'var(--serie-1)',
  'var(--serie-2)',
  'var(--serie-3)',
  'var(--serie-4)',
  'var(--serie-5)',
  'var(--serie-6)',
  'var(--serie-7)',
];

export const colorDe = (i: number) => COLORES[i % COLORES.length];

const ejeComun = {
  stroke: 'var(--linea-base)',
  tick: { fill: 'var(--tinta-3)', fontSize: 11 },
  tickLine: false,
};

function TooltipViz({ active, payload, label, titulo }: any) {
  if (!active || !payload?.length) return null;
  const visibles = payload.filter((p: any) => p.value > 0);
  if (!visibles.length) return null;
  return (
    <div className="tt">
      <div className="tt-titulo">{titulo ? titulo(label) : label}</div>
      {visibles.map((p: any) => (
        <div className="fila" key={p.dataKey}>
          <i style={{ background: p.color }} />
          <span>{p.name}</span>
          <b>{p.value}</b>
        </div>
      ))}
    </div>
  );
}

export function Leyenda({ items }: { items: { nombre: string; color: string }[] }) {
  return (
    <div className="leyenda">
      {items.map((it) => (
        <span key={it.nombre}>
          <i style={{ background: it.color }} />
          {it.nombre}
        </span>
      ))}
    </div>
  );
}

/**
 * Commits por integrante, apilados por practico. Es el grafico que responde
 * "quien no trabajo": una barra corta o ausente salta a la vista.
 */
export function BarrasPorIntegrante({
  grupo,
  tps,
}: {
  grupo: GrupoAnalisis;
  tps: string[];
}) {
  const conRepo = tps.filter((tp) =>
    grupo.practicos.some((p) => p.tp === tp && (p.estado === 'ok' || p.estado === 'vacio'))
  );
  const integrantes = grupo.integrantes.filter((i) => i.github);
  if (!conRepo.length || !integrantes.length) return null;

  // Las claves de serie van indexadas (s0, s1, …) y no con el nombre del TP:
  // recharts resuelve dataKey como path estilo lodash y un "TP 1" con espacio
  // no se lee bien. El nombre lindo viaja aparte, en `name`.
  const series = conRepo.map((tp, i) => ({ clave: `s${i}`, nombre: tp, color: colorDe(i) }));

  const datos = integrantes.map((i) => {
    const fila: Record<string, string | number> = { eje: `@${i.github}` };
    let total = 0;
    for (const s of series) {
      const p = grupo.practicos.find((x) => x.tp === s.nombre);
      const m = p?.miembros.find((x) => x.github === i.github);
      fila[s.clave] = m?.commits ?? 0;
      total += m?.commits ?? 0;
    }
    fila.total = total;
    return fila;
  });

  const ultimo = series[series.length - 1];

  return (
    <>
      <Leyenda items={series.map((s) => ({ nombre: s.nombre, color: s.color }))} />
      <ResponsiveContainer width="100%" height={Math.max(120, integrantes.length * 34 + 40)}>
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--grilla)" />
          <XAxis type="number" allowDecimals={false} {...ejeComun} />
          <YAxis type="category" dataKey="eje" width={128} {...ejeComun} />
          <Tooltip
            cursor={{ fill: 'var(--grilla)', fillOpacity: 0.45 }}
            content={<TooltipViz />}
          />
          {series.map((s) => (
            <Bar
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              stackId="a"
              fill={s.color}
              stroke="var(--surface-1)"
              strokeWidth={2}
              barSize={18}
              radius={s.clave === ultimo.clave ? [0, 4, 4, 0] : undefined}
              // Sin esto las barras arrancan en ancho 0 y dependen de que corra
              // requestAnimationFrame: si la pestania no esta visible al montar,
              // quedan invisibles. Ademas en un tablero la animacion no suma.
              isAnimationActive={false}
            >
              {s.clave === ultimo.clave && (
                <LabelList
                  dataKey="total"
                  position="right"
                  style={{ fill: 'var(--tinta-2)', fontSize: 11.5 }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

/** Commits por dia, apilados por integrante: muestra si todo entro a ultimo momento. */
export function TimelineDiario({
  repo,
  integrantes,
}: {
  repo: RepoAnalisis;
  integrantes: Integrante[];
}) {
  if (!repo.timeline.length) return null;

  const conGithub = integrantes.filter((i) => i.github);
  const series = [
    ...conGithub.map((i, idx) => ({ origen: i.github, nombre: `@${i.github}`, color: colorDe(idx) })),
    ...(repo.timeline.some((d) => d.otros)
      ? [{ origen: 'otros', nombre: 'sin identificar', color: 'var(--serie-otros)' }]
      : []),
  ]
    .filter((s) => repo.timeline.some((d) => Number(d[s.origen] ?? 0) > 0))
    // Igual que arriba: la clave del grafico es indexada, no el login de github.
    .map((s, i) => ({ ...s, clave: `s${i}` }));

  const datos = repo.timeline.map((dia) => {
    const fila: Record<string, string | number> = { fecha: String(dia.fecha) };
    for (const s of series) fila[s.clave] = Number(dia[s.origen] ?? 0);
    return fila;
  });

  const ultimo = series[series.length - 1];

  return (
    <>
      <Leyenda items={series.map((s) => ({ nombre: s.nombre, color: s.color }))} />
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={datos} margin={{ top: 4, right: 8, bottom: 4, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--grilla)" />
          <XAxis dataKey="fecha" {...ejeComun} minTickGap={22} />
          <YAxis allowDecimals={false} {...ejeComun} />
          <Tooltip cursor={{ fill: 'var(--grilla)', fillOpacity: 0.45 }} content={<TooltipViz />} />
          {series.map((s) => (
            <Bar
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              stackId="d"
              fill={s.color}
              stroke="var(--surface-1)"
              strokeWidth={1.5}
              radius={s.clave === ultimo?.clave ? [4, 4, 0, 0] : undefined}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}
