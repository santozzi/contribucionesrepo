import type { GrupoAnalisis } from '../types';

export interface FilaRanking {
  puesto: number;
  nombre: string;
  apellido: string;
  github: string;
  grupo: string;
  commits: number;
}

/** Total de commits por alumno, sumando todos los TPs de su grupo. Un alumno con
 * el mismo usuario de Github en mas de un grupo (no deberia pasar) suma ambos. */
export function calcularRanking(grupos: GrupoAnalisis[]): FilaRanking[] {
  const mapa = new Map<string, Omit<FilaRanking, 'puesto'>>();

  for (const g of grupos) {
    for (const i of g.integrantes) {
      if (!i.github) continue;
      let commits = 0;
      for (const p of g.practicos) {
        const m = p.miembros.find((x) => x.github === i.github);
        if (m) commits += m.commits;
      }
      const clave = i.github.toLowerCase();
      const previo = mapa.get(clave);
      if (previo) previo.commits += commits;
      else mapa.set(clave, { nombre: i.nombre, apellido: i.apellido, github: i.github, grupo: g.grupo, commits });
    }
  }

  return [...mapa.values()]
    .sort((a, b) => b.commits - a.commits)
    .map((f, idx) => ({ ...f, puesto: idx + 1 }));
}

const MEDALLA = ['oro', 'plata', 'bronce'] as const;

function Puesto({ fila, medalla }: { fila: FilaRanking; medalla: (typeof MEDALLA)[number] }) {
  return (
    <div className={`puesto puesto-${medalla}`}>
      <div className="puesto-numero">{fila.puesto}°</div>
      <div className="puesto-nombre">
        {fila.nombre} {fila.apellido}
      </div>
      <div className="puesto-github">@{fila.github} · grupo {fila.grupo}</div>
      <div className="puesto-commits">{fila.commits} commits</div>
    </div>
  );
}

export function RankingGeneral({ grupos }: { grupos: GrupoAnalisis[] }) {
  const ranking = calcularRanking(grupos);
  if (!ranking.length) return null;

  const podio = ranking.slice(0, 3);
  const [primero, segundo, tercero] = podio;

  return (
    <section className="tarjeta">
      <header>
        <div>
          <h2>Ranking general por contribuciones</h2>
          <p className="sub" style={{ color: 'var(--tinta-2)', fontSize: 12.5, margin: '3px 0 0' }}>
            Suma de commits de cada alumno en todos los TPs de su grupo, de mayor a menor.
          </p>
        </div>
      </header>

      <div className="podio">
        {segundo && <Puesto fila={segundo} medalla="plata" />}
        {primero && <Puesto fila={primero} medalla="oro" />}
        {tercero && <Puesto fila={tercero} medalla="bronce" />}
      </div>

      <div className="scroll-x ranking-lista">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Alumno</th>
              <th>Grupo</th>
              <th className="num">Commits</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((f) => (
              <tr key={f.github}>
                <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--tinta-2)' }}>{f.puesto}</td>
                <td>
                  {f.nombre} {f.apellido} <span style={{ color: 'var(--tinta-2)' }}>· @{f.github}</span>
                </td>
                <td>{f.grupo}</td>
                <td className="num">{f.commits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
