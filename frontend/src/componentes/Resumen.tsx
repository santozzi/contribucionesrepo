import type { GrupoAnalisis, RepoAnalisis } from '../types';
import { Chip, Kpi } from './ui';

/** Semaforo de una celda de la matriz. El texto acompaña al color: nunca color solo. */
function estadoCelda(p: RepoAnalisis): { nivel: 'alta' | 'media' | 'info' | 'ok'; texto: string } {
  if (p.estado === 'sin-repo') return { nivel: 'info', texto: 'pendiente' };
  if (p.estado === 'inaccesible' || p.estado === 'error') return { nivel: 'alta', texto: 'inaccesible' };
  if (p.estado === 'vacio') return { nivel: 'alta', texto: 'sin commits' };
  const sinActividad = p.miembros.filter((m) => m.commits === 0).length;
  if (sinActividad) return { nivel: 'alta', texto: `${sinActividad} sin aportar` };
  if (p.gini > 0.5) return { nivel: 'media', texto: 'desparejo' };
  return { nivel: 'ok', texto: 'parejo' };
}

export function Resumen({
  grupos,
  tps,
  onIrAGrupo,
}: {
  grupos: GrupoAnalisis[];
  tps: string[];
  onIrAGrupo: (grupo: string) => void;
}) {
  const conActividad = grupos.filter((g) => g.practicos.some((p) => p.estado === 'ok'));
  const alumnosSinAportar = new Set<string>();
  const gruposDesparejos = new Set<string>();

  for (const g of grupos) {
    for (const p of g.practicos) {
      if (p.estado !== 'ok') continue;
      if (p.gini > 0.5) gruposDesparejos.add(g.grupo);
      for (const m of p.miembros) if (m.commits === 0) alumnosSinAportar.add(`${g.grupo}/${m.github}`);
    }
  }

  const reposPendientes = grupos.reduce(
    (s, g) => s + g.practicos.filter((p) => p.estado === 'sin-repo').length,
    0
  );

  return (
    <>
      <div className="kpis">
        <Kpi valor={`${conActividad.length}/${grupos.length}`} rotulo="Grupos con al menos un repo analizado" />
        <Kpi valor={alumnosSinAportar.size} rotulo="Alumnos sin ningun commit en algun TP" />
        <Kpi valor={gruposDesparejos.size} rotulo="Grupos con reparto desparejo" />
        <Kpi valor={reposPendientes} rotulo="Celdas de TP sin repo cargado" />
      </div>

      <section className="tarjeta">
        <header>
          <div>
            <h2>Matriz de grupos y practicos</h2>
            <p className="sub" style={{ color: 'var(--tinta-2)', fontSize: 12.5, margin: '3px 0 0' }}>
              Cada celda muestra los commits del grupo y cuantos integrantes aportaron. Las filas se completan solas a
              medida que cargas repos en la planilla.
            </p>
          </div>
        </header>

        <div className="scroll-x">
          <table className="matriz">
            <thead>
              <tr>
                <th>Grupo</th>
                {tps.map((tp) => (
                  <th key={tp}>{tp}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.grupo}>
                  <td style={{ fontWeight: 550 }}>{g.grupo}</td>
                  {tps.map((tp) => {
                    const p = g.practicos.find((x) => x.tp === tp);
                    if (!p) return <td key={tp}>—</td>;
                    const est = estadoCelda(p);
                    const activos = p.miembros.filter((m) => m.commits > 0).length;
                    return (
                      <td key={tp}>
                        <div className="celda">
                          <Chip nivel={est.nivel}>{est.texto}</Chip>
                          {p.estado === 'ok' && (
                            <>
                              <span className="detalle">
                                {p.totalCommits} commits · {activos}/{p.miembros.length} aportaron
                              </span>
                              <span className="barra-equidad">
                                {p.miembros.map((m) => (
                                  <i
                                    key={m.github}
                                    title={`${m.etiqueta}: ${m.commits} commits`}
                                    style={{
                                      background:
                                        m.commits === 0
                                          ? 'var(--critico)'
                                          : m.indiceEquidad < 0.4
                                            ? 'var(--serio)'
                                            : 'var(--bien)',
                                    }}
                                  />
                                ))}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => onIrAGrupo(g.grupo)}>Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="leyenda" style={{ marginTop: 12 }}>
          <span>
            <i style={{ background: 'var(--bien)' }} /> aporte parejo
          </span>
          <span>
            <i style={{ background: 'var(--serio)' }} /> aporte bajo
          </span>
          <span>
            <i style={{ background: 'var(--critico)' }} /> sin commits
          </span>
        </div>
      </section>
    </>
  );
}
