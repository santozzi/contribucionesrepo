import type { ReactNode } from 'react';

export function Chip({ nivel, children }: { nivel: 'alta' | 'media' | 'info' | 'ok'; children: ReactNode }) {
  return (
    <span className={`chip ${nivel}`}>
      <span className="punto" />
      {children}
    </span>
  );
}

export function Kpi({ valor, rotulo }: { valor: ReactNode; rotulo: string }) {
  return (
    <div className="kpi">
      <div className="valor">{valor}</div>
      <div className="rotulo">{rotulo}</div>
    </div>
  );
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
