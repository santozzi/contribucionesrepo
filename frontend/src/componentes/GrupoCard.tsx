import { useState } from 'react';
import { guardarAlias } from '../api';
import { BarrasPorIntegrante, TimelineDiario } from '../graficos';
import type { GrupoAnalisis, RepoAnalisis } from '../types';
import { Chip, fecha } from './ui';

function DetallePractico({
  p,
  grupo,
  onRecargar,
}: {
  p: RepoAnalisis;
  grupo: GrupoAnalisis;
  onRecargar: () => void;
}) {
  const [asignando, setAsignando] = useState<Record<string, string>>({});

  if (p.estado === 'sin-repo') {
    return (
      <div className="vacio" style={{ padding: '14px 0' }}>
        {p.tp}: sin repo cargado en la planilla todavia.
      </div>
    );
  }
  if (p.estado === 'inaccesible' || p.estado === 'error') {
    return (
      <div className="aviso error">
        <b>{p.tp}</b> — {p.mensaje ?? 'No se pudo leer el repo.'}{' '}
        {p.url && (
          <a href={p.url} target="_blank" rel="noreferrer">
            abrir
          </a>
        )}
      </div>
    );
  }

  const asignar = async (clave: string, identidad: string) => {
    const destino = asignando[clave];
    if (!destino) return;
    await guardarAlias(identidad, destino);
    onRecargar();
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <header style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 8 }}>
        <h3>{p.tp}</h3>
        <span style={{ color: 'var(--tinta-2)', fontSize: 12.5 }}>
          {p.totalCommits} commits · reparto {p.gini <= 0.3 ? 'parejo' : p.gini <= 0.5 ? 'aceptable' : 'desparejo'} (Gini{' '}
          {p.gini.toFixed(2)}) · ultimo push {fecha(p.ultimoPush)}
        </span>
        {p.url && (
          <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, marginLeft: 'auto' }}>
            {p.owner}/{p.repo} ↗
          </a>
        )}
      </header>

      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Integrante</th>
              <th className="num">Commits</th>
              <th className="num">%</th>
              <th className="num">+ lineas</th>
              <th className="num">− lineas</th>
              <th className="num">Dias activos</th>
              <th>Primer commit</th>
              <th>Ultimo commit</th>
            </tr>
          </thead>
          <tbody>
            {p.miembros.map((m) => (
              <tr key={m.github}>
                <td>
                  {m.etiqueta}{' '}
                  {m.commits === 0 ? (
                    <Chip nivel="alta">sin actividad</Chip>
                  ) : m.indiceEquidad < 0.4 ? (
                    <Chip nivel="media">aporte bajo</Chip>
                  ) : null}
                </td>
                <td className="num">{m.commits}</td>
                <td className="num">{m.porcentaje}%</td>
                <td className="num">{p.statsDisponibles ? m.adiciones.toLocaleString('es-AR') : '—'}</td>
                <td className="num">{p.statsDisponibles ? m.eliminaciones.toLocaleString('es-AR') : '—'}</td>
                <td className="num">{m.diasActivos}</td>
                <td>{fecha(m.primerCommit)}</td>
                <td>{fecha(m.ultimoCommit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!p.statsDisponibles && (
        <p style={{ fontSize: 12, color: 'var(--tinta-2)', marginTop: 6 }}>
          GitHub todavia esta calculando las lineas agregadas/borradas de este repo. Volve a actualizar en un rato.
        </p>
      )}
      {!p.historialCompleto && (
        <p style={{ fontSize: 12, color: 'var(--tinta-2)', marginTop: 6 }}>
          El repo supera el tope de commits leidos (MAX_COMMITS): los numeros cubren solo los mas recientes.
        </p>
      )}

      {p.noMapeados.length > 0 && (
        <div className="aviso" style={{ marginTop: 12 }}>
          <b>Commits sin dueño en la planilla.</b> Suele pasar cuando el alumno tiene mal el{' '}
          <span className="mono">git config user.email</span>. Asignalos y quedan guardados.
          <table style={{ marginTop: 8 }}>
            <tbody>
              {p.noMapeados.map((nm) => {
                const clave = `${nm.login ?? ''}|${nm.email}`;
                return (
                  <tr key={clave}>
                    <td>
                      <span className="mono">
                        {nm.nombre} &lt;{nm.email}&gt;
                      </span>
                      {nm.login && <> · @{nm.login}</>}
                    </td>
                    <td className="num">{nm.commits} commits</td>
                    <td style={{ textAlign: 'right' }}>
                      <select
                        value={asignando[clave] ?? ''}
                        onChange={(e) => setAsignando((s) => ({ ...s, [clave]: e.target.value }))}
                      >
                        <option value="">asignar a…</option>
                        {grupo.integrantes
                          .filter((i) => i.github)
                          .map((i) => (
                            <option key={i.github} value={i.github}>
                              {i.nombre || i.apellido ? `${i.nombre} ${i.apellido} (@${i.github})` : `@${i.github}`}
                            </option>
                          ))}
                      </select>{' '}
                      <button onClick={() => asignar(clave, nm.email || nm.nombre)} disabled={!asignando[clave]}>
                        Guardar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {p.timeline.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 13, color: 'var(--tinta-2)', marginBottom: 6 }}>Commits por dia</h3>
          <TimelineDiario repo={p} integrantes={grupo.integrantes} />
        </div>
      )}
    </div>
  );
}

export function GrupoCard({
  grupo,
  tps,
  onRecargar,
  abiertoInicial = false,
}: {
  grupo: GrupoAnalisis;
  tps: string[];
  onRecargar: () => void;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);

  const altas = grupo.alertas.filter((a) => a.nivel === 'alta').length;
  const medias = grupo.alertas.filter((a) => a.nivel === 'media').length;
  const conDatos = grupo.practicos.filter((p) => p.estado === 'ok');
  const totalCommits = conDatos.reduce((s, p) => s + p.totalCommits, 0);

  return (
    <section className="tarjeta">
      <header>
        <div>
          <h2>
            Grupo {grupo.grupo}{' '}
            <span style={{ fontWeight: 400, color: 'var(--tinta-2)', fontSize: 13 }}>
              · {grupo.integrantes.filter((i) => i.github).length} integrantes · {conDatos.length}/{tps.length} TPs con repo ·{' '}
              {totalCommits} commits
            </span>
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {altas > 0 && <Chip nivel="alta">{altas} para revisar</Chip>}
          {medias > 0 && <Chip nivel="media">{medias} a mirar</Chip>}
          {altas + medias === 0 && conDatos.length > 0 && <Chip nivel="ok">sin observaciones</Chip>}
          <button onClick={() => setAbierto((a) => !a)}>{abierto ? 'Ocultar detalle' : 'Ver detalle'}</button>
        </div>
      </header>

      {conDatos.length === 0 ? (
        <div className="vacio">
          Todavia no hay ningun repo cargado para este grupo. Cuando completes la celda del TP en la planilla, los
          graficos aparecen solos.
        </div>
      ) : (
        <BarrasPorIntegrante grupo={grupo} tps={tps} />
      )}

      {abierto && (
        <div style={{ marginTop: 18, borderTop: '1px solid var(--grilla)', paddingTop: 16 }}>
          {grupo.practicos.map((p) => (
            <DetallePractico key={p.tp} p={p} grupo={grupo} onRecargar={onRecargar} />
          ))}
        </div>
      )}
    </section>
  );
}
