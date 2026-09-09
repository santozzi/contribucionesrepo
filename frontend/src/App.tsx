import { useCallback, useEffect, useState } from 'react';
import { actualizarSheet, traerDatos, urlCsv } from './api';
import { Alertas } from './componentes/Alertas';
import { GrupoCard } from './componentes/GrupoCard';
import { RankingGeneral } from './componentes/Ranking';
import { Resumen } from './componentes/Resumen';
import type { Respuesta } from './types';

type Tab = 'resumen' | 'grupos' | 'alertas';

export function App() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<Tab>('resumen');
  const [foco, setFoco] = useState<string | null>(null);
  const [soloConAlertas, setSoloConAlertas] = useState(false);
  const [actualizandoSheet, setActualizandoSheet] = useState(false);
  const [avisoSheet, setAvisoSheet] = useState<{ texto: string; error: boolean } | null>(null);

  const cargar = useCallback(async (refrescar: boolean) => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await traerDatos(refrescar));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(false);
  }, [cargar]);

  const actualizarGoogleSheet = async () => {
    setActualizandoSheet(true);
    setAvisoSheet(null);
    try {
      const r = await actualizarSheet();
      setAvisoSheet({ texto: `Google Sheet actualizado: ${r.grupos} grupos, ${r.alumnos} alumnos en el ranking.`, error: false });
    } catch (e) {
      setAvisoSheet({ texto: `No se pudo actualizar el Sheet: ${(e as Error).message}`, error: true });
    } finally {
      setActualizandoSheet(false);
    }
  };

  const irAGrupo = (grupo: string) => {
    setFoco(grupo);
    setTab('grupos');
    requestAnimationFrame(() => document.getElementById(`grupo-${grupo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const gruposVisibles =
    datos?.grupos.filter((g) => !soloConAlertas || g.alertas.some((a) => a.nivel !== 'info')) ?? [];

  return (
    <div className="app">
      <header className="cabecera">
        <div>
          <h1>Contribuciones por grupo</h1>
          <div className="sub">
            {datos
              ? `${datos.grupos.length} grupos · ${datos.tps.length} practicos · actualizado ${new Date(
                  datos.generado
                ).toLocaleString('es-AR')}`
              : 'Leyendo la planilla…'}
            {datos?.rateLimit.restante != null && (
              <> · cuota GitHub {datos.rateLimit.restante}/{datos.rateLimit.limite}</>
            )}
          </div>
        </div>
        <div className="acciones">
          <a className="boton" href={urlCsv}>
            Exportar CSV
          </a>
          <button onClick={() => void cargar(false)} disabled={cargando}>
            Releer planilla
          </button>
          <button className="primario" onClick={() => void cargar(true)} disabled={cargando}>
            {cargando ? 'Consultando…' : 'Refrescar desde GitHub'}
          </button>
          <button onClick={() => void actualizarGoogleSheet()} disabled={actualizandoSheet}>
            {actualizandoSheet ? 'Actualizando Sheet…' : 'Actualizar Google Sheet'}
          </button>
        </div>
      </header>

      {error && (
        <div className="aviso error">
          <b>No se pudieron traer los datos.</b> {error}
        </div>
      )}
      {avisoSheet && (
        <div className={avisoSheet.error ? 'aviso error' : 'aviso'}>
          {avisoSheet.texto}
        </div>
      )}
      {datos?.aviso.map((a) => (
        <div className="aviso" key={a}>
          {a}
        </div>
      ))}

      <nav className="tabs" role="tablist">
        {(['resumen', 'grupos', 'alertas'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'resumen' ? 'Resumen' : t === 'grupos' ? 'Grupos' : 'Alertas'}
          </button>
        ))}
      </nav>

      {!datos && cargando && <div className="vacio">Consultando GitHub para cada repo de la planilla…</div>}

      {datos && tab === 'resumen' && <Resumen grupos={datos.grupos} tps={datos.tps} onIrAGrupo={irAGrupo} />}

      {datos && tab === 'grupos' && (
        <>
          <RankingGeneral grupos={datos.grupos} />
          <div className="filtros">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={soloConAlertas}
                onChange={(e) => setSoloConAlertas(e.target.checked)}
              />
              Mostrar solo grupos con algo para revisar
            </label>
          </div>
          {gruposVisibles.map((g) => (
            <div id={`grupo-${g.grupo}`} key={g.grupo}>
              <GrupoCard
                grupo={g}
                tps={datos.tps}
                onRecargar={() => void cargar(false)}
                abiertoInicial={foco === g.grupo}
              />
            </div>
          ))}
          {gruposVisibles.length === 0 && <div className="vacio">Ningun grupo coincide con el filtro.</div>}
        </>
      )}

      {datos && tab === 'alertas' && <Alertas grupos={datos.grupos} onIrAGrupo={irAGrupo} />}
    </div>
  );
}
