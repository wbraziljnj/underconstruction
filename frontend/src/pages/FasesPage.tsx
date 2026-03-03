export default function FasesPage() {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Fases</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Cadastro e acompanhamento das fases da obra</div>
        </div>
        <button className="btn primary">+ Nova</button>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <input className="input" placeholder="Buscar por fase / responsável" />
        <input className="input" placeholder="Data início (YYYY-MM-DD)" />
        <select className="input" defaultValue="">
          <option value="">Status (todos)</option>
          <option value="ABERTA">Aberta</option>
          <option value="PENDENTE">Pendente</option>
          <option value="FINALIZADA">Finalizada</option>
        </select>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.8 }}>
              <th style={{ padding: 10 }}>Fase</th>
              <th style={{ padding: 10 }}>Início</th>
              <th style={{ padding: 10 }}>Previsão</th>
              <th style={{ padding: 10 }}>Finalização</th>
              <th style={{ padding: 10 }}>Responsável</th>
              <th style={{ padding: 10 }}>Valor total</th>
              <th style={{ padding: 10 }} />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ padding: 12, opacity: 0.7 }}>
                Carregando/sem dados (API será integrada na próxima etapa).
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

