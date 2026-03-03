export default function HomePage() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Fases abertas</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>—</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Fases pendentes</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>—</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Fases finalizadas</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>—</div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Faturas (aberto/pendente/pago)</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>—</div>
        </div>
      </section>

      <section className="card" style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Timeline</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>As fases cadastradas aparecerão aqui, ordenadas por data início.</div>
      </section>
    </div>
  );
}

