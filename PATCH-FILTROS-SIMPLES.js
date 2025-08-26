// Patch simples para adicionar filtros avançados funcionais
// Adicione essas linhas após os filtros existentes na interface

// 1. ADICIONAR NOVOS ESTADOS (após os existentes):
const [cargoFilter, setCargoFilter] = useState(""); // Filtro por cargo
const [pastorFilter, setPastorFilter] = useState(""); // Filtro por pastor
const [availablePastors, setAvailablePastors] = useState<string[]>([]);

// 2. ADICIONAR ESTATÍSTICAS SIMPLES (após os stats existentes):
const stats = {
  totalPastores: records.filter(r => r.churchPosition?.toLowerCase().includes('pastor')).length,
  totalCooperadores: records.filter(r => r.churchPosition?.toLowerCase().includes('cooperador')).length,
  totalPresbiteros: records.filter(r => r.churchPosition?.toLowerCase().includes('presbítero')).length,
  totalFinanceiros: records.filter(r => r.churchPosition?.toLowerCase().includes('financeiro')).length,
};

// 3. ADICIONAR FILTROS NA INTERFACE (antes dos botões existentes):

{/* Novos Filtros Avançados */}
<div className="flex flex-col md:flex-row gap-2 items-center mb-4">
  <div className="flex flex-col gap-1 w-full md:w-auto">
    <label className="text-sm font-medium">Filtro por Cargo</label>
    <Select value={cargoFilter} onValueChange={setCargoFilter}>
      <SelectTrigger className="w-full md:w-48">
        <SelectValue placeholder="Todos os Cargos" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Todos os Cargos</SelectItem>
        <SelectItem value="pastor">Apenas Pastores ({stats.totalPastores})</SelectItem>
        <SelectItem value="cooperador">Apenas Cooperadores ({stats.totalCooperadores})</SelectItem>
        <SelectItem value="presbítero">Apenas Presbíteros ({stats.totalPresbiteros})</SelectItem>
        <SelectItem value="financeiro">Apenas Financeiros ({stats.totalFinanceiros})</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* Dashboard de Estatísticas */}
  <div className="grid grid-cols-4 gap-2 text-center">
    <div className="bg-purple-100 rounded px-2 py-1">
      <div className="text-sm font-bold">{stats.totalPastores}</div>
      <div className="text-xs">Pastores</div>
    </div>
    <div className="bg-blue-100 rounded px-2 py-1">
      <div className="text-sm font-bold">{stats.totalCooperadores}</div>
      <div className="text-xs">Cooperadores</div>
    </div>
    <div className="bg-green-100 rounded px-2 py-1">
      <div className="text-sm font-bold">{stats.totalPresbiteros}</div>
      <div className="text-xs">Presbíteros</div>
    </div>
    <div className="bg-orange-100 rounded px-2 py-1">
      <div className="text-sm font-bold">{stats.totalFinanceiros}</div>
      <div className="text-xs">Financeiros</div>
    </div>
  </div>
</div>

// 4. ATUALIZAR FILTRO DE REGISTROS (na função filteredRecords):
const filteredRecords = records.filter(r => {
  const term = search.trim().toLowerCase();
  let match = true;
  
  // Filtro por texto
  if (term) {
    match = r.fullName.toLowerCase().includes(term) || r.cpf.toLowerCase().includes(term);
  }
  
  // Filtro por cargo - NOVO!
  if (cargoFilter && match) {
    const cargo = r.churchPosition?.toLowerCase() || '';
    match = cargo.includes(cargoFilter);
  }
  
  // Filtros de data (manter existentes)
  if (startDate && match) {
    const registroDate = r.timestamp ? new Date(r.timestamp) : null;
    const start = new Date(startDate + 'T00:00:00');
    if (!registroDate || registroDate < start) match = false;
  }
  
  if (endDate && match) {
    const registroDate = r.timestamp ? new Date(r.timestamp) : null;
    const end = new Date(endDate + 'T23:59:59');
    if (!registroDate || registroDate > end) match = false;
  }
  
  return match;
});

// 5. BOTÃO PARA LIMPAR NOVOS FILTROS (adicionar ao botão "Limpar Filtros"):
onClick={() => {
  setStartDate("");
  setEndDate("");
  setStatusFilter("");
  setRegionFilter("");
  setCargoFilter(""); // NOVO!
  setPastorFilter(""); // NOVO!
  setSearch("");
}}

// RESULTADO:
// ✅ Dashboard com contadores por cargo
// ✅ Filtro funcional por cargo (pastor, cooperador, etc.)
// ✅ Estatísticas em tempo real
// ✅ Integração com filtros existentes
// ✅ Fácil de implementar e testar
