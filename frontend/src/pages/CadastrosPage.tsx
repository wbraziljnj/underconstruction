export default function CadastrosPage() {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700 }}>Cadastros</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Usuários (pedreiro, ajudante, fornecedor, etc.)</div>
        </div>
        <button className="btn primary">+ Novo</button>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <input className="input" placeholder="Buscar por nome / CPF/CNPJ / email" />
        <select className="input" defaultValue="">
          <option value="">Tipo (todos)</option>
          <option value="Pedreiro">Pedreiro</option>
          <option value="Ajudante">Ajudante</option>
          <option value="FornecedorMateriais">Fornecedor Materiais</option>
          <option value="Engenheiro">Engenheiro</option>
          <option value="PrestadorServico">Prestador Serviço</option>
          <option value="Gerente">Gerente</option>
          <option value="Owner">Owner</option>
        </select>
        <select className="input" defaultValue="">
          <option value="">Status (todos)</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </select>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.8 }}>
              <th style={{ padding: 10 }}>Nome</th>
              <th style={{ padding: 10 }}>Tipo</th>
              <th style={{ padding: 10 }}>CPF/CNPJ</th>
              <th style={{ padding: 10 }}>Telefone</th>
              <th style={{ padding: 10 }}>Email</th>
              <th style={{ padding: 10 }}>Status</th>
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

