import { useState } from 'react';
import type { GrupoAnalisis } from '../types';
import { Chip } from './ui';

const ETIQUETAS: Record<string, string> = {
  SIN_REPO: 'Sin repo cargado',
  REPO_INACCESIBLE: 'Repo inaccesible',
  REPO_VACIO: 'Repo vacio',
  SIN_ACTIVIDAD: 'Sin actividad',
  BAJA_CONTRIBUCION: 'Aporte bajo',
  CARGA_DESPAREJA: 'Carga despareja',
  AUTOR_NO_MAPEADO: 'Autor no identificado',
  ENTREGA_ULTIMO_MOMENTO: 'Todo a ultimo momento',
  SIN_USUARIO_GITHUB: 'Falta usuario en la planilla',
};

export function Alertas({
  grupos,
  onIrAGrupo,
}: {
  grupos: GrupoAnalisis[];
  onIrAGrupo: (grupo: string) => void;
}) {
  // Por defecto se muestran alta + media: filtrar solo por "alta" deja la pantalla
  // vacia aunque haya varios aportes bajos para mirar.
  const [nivel, setNivel] = useState<'todas' | 'alta' | 'media'>('todas');
  const [codigo, setCodigo] = useState('todos');

  const todas = grupos.flatMap((g) => g.alertas.map((a) => ({ ...a, grupo: g.grupo })));
  const codigos = [...new Set(todas.map((a) => a.codigo))].sort();

  const filtradas = todas
    .filter((a) => (nivel === 'todas' ? a.nivel !== 'info' : a.nivel === nivel))
    .filter((a) => codigo === 'todos' || a.codigo === codigo)
    .sort((a, b) => (a.nivel === b.nivel ? a.grupo.localeCompare(b.grupo, 'es', { numeric: true }) : a.nivel === 'alta' ? -1 : 1));

  return (
    <section className="tarjeta">
      <header>
        <h2>Alertas ({filtradas.length})</h2>
      </header>

      <div className="filtros">
        <select value={nivel} onChange={(e) => setNivel(e.target.value as typeof nivel)}>
          <option value="todas">Todas</option>
          <option value="alta">Solo para revisar</option>
          <option value="media">Solo a mirar</option>
        </select>
        <select value={codigo} onChange={(e) => setCodigo(e.target.value)}>
          <option value="todos">Todos los tipos</option>
          {codigos.map((c) => (
            <option key={c} value={c}>
              {ETIQUETAS[c] ?? c}
            </option>
          ))}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div className="vacio">Nada que revisar con estos filtros.</div>
      ) : (
        filtradas.map((a, i) => (
          <div className="alerta" key={i}>
            <Chip nivel={a.nivel === 'alta' ? 'alta' : a.nivel === 'media' ? 'media' : 'info'}>
              {ETIQUETAS[a.codigo] ?? a.codigo}
            </Chip>
            <div className="cuerpo">
              <div>{a.mensaje}</div>
              <div className="grupo-ref">Grupo {a.grupo}</div>
            </div>
            <button onClick={() => onIrAGrupo(a.grupo)}>Ver grupo</button>
          </div>
        ))
      )}
    </section>
  );
}
