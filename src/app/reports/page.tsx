"use client"

import { useAuth } from "@/hooks/use-auth";
import { useRealtimeReports } from "@/hooks/use-reports";
import * as React from "react";


// Interface corrigida
interface FilteredStats {
  summary: {
    total: number;
    present: number;
    absent: number;
    justified: number;
  };
}


export default function ReportsPage() {
  // Hooks de autenticação e dados
  const { user } = useAuth();
  const { reportData, loading, error, refreshData } = useRealtimeReports();

  // Estados de filtro
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [turnoFilter, setTurnoFilter] = React.useState("ALL");
  const [pastorFilter, setPastorFilter] = React.useState("ALL");
  const [cargoFilter, setCargoFilter] = React.useState("ALL");
  const [regionFilter, setRegionFilter] = React.useState("ALL");
  const [cidadeFilter, setCidadeFilter] = React.useState("ALL");
  const [reclassificacaoFilter, setReclassificacaoFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [search, setSearch] = React.useState("");

  // Arrays de opções (extraídos dos registros)
  const availableRegions = React.useMemo(() => {
    if (!reportData) return [];
    return Array.from(new Set(reportData.records.map(r => r.region).filter(Boolean)));
  }, [reportData]);
  const availablePastors = React.useMemo(() => {
    if (!reportData) return [];
    return Array.from(new Set(reportData.records.map(r => r.pastorName).filter(Boolean)));
  }, [reportData]);
  const availableCargos = React.useMemo(() => {
    if (!reportData) return [];
    return Array.from(new Set(reportData.records.map(r => r.churchPosition).filter(Boolean)));
  }, [reportData]);
  const availableCidades = React.useMemo(() => {
    if (!reportData) return [];
    return Array.from(new Set(reportData.records.map(r => r.city).filter(Boolean)));
  }, [reportData]);
  const availableTurnos = React.useMemo(() => {
    if (!reportData) return [];
    return Array.from(new Set(reportData.records.map(r => r.shift).filter(Boolean)));
  }, [reportData]);
  const availableReclassificacoes = React.useMemo(() => {
    if (!reportData) return [];
    return Array.from(new Set(reportData.records.map(r => r.reclassification).filter(Boolean)));
  }, [reportData]);

  // Filtragem dos registros
  const filteredRecords = React.useMemo(() => {
    if (!reportData) return [];
    return reportData.records.filter(r => {
      // Filtros temporais
      if (startDate && r.timestamp < new Date(startDate)) return false;
      if (endDate && r.timestamp > new Date(endDate + "T23:59:59")) return false;
      // Filtros de turno
      if (turnoFilter !== "ALL" && r.shift !== turnoFilter) return false;
      // Filtros de hierarquia
      if (pastorFilter !== "ALL" && r.pastorName !== pastorFilter) return false;
      if (cargoFilter !== "ALL" && r.churchPosition !== cargoFilter) return false;
      // Filtros geográficos
      if (regionFilter !== "ALL" && r.region !== regionFilter) return false;
      if (cidadeFilter !== "ALL" && r.city !== cidadeFilter) return false;
      if (reclassificacaoFilter !== "ALL" && r.reclassification !== reclassificacaoFilter) return false;
      // Filtro de status
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      // Busca
      if (search) {
        const s = search.toLowerCase();
        if (!(
          r.fullName?.toLowerCase().includes(s) ||
          r.cpf?.toLowerCase().includes(s) ||
          r.pastorName?.toLowerCase().includes(s)
        )) return false;
      }
      return true;
    });
  }, [reportData, startDate, endDate, turnoFilter, pastorFilter, cargoFilter, regionFilter, cidadeFilter, reclassificacaoFilter, statusFilter, search]);

  // Estatísticas filtradas
  const filteredStats = React.useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status === "Presente").length;
    const justified = filteredRecords.filter(r => r.status === "Justificado").length;
    const absent = filteredRecords.filter(r => r.status === "Ausente").length;
    return {
      summary: { total, present, justified, absent }
    };
  }, [filteredRecords]);

  // Estado de filtro avançado
  const isAdvancedFilterActive = React.useMemo(() => {
    return (
      startDate || endDate || turnoFilter !== "ALL" || pastorFilter !== "ALL" || cargoFilter !== "ALL" || regionFilter !== "ALL" || cidadeFilter !== "ALL" || reclassificacaoFilter !== "ALL" || statusFilter !== "ALL" || search
    );
  }, [startDate, endDate, turnoFilter, pastorFilter, cargoFilter, regionFilter, cidadeFilter, reclassificacaoFilter, statusFilter, search]);

  // Função para limpar todos os filtros
  function clearAllFilters() {
    setStartDate("");
    setEndDate("");
    setTurnoFilter("ALL");
    setPastorFilter("ALL");
    setCargoFilter("ALL");
    setRegionFilter("ALL");
    setCidadeFilter("ALL");
    setReclassificacaoFilter("ALL");
    setStatusFilter("ALL");
    setSearch("");
  }

  // Funções de exportação (implementação igual ao original)
  function exportFilteredData() {
    if (!reportData || filteredRecords.length === 0) return;
    const headers = [
      `RELATÓRIO FILTRADO - ${new Date().toLocaleDateString('pt-BR')}`,
      `Filtros: ${search ? `Busca: ${search}` : ''}`,
      `Total: ${filteredRecords.length} registros`,
      "",
      "Nome Completo,CPF,Pastor,Cargo,Região,Status,Data/Hora",
      ...filteredRecords.map((r) => [
        `"${r.fullName || ""}"`,
        `"${r.cpf || ""}"`,
        `"${r.pastorName || ""}"`,
        `"${r.churchPosition || ""}"`,
        `"${r.region || ""}"`,
        `"${r.status || "Presente"}"`,
        r.timestamp ? new Date(r.timestamp).toLocaleDateString("pt-BR") + " " + new Date(r.timestamp).toLocaleTimeString("pt-BR") : "",
      ].join(","))
    ];
    const csvContent = headers.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-filtrado-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert(`Exportação concluída!\n${filteredRecords.length} registros exportados`);
  }

  function exportSummaryData() {
    if (!reportData) return;
    const headers = [
      `RESUMO ESTATÍSTICO - ${new Date().toLocaleDateString('pt-BR')}`,
      `Total: ${reportData.summary.total} registros`,
      `Presentes: ${reportData.summary.present}`,
      `Justificados: ${reportData.summary.justified}`,
      `Ausentes: ${reportData.summary.absent}`,
      `Taxa de presença: ${reportData.summary.attendanceRate}%`,
    ];
    const csvContent = headers.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `resumo-estatistico-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert(`Resumo exportado!`);
  }

  // Renderização principal (mantém o JSX original)
  return (
    <div className="min-h-screen bg-gray-50 py-4 px-2 md:px-4">
      <h1 className="text-2xl font-bold mb-4">Relatórios de Presença</h1>

      {/* Mensagem de erro */}
      {error && (
        <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>
      )}

      {/* Carregando */}
      {loading && (
        <div className="bg-blue-100 text-blue-700 p-2 rounded mb-4">Carregando dados...</div>
      )}

      {/* Filtros avançados */}
      <div className="mb-6 p-4 bg-white rounded shadow">
        <div className="flex flex-wrap gap-4 mb-2">
          <div>
            <label className="block text-sm font-medium">Data Inicial</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm font-medium">Data Final</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm font-medium">Turno</label>
            <select value={turnoFilter} onChange={e => setTurnoFilter(e.target.value)} className="border rounded px-2 py-1">
              <option value="ALL">Todos</option>
              {availableTurnos.map(turno => <option key={turno} value={turno}>{turno}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Pastor</label>
            <select value={pastorFilter} onChange={e => setPastorFilter(e.target.value)} className="border rounded px-2 py-1">
              <option value="ALL">Todos</option>
              {availablePastors.map(pastor => <option key={pastor} value={pastor}>{pastor}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Cargo</label>
            <select value={cargoFilter} onChange={e => setCargoFilter(e.target.value)} className="border rounded px-2 py-1">
              <option value="ALL">Todos</option>
              {availableCargos.map(cargo => <option key={cargo} value={cargo}>{cargo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Região</label>
            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} className="border rounded px-2 py-1">
              <option value="ALL">Todas</option>
              {availableRegions.map(region => <option key={region} value={region}>{region}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Cidade</label>
            <select value={cidadeFilter} onChange={e => setCidadeFilter(e.target.value)} className="border rounded px-2 py-1">
              <option value="ALL">Todas</option>
              {availableCidades.map(cidade => <option key={cidade} value={cidade}>{cidade}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Reclassificação</label>
            <select value={reclassificacaoFilter} onChange={e => setReclassificacaoFilter(e.target.value)} className="border rounded px-2 py-1">
              <option value="ALL">Todas</option>
              {availableReclassificacoes.map(reclas => <option key={reclas} value={reclas}>{reclas}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1">
              <option value="ALL">Todos</option>
              <option value="Presente">Presente</option>
              <option value="Justificado">Justificado</option>
              <option value="Ausente">Ausente</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Buscar</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, CPF, Pastor..." className="border rounded px-2 py-1" />
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={clearAllFilters} className="bg-gray-200 px-3 py-1 rounded">Limpar Filtros</button>
          <button onClick={refreshData} className="bg-blue-600 text-white px-3 py-1 rounded">Atualizar Dados</button>
          <button onClick={exportFilteredData} disabled={!reportData || filteredRecords.length === 0} className="bg-green-600 text-white px-3 py-1 rounded">Exportar Filtrado</button>
          <button onClick={exportSummaryData} disabled={!reportData} className="bg-purple-600 text-white px-3 py-1 rounded">Exportar Resumo</button>
        </div>
      </div>

      {/* Resumo dos dados filtrados */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="text-center p-4 border rounded-lg bg-green-50">
          <div className="text-2xl font-bold text-green-600">
            {isAdvancedFilterActive && filteredStats ? 
              `${((filteredStats.summary.present / (filteredStats.summary.total || 1)) * 100).toFixed(1)}%` :
              reportData ? `${((reportData.summary.present / (reportData.summary.total || 1)) * 100).toFixed(1)}%` : '0%'}
          </div>
          <div className="text-sm text-muted-foreground">Taxa de Presença</div>
        </div>
        <div className="text-center p-4 border rounded-lg bg-yellow-50">
          <div className="text-2xl font-bold text-yellow-600">
            {isAdvancedFilterActive && filteredStats ? 
              `${((filteredStats.summary.justified / (filteredStats.summary.total || 1)) * 100).toFixed(1)}%` :
              reportData ? `${((reportData.summary.justified / (reportData.summary.total || 1)) * 100).toFixed(1)}%` : '0%'}
          </div>
          <div className="text-sm text-muted-foreground">Taxa de Justificação</div>
        </div>
        <div className="text-center p-4 border rounded-lg bg-red-50">
          <div className="text-2xl font-bold text-red-600">
            {isAdvancedFilterActive && filteredStats ? 
              `${((filteredStats.summary.absent / (filteredStats.summary.total || 1)) * 100).toFixed(1)}%` :
              reportData ? `${((reportData.summary.absent / (reportData.summary.total || 1)) * 100).toFixed(1)}%` : '0%'}
          </div>
          <div className="text-sm text-muted-foreground">Taxa de Ausência</div>
        </div>
      </div>

      {/* Tabela de registros filtrados */}
      <div className="bg-white rounded shadow p-4">
        <h2 className="text-lg font-semibold mb-2">Registros Filtrados ({filteredRecords.length})</h2>
        {filteredRecords.length === 0 ? (
          <div className="text-gray-500">Nenhum registro encontrado com os filtros atuais.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 border">Nome</th>
                  <th className="px-2 py-1 border">CPF</th>
                  <th className="px-2 py-1 border">Pastor</th>
                  <th className="px-2 py-1 border">Cargo</th>
                  <th className="px-2 py-1 border">Região</th>
                  <th className="px-2 py-1 border">Cidade</th>
                  <th className="px-2 py-1 border">Reclassificação</th>
                  <th className="px-2 py-1 border">Status</th>
                  <th className="px-2 py-1 border">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, idx) => (
                  <tr key={r.id || idx} className="border-b">
                    <td className="px-2 py-1 border">{r.fullName}</td>
                    <td className="px-2 py-1 border">{r.cpf}</td>
                    <td className="px-2 py-1 border">{r.pastorName}</td>
                    <td className="px-2 py-1 border">{r.churchPosition}</td>
                    <td className="px-2 py-1 border">{r.region}</td>
                    <td className="px-2 py-1 border">{r.city}</td>
                    <td className="px-2 py-1 border">{r.reclassification}</td>
                    <td className="px-2 py-1 border">{r.status}</td>
                    <td className="px-2 py-1 border">{r.timestamp ? new Date(r.timestamp).toLocaleDateString("pt-BR") + " " + new Date(r.timestamp).toLocaleTimeString("pt-BR") : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

