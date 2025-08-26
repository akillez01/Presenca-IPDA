"use client"

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeReports } from "@/hooks/use-reports";
import type { AttendanceRecord } from "@/lib/types";
import { CheckCircle, Clock, Download, FileText, Filter, RefreshCw, Table, Users, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

interface FilteredStats {
  summary: {
    total: number;
    present: number;
    absent: number;
    justified: number;
  };
}

export default function ReportsPage() {
  const { reportData, loading, error, refreshData, lastUpdate } = useRealtimeReports();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // Estados para filtros avançados
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [regionFilter, setRegionFilter] = React.useState("ALL");
  const [pastorFilter, setPastorFilter] = React.useState("ALL");
  const [cargoFilter, setCargoFilter] = React.useState("ALL");
  const [cidadeFilter, setCidadeFilter] = React.useState("ALL");
  const [turnoFilter, setTurnoFilter] = React.useState("ALL");
  const [reclassificacaoFilter, setReclassificacaoFilter] = React.useState("ALL");
  
  // Estados para opções disponíveis
  const [availableRegions, setAvailableRegions] = React.useState<string[]>([]);
  const [availablePastors, setAvailablePastors] = React.useState<string[]>([]);
  const [availableCargos, setAvailableCargos] = React.useState<string[]>([]);
  const [availableCidades, setAvailableCidades] = React.useState<string[]>([]);
  const [availableTurnos, setAvailableTurnos] = React.useState<string[]>([]);
  const [availableReclassificacoes, setAvailableReclassificacoes] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  // Extrai opções disponíveis dos dados
  React.useEffect(() => {
    if (reportData?.records) {
      const records = reportData.records;
      
      // Extrair regiões únicas
      const regions = [...new Set(records.map(r => r.region).filter(Boolean))].sort();
      setAvailableRegions(regions);
      
      // Extrair pastores únicos
      const pastors = [...new Set(records.map(r => r.pastorName).filter(Boolean))].sort();
      setAvailablePastors(pastors);
      
      // Extrair cargos únicos
      const cargos = [...new Set(records.map(r => r.churchPosition).filter(Boolean))].sort();
      setAvailableCargos(cargos);
      
      // Extrair cidades únicas
      const cidades = [...new Set(records.map(r => r.city).filter(Boolean))].sort();
      setAvailableCidades(cidades);
      
      // Extrair turnos únicos
      const turnos = [...new Set(records.map(r => r.shift).filter(Boolean))].sort();
      setAvailableTurnos(turnos);
      
      // Extrair reclassificações únicas
      const reclassificacoes = [...new Set(records.map(r => r.reclassification).filter(Boolean))].sort();
      setAvailableReclassificacoes(reclassificacoes);
    }
  }, [reportData]);

  // Aplicação de filtros
  const filteredRecords = React.useMemo(() => {
    if (!reportData?.records) return [];

    return reportData.records.filter((record: AttendanceRecord) => {
      // Filtro de busca textual
      const searchTerm = search.toLowerCase().trim();
      if (searchTerm) {
        const matchesName = record.fullName?.toLowerCase().includes(searchTerm);
        const matchesCpf = record.cpf?.toLowerCase().includes(searchTerm);
        const matchesPastor = record.pastorName?.toLowerCase().includes(searchTerm);
        if (!matchesName && !matchesCpf && !matchesPastor) return false;
      }

      // Filtros específicos
      if (statusFilter !== "ALL" && record.status !== statusFilter) return false;
      if (regionFilter !== "ALL" && record.region !== regionFilter) return false;
      if (pastorFilter !== "ALL" && record.pastorName !== pastorFilter) return false;
      if (cargoFilter !== "ALL") {
        if (cargoFilter === "pastor" && !record.churchPosition?.toLowerCase().includes("pastor")) return false;
        if (cargoFilter === "cooperador" && !record.churchPosition?.toLowerCase().includes("cooperador")) return false;
        if (cargoFilter === "presbítero" && !record.churchPosition?.toLowerCase().includes("presbítero")) return false;
        if (cargoFilter === "financeiro" && !record.churchPosition?.toLowerCase().includes("financeiro")) return false;
        if (cargoFilter === "diácono" && !record.churchPosition?.toLowerCase().includes("diácono")) return false;
        if (cargoFilter === "obreiro" && !record.churchPosition?.toLowerCase().includes("obreiro")) return false;
        if (availableCargos.includes(cargoFilter) && record.churchPosition !== cargoFilter) return false;
      }
      if (cidadeFilter !== "ALL" && record.city !== cidadeFilter) return false;
      if (turnoFilter !== "ALL" && record.shift !== turnoFilter) return false;
      if (reclassificacaoFilter !== "ALL" && record.reclassification !== reclassificacaoFilter) return false;

      return true;
    });
  }, [reportData?.records, search, statusFilter, regionFilter, pastorFilter, cargoFilter, cidadeFilter, turnoFilter, reclassificacaoFilter, availableCargos]);

  // Estatísticas filtradas
  const filteredStats = React.useMemo((): FilteredStats | null => {
    if (!filteredRecords.length) return null;

    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status === "Presente").length;
    const absent = filteredRecords.filter(r => r.status === "Ausente").length;
    const justified = filteredRecords.filter(r => r.status === "Justificado").length;

    return {
      summary: { total, present, absent, justified }
    };
  }, [filteredRecords]);

  // Verifica se há filtros ativos
  const isAdvancedFilterActive = search || statusFilter !== "ALL" || regionFilter !== "ALL" || 
                                pastorFilter !== "ALL" || cargoFilter !== "ALL" || cidadeFilter !== "ALL" || 
                                turnoFilter !== "ALL" || reclassificacaoFilter !== "ALL";

  // Função para limpar filtros
  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setRegionFilter("ALL");
    setPastorFilter("ALL");
    setCargoFilter("ALL");
    setCidadeFilter("ALL");
    setTurnoFilter("ALL");
    setReclassificacaoFilter("ALL");
  };

  // Função de exportação
  const exportFilteredData = () => {
    if (!reportData) return;
    
    const dataToExport = isAdvancedFilterActive ? filteredRecords : reportData.records;
    const headers = [
      `📋 RELATÓRIO DETALHADO DE PRESENÇA - ${new Date().toLocaleDateString('pt-BR')}`,
      `📊 Total de registros: ${dataToExport.length}`,
      isAdvancedFilterActive ? `🔍 Dados filtrados conforme critérios selecionados` : `📈 Dados completos (sem filtros aplicados)`,
      `📅 Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      "",
      "Nome Completo,CPF,Status,Região,Cargo na Igreja,Nome do Pastor,Cidade,Turno,Reclassificação,Data/Hora",
      ...dataToExport.map((record: AttendanceRecord) => [
        `"${record.fullName || ''}"`,
        `"${record.cpf || ''}"`,
        record.status || "Presente",
        record.region || "",
        record.churchPosition || "",
        `"${record.pastorName || ''}"`,
        record.city || "",
        record.shift || "",
        record.reclassification || "",
        record.timestamp ? new Date(record.timestamp).toLocaleDateString("pt-BR") + " " + new Date(record.timestamp).toLocaleTimeString("pt-BR") : "",
      ].join(","))
    ];
    
    const csvContent = headers.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    const filename = isAdvancedFilterActive 
      ? `relatorio-filtrado-${new Date().toISOString().split('T')[0]}.csv`
      : `relatorio-completo-${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const message = isAdvancedFilterActive 
      ? `✅ Relatório filtrado exportado!\n📊 ${dataToExport.length} registros exportados conforme filtros aplicados`
      : `✅ Relatório completo exportado!\n📊 ${dataToExport.length} registros exportados`;
    
    alert(message);
  };

  // Função de exportação de estatísticas
  const exportSummaryData = () => {
    if (!reportData) return;
    
    const stats = isAdvancedFilterActive && filteredStats ? filteredStats : reportData.summary;
    const dataToAnalyze = isAdvancedFilterActive ? filteredRecords : reportData.records;
    
    // Análise por região
    const regionStats = dataToAnalyze.reduce((acc: any, record: AttendanceRecord) => {
      const region = record.region || 'Sem região';
      if (!acc[region]) acc[region] = { total: 0, presente: 0, ausente: 0, justificado: 0 };
      acc[region].total++;
      acc[region][record.status?.toLowerCase() || 'presente']++;
      return acc;
    }, {});

    // Análise por cargo
    const cargoStats = dataToAnalyze.reduce((acc: any, record: AttendanceRecord) => {
      const cargo = record.churchPosition || 'Sem cargo';
      if (!acc[cargo]) acc[cargo] = { total: 0, presente: 0, ausente: 0, justificado: 0 };
      acc[cargo].total++;
      acc[cargo][record.status?.toLowerCase() || 'presente']++;
      return acc;
    }, {});
    
    const headers = [
      `📊 RELATÓRIO ESTATÍSTICO DE PRESENÇA - ${new Date().toLocaleDateString('pt-BR')}`,
      `📈 Análise: ${isAdvancedFilterActive ? 'Dados Filtrados' : 'Dados Completos'}`,
      `📅 Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
      "",
      "=== RESUMO GERAL ===",
      `Total de Registros,${stats.total}`,
      `Presentes,${stats.present} (${((stats.present / stats.total) * 100).toFixed(2)}%)`,
      `Justificados,${stats.justified} (${((stats.justified / stats.total) * 100).toFixed(2)}%)`,
      `Ausentes,${stats.absent} (${((stats.absent / stats.total) * 100).toFixed(2)}%)`,
      "",
      "=== ANÁLISE POR REGIÃO ===",
      "Região,Total,Presentes,Justificados,Ausentes,% Presença",
      ...Object.entries(regionStats).map(([region, data]: [string, any]) => 
        `"${region}",${data.total},${data.presente || 0},${data.justificado || 0},${data.ausente || 0},${((data.presente || 0) / data.total * 100).toFixed(2)}%`
      ),
      "",
      "=== ANÁLISE POR CARGO ===",
      "Cargo,Total,Presentes,Justificados,Ausentes,% Presença",
      ...Object.entries(cargoStats).map(([cargo, data]: [string, any]) => 
        `"${cargo}",${data.total},${data.presente || 0},${data.justificado || 0},${data.ausente || 0},${((data.presente || 0) / data.total * 100).toFixed(2)}%`
      )
    ];
    
    const csvContent = headers.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `estatisticas-${isAdvancedFilterActive ? 'filtradas' : 'completas'}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`📊 Relatório estatístico exportado!\n📈 Incluindo análises por região e cargo`);
  };

  if (!user && !authLoading) {
    return null; // Redirecionamento em andamento
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-4 px-2 md:px-4">
        <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Relatórios de Presença</CardTitle>
            <CardDescription>Erro ao carregar dados</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {error}. Tente atualizar a página ou verifique sua conexão.
              </AlertDescription>
            </Alert>
            <Button onClick={refreshData} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-2 md:px-4">
      {/* Header principal */}
      <Card className="w-full max-w-6xl mx-auto mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Relatórios de Presença
                {isAdvancedFilterActive && (
                  <Badge variant="secondary" className="ml-2">
                    <Filter className="w-3 h-3 mr-1" />
                    Filtrado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Geração e exportação de relatórios detalhados - {reportData?.summary.total || 0} registros disponíveis
                {isAdvancedFilterActive && (
                  <>
                    <br />
                    <span className="text-sm font-medium text-blue-600">
                      📊 Mostrando {filteredRecords.length} de {reportData?.summary.total || 0} registros filtrados
                    </span>
                  </>
                )}
                <br />
                <span className="text-xs text-muted-foreground">
                  Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
                </span>
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={refreshData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
              <Button 
                onClick={exportFilteredData}
                disabled={!reportData || filteredRecords.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar Dados
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Estatísticas principais */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Presentes</p>
                <p className="text-2xl font-bold text-green-600">
                  {isAdvancedFilterActive ? filteredStats?.summary.present || 0 : reportData?.summary.present || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Justificados</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {isAdvancedFilterActive ? filteredStats?.summary.justified || 0 : reportData?.summary.justified || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Ausentes</p>
                <p className="text-2xl font-bold text-red-600">
                  {isAdvancedFilterActive ? filteredStats?.summary.absent || 0 : reportData?.summary.absent || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-600">
                  {isAdvancedFilterActive ? filteredStats?.summary.total || 0 : reportData?.summary.total || 0}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção de Filtros Avançados */}
      <Card className="w-full max-w-6xl mx-auto mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros de Pesquisa Avançados
            {isAdvancedFilterActive && (
              <Badge variant="outline" className="ml-2">
                {filteredRecords.length} registros
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Configure filtros detalhados para gerar relatórios específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {/* Primeira linha: Filtros temporais e hierárquicos */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="text-sm font-semibold mb-3 text-blue-800">📊 Filtros Hierárquicos e Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Filtro de Status */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os Status</SelectItem>
                      <SelectItem value="Presente">Apenas Presentes</SelectItem>
                      <SelectItem value="Justificado">Apenas Justificados</SelectItem>
                      <SelectItem value="Ausente">Apenas Ausentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Região */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Região</label>
                  <Select value={regionFilter} onValueChange={setRegionFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as Regiões" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas as Regiões</SelectItem>
                      {availableRegions.map(region => (
                        <SelectItem key={region} value={region}>{region}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Pastor */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Pastor</label>
                  <Select value={pastorFilter} onValueChange={setPastorFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Pastores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os Pastores</SelectItem>
                      {availablePastors.map(pastor => (
                        <SelectItem key={pastor} value={pastor}>{pastor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Cargo */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Cargo</label>
                  <Select value={cargoFilter} onValueChange={setCargoFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Cargos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os Cargos</SelectItem>
                      <SelectItem value="pastor">Apenas Pastores</SelectItem>
                      <SelectItem value="cooperador">Apenas Cooperadores</SelectItem>
                      <SelectItem value="presbítero">Apenas Presbíteros</SelectItem>
                      <SelectItem value="financeiro">Apenas Financeiros</SelectItem>
                      <SelectItem value="diácono">Apenas Diáconos</SelectItem>
                      <SelectItem value="obreiro">Apenas Obreiros</SelectItem>
                      {availableCargos.map(cargo => (
                        <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Segunda linha: Filtros geográficos */}
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="text-sm font-semibold mb-3 text-green-800">🌍 Filtros Geográficos e Busca</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Filtro de Cidade */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Cidade</label>
                  <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as Cidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas as Cidades</SelectItem>
                      {availableCidades.map(cidade => (
                        <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Turno */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Turno</label>
                  <Select value={turnoFilter} onValueChange={setTurnoFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os Turnos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os Turnos</SelectItem>
                      {availableTurnos.map(turno => (
                        <SelectItem key={turno} value={turno}>{turno}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Busca textual */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Buscar Pessoa</label>
                  <Input
                    type="text"
                    placeholder="Nome, CPF, Pastor..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Terceira linha: Ações e exportação */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-semibold mb-3 text-gray-800">📤 Exportação de Relatórios</h3>
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearAllFilters}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Limpar Filtros
                  </Button>
                  <Button
                    size="sm"
                    onClick={refreshData}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar Dados
                  </Button>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={exportFilteredData}
                    disabled={!reportData || filteredRecords.length === 0}
                    className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    {isAdvancedFilterActive ? `Relatório Filtrado (${filteredRecords.length})` : 'Relatório Completo'}
                  </Button>
                  
                  <Button
                    onClick={exportSummaryData}
                    disabled={!reportData}
                    variant="outline"
                    className="bg-purple-100 hover:bg-purple-200 text-purple-700 flex items-center gap-1"
                  >
                    <Table className="w-4 h-4" />
                    Estatísticas
                  </Button>
                  
                  {/* Exportação específica por status */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const presentOnly = (isAdvancedFilterActive ? filteredRecords : reportData?.records || [])
                        .filter(r => r.status === 'Presente');
                      
                      const headers = [
                        `✅ RELATÓRIO APENAS PRESENTES - ${new Date().toLocaleDateString('pt-BR')}`,
                        `📊 Total: ${presentOnly.length} registros presentes`,
                        "",
                        "Nome Completo,CPF,Região,Cargo na Igreja,Nome do Pastor,Turno,Data/Hora",
                        ...presentOnly.map((r: AttendanceRecord) => [
                          `"${r.fullName}"`,
                          `"${r.cpf}"`,
                          r.region || "",
                          r.churchPosition || "",
                          `"${r.pastorName}"`,
                          r.shift || "",
                          r.timestamp ? new Date(r.timestamp).toLocaleDateString("pt-BR") + " " + new Date(r.timestamp).toLocaleTimeString("pt-BR") : "",
                        ].join(","))
                      ];
                      
                      const csvContent = headers.join("\n");
                      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                      const link = document.createElement("a");
                      const url = URL.createObjectURL(blob);
                      link.setAttribute("href", url);
                      link.setAttribute("download", `relatorio-presentes-${new Date().toISOString().split('T')[0]}.csv`);
                      link.style.visibility = "hidden";
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      alert(`✅ Relatório de presentes exportado!\n📊 ${presentOnly.length} registros exportados`);
                    }}
                    disabled={!reportData}
                    className="text-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Só Presentes
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      const pastoresOnly = (isAdvancedFilterActive ? filteredRecords : reportData?.records || [])
                        .filter(r => r.churchPosition?.toLowerCase().includes('pastor'));
                      
                      const headers = [
                        `👨‍💼 RELATÓRIO APENAS PASTORES - ${new Date().toLocaleDateString('pt-BR')}`,
                        `📊 Total: ${pastoresOnly.length} pastores encontrados`,
                        "",
                        "Nome Completo,CPF,Região,Cargo Específico,Status,Turno,Data/Hora",
                        ...pastoresOnly.map((r: AttendanceRecord) => [
                          `"${r.fullName}"`,
                          `"${r.cpf}"`,
                          r.region || "",
                          r.churchPosition || "",
                          r.status || "Presente",
                          r.shift || "",
                          r.timestamp ? new Date(r.timestamp).toLocaleDateString("pt-BR") + " " + new Date(r.timestamp).toLocaleTimeString("pt-BR") : "",
                        ].join(","))
                      ];
                      
                      const csvContent = headers.join("\n");
                      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                      const link = document.createElement("a");
                      const url = URL.createObjectURL(blob);
                      link.setAttribute("href", url);
                      link.setAttribute("download", `relatorio-pastores-${new Date().toISOString().split('T')[0]}.csv`);
                      link.style.visibility = "hidden";
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      
                      alert(`👨‍💼 Relatório de pastores exportado!\n📊 ${pastoresOnly.length} pastores exportados`);
                    }}
                    disabled={!reportData}
                    className="text-blue-700"
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Só Pastores
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros ativos */}
          {isAdvancedFilterActive && (
            <div className="flex flex-wrap gap-2 mt-4 p-3 bg-blue-50 rounded-lg">
              <Badge variant="outline" className="bg-white">
                <FileText className="w-3 h-3 mr-1" />
                {filteredRecords.length} de {reportData?.summary.total || 0} registros
              </Badge>
              {search && (
                <Badge variant="secondary">
                  🔍 Busca: "{search}"
                </Badge>
              )}
              {statusFilter !== "ALL" && (
                <Badge variant="secondary">
                  📊 Status: {statusFilter}
                </Badge>
              )}
              {regionFilter !== "ALL" && (
                <Badge variant="secondary">
                  🌍 Região: {regionFilter}
                </Badge>
              )}
              {pastorFilter !== "ALL" && (
                <Badge variant="secondary">
                  👨‍💼 Pastor: {pastorFilter}
                </Badge>
              )}
              {cargoFilter !== "ALL" && (
                <Badge variant="secondary">
                  💼 Cargo: {cargoFilter}
                </Badge>
              )}
              {cidadeFilter !== "ALL" && (
                <Badge variant="secondary">
                  🏘️ Cidade: {cidadeFilter}
                </Badge>
              )}
              {turnoFilter !== "ALL" && (
                <Badge variant="secondary">
                  ⏰ Turno: {turnoFilter}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo dos dados filtrados */}
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle>Resumo dos Dados {isAdvancedFilterActive ? 'Filtrados' : 'Completos'}</CardTitle>
          <CardDescription>
            Visão geral dos registros {isAdvancedFilterActive ? 'conforme filtros aplicados' : 'disponíveis no sistema'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">
                {isAdvancedFilterActive && filteredStats ? 
                  `${((filteredStats.summary.present / filteredStats.summary.total) * 100).toFixed(1)}%` :
                  reportData ? `${((reportData.summary.present / reportData.summary.total) * 100).toFixed(1)}%` : '0%'
                }
              </div>
              <div className="text-sm text-muted-foreground">Taxa de Presença</div>
            </div>
            <div className="text-center p-4 border rounded-lg bg-yellow-50">
              <div className="text-2xl font-bold text-yellow-600">
                {isAdvancedFilterActive && filteredStats ? 
                  `${((filteredStats.summary.justified / filteredStats.summary.total) * 100).toFixed(1)}%` :
                  reportData ? `${((reportData.summary.justified / reportData.summary.total) * 100).toFixed(1)}%` : '0%'
                }
              </div>
              <div className="text-sm text-muted-foreground">Taxa de Justificação</div>
            </div>
            <div className="text-center p-4 border rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-600">
                {isAdvancedFilterActive && filteredStats ? 
                  `${((filteredStats.summary.absent / filteredStats.summary.total) * 100).toFixed(1)}%` :
                  reportData ? `${((reportData.summary.absent / reportData.summary.total) * 100).toFixed(1)}%` : '0%'
                }
              </div>
              <div className="text-sm text-muted-foreground">Taxa de Ausência</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
