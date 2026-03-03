export default function FaturaPage() {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Fatura</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Lançamentos e pagamentos</div>
        </div>
        <button className="btn primary">+ Nova</button>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10 }}>
        <input className="input" placeholder="Buscar por descrição / fase / responsável" />
        <select className="input" defaultValue="">
          <option value="">Pagamento (todos)</option>
          <option value="aberto">Aberto</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
        <select className="input" defaultValue="">
          <option value="">Status (todos)</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </select>
        <input className="input" placeholder="Data (YYYY-MM-DD)" />
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.8 }}>
              <th style={{ padding: 10 }}>Data</th>
              <th style={{ padding: 10 }}>Descrição</th>
              <th style={{ padding: 10 }}>Quantidade</th>
              <th style={{ padding: 10 }}>Valor</th>
              <th style={{ padding: 10 }}>Total</th>
              <th style={{ padding: 10 }}>Pagamento</th>
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

