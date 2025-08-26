"use client"

import type { AttendanceRecord } from "@/lib/types";
import { DateRangePicker } from "@/components/date-range-picker";
import { StatisticsDashboard } from "@/components/statistics-dashboard";
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
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeReports } from "@/hooks/use-reports";
import { exportReportSummaryToCSV, exportToCSV, printReport } from "@/lib/export-utils";
import { CheckCircle, Clock, Download, FileText, Printer, RefreshCw, Users, XCircle, Filter, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from "recharts";

export default function ReportsPage() {
  const { reportData, weeklyStats, loading, error, refreshData, lastUpdate, fetchDateRangeData } = useRealtimeReports();
  const [isFilterActive, setIsFilterActive] = React.useState(false);
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

  // Função para aplicar filtros avançados
  const applyAdvancedFilters = () => {
    if (!reportData?.records) return [];
    
    return reportData.records.filter(record => {
      // Filtro de busca textual
      if (search) {
        const searchTerm = search.toLowerCase();
        const matchesSearch = 
          record.fullName.toLowerCase().includes(searchTerm) ||
          record.cpf.toLowerCase().includes(searchTerm) ||
          record.pastorName.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
      }
      
      // Filtro por status
      if (statusFilter && statusFilter !== "ALL" && record.status !== statusFilter) {
        return false;
      }
      
      // Filtro por região (correspondência exata)
      if (regionFilter && regionFilter !== "ALL") {
        const recordRegion = record.region?.toLowerCase().trim() || '';
        const filterRegion = regionFilter.toLowerCase().trim();
        if (recordRegion !== filterRegion) return false;
      }
      
      // Filtro por pastor (correspondência exata)
      if (pastorFilter && pastorFilter !== "ALL") {
        const recordPastor = record.pastorName?.toLowerCase().trim() || '';
        const filterPastor = pastorFilter.toLowerCase().trim();
        if (recordPastor !== filterPastor) return false;
      }
      
      // Filtro por cargo (correspondência exata)
      if (cargoFilter && cargoFilter !== "ALL") {
        const recordCargo = record.churchPosition?.toLowerCase().trim() || '';
        const filterCargo = cargoFilter.toLowerCase().trim();
        if (recordCargo !== filterCargo) return false;
      }
      
      // Filtro por cidade (correspondência exata)
      if (cidadeFilter && cidadeFilter !== "ALL") {
        const recordCidade = record.city?.toLowerCase().trim() || '';
        const filterCidade = cidadeFilter.toLowerCase().trim();
        if (recordCidade !== filterCidade) return false;
      }
      
      // Filtro por turno (correspondência exata)
      if (turnoFilter && turnoFilter !== "ALL") {
        const recordTurno = record.shift?.toLowerCase().trim() || '';
        const filterTurno = turnoFilter.toLowerCase().trim();
        if (recordTurno !== filterTurno) return false;
      }
      
      // Filtro por reclassificação (correspondência exata)
      if (reclassificacaoFilter && reclassificacaoFilter !== "ALL") {
        const recordReclassificacao = record.reclassification?.toLowerCase().trim() || '';
        const filterReclassificacao = reclassificacaoFilter.toLowerCase().trim();
        if (recordReclassificacao !== filterReclassificacao) return false;
      }
      
      return true;
    });
  };

  // Aplicar filtros aos dados
  const filteredRecords = applyAdvancedFilters();
  const isAdvancedFilterActive = search || statusFilter !== "ALL" || regionFilter !== "ALL" || pastorFilter !== "ALL" || cargoFilter !== "ALL" || cidadeFilter !== "ALL" || turnoFilter !== "ALL" || reclassificacaoFilter !== "ALL";

  // Calcular estatísticas dos dados filtrados
  const filteredStats = React.useMemo(() => {
    if (filteredRecords.length === 0) return null;
    
    const present = filteredRecords.filter(r => r.status === 'Presente').length;
    const justified = filteredRecords.filter(r => r.status === 'Justificado').length;
    const absent = filteredRecords.filter(r => r.status === 'Ausente').length;
    
    // Estatísticas por turno
    const byShift = filteredRecords.reduce((acc, record) => {
      const shift = record.shift || 'Não informado';
      acc[shift] = (acc[shift] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Estatísticas por região
    const byRegion = filteredRecords.reduce((acc, record) => {
      const region = record.region || 'Não informado';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Estatísticas por cargo
    const byPosition = filteredRecords.reduce((acc, record) => {
      const position = record.churchPosition || 'Não informado';
      acc[position] = (acc[position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Cargos principais com suas variações
    const cargosPrincipais = ['Pastor', 'Cooperador', 'Presbítero', 'Financeiro', 'Diácono', 'Obreiro'];
    const cargoStats = cargosPrincipais.map(cargo => {
      const presente = filteredRecords.filter(r => 
        r.status === 'Presente' && 
        r.churchPosition?.toLowerCase().includes(cargo.toLowerCase())
      ).length;
      const justificado = filteredRecords.filter(r => 
        r.status === 'Justificado' && 
        r.churchPosition?.toLowerCase().includes(cargo.toLowerCase())
      ).length;
      
      return { position: cargo, presente, justificado };
    });
    
    return {
      summary: { present, justified, absent, total: filteredRecords.length },
      byShift,
      byRegion,
      byPosition,
      cargoStats
    };
  }, [filteredRecords]);

  // Limpar todos os filtros
  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setRegionFilter("ALL");
    setPastorFilter("ALL");
    setCargoFilter("ALL");
    setCidadeFilter("ALL");
    setTurnoFilter("ALL");
    setReclassificacaoFilter("ALL");
    setIsFilterActive(false);
    refreshData();
  };

  // Função para exportar dados filtrados
  const exportFilteredData = () => {
    const filtrosAtivos = [
      statusFilter && statusFilter !== "ALL" && `Status: ${statusFilter}`,
      regionFilter && regionFilter !== "ALL" && `Região: ${regionFilter}`,
      pastorFilter && pastorFilter !== "ALL" && `Pastor: ${pastorFilter}`,
      cargoFilter && cargoFilter !== "ALL" && `Cargo: ${cargoFilter}`,
      cidadeFilter && cidadeFilter !== "ALL" && `Cidade: ${cidadeFilter}`,
      turnoFilter && turnoFilter !== "ALL" && `Turno: ${turnoFilter}`,
      search.trim() && `Busca: "${search.trim()}"`
    ].filter(Boolean);
    
    const headers = [
      `📋 RELATÓRIO FILTRADO - REPORTS - ${new Date().toLocaleDateString('pt-BR')}`,
      "",
      `🔍 FILTROS APLICADOS (${filtrosAtivos.length}): ${filtrosAtivos.length > 0 ? filtrosAtivos.join(' | ') : 'Nenhum filtro aplicado'}`,
      `📊 Total de registros encontrados: ${filteredRecords.length}`,
      "",
      "Nome Completo,CPF,Região,Cargo na Igreja,Nome do Pastor,Status,Turno,Data/Hora",
      ...filteredRecords.map((r: AttendanceRecord) => [
        `"${r.fullName}"`,
        `"${r.cpf}"`,
        r.region || "",
        r.churchPosition || "",
        `"${r.pastorName}"`,
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
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `relatorio-reports-filtrado-${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`📋 Relatório filtrado exportado!\n📊 Registros exportados: ${filteredRecords.length}\n🔍 Filtros aplicados: ${filtrosAtivos.length}`);
  };

  // Dados para gráficos baseados nos registros filtrados
  const chartData = React.useMemo(() => {
    const dataSource = isAdvancedFilterActive ? filteredStats : reportData;
    if (!dataSource) return { attendanceByShift: [], statusData: [], attendanceByPosition: [] };

    // Gráfico de presença por turno
    const attendanceByShift = Object.entries(dataSource.byShift || {}).map(([shift, count], index) => ({
      shift,
      total: count,
      fill: `hsl(${index * 60}, 70%, 50%)`
    }));

    // Gráfico de status geral
    const statusData = [
      { status: "Presente", total: dataSource.summary.present, fill: "#22c55e" },
      { status: "Justificado", total: dataSource.summary.justified, fill: "#eab308" },
      { status: "Ausente", total: dataSource.summary.absent, fill: "#ef4444" },
    ].filter(item => item.total > 0);

    // Gráfico de presentes e justificados por cargo
    const attendanceByPosition = (dataSource.cargoStats || []).map((cargo, index) => ({
      ...cargo,
      fillPresente: `hsl(${120}, 70%, 50%)`, // Verde para presentes
      fillJustificado: `hsl(${45}, 70%, 50%)` // Amarelo para justificados
    }));

    // Distribuição por região (top 10)
    const attendanceByRegion = Object.entries(dataSource.byRegion || {})
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([region, count], index) => ({
        region: region.length > 20 ? region.substring(0, 20) + '...' : region,
        total: count,
        fill: `hsl(${index * 36}, 70%, 50%)`
      }));

    return { attendanceByShift, statusData, attendanceByPosition, attendanceByRegion };
  }, [reportData, filteredStats, isAdvancedFilterActive]);

  const chartConfig = {
    total: {
      label: "Total",
      color: "hsl(var(--chart-1))",
    },
    morning: {
      label: "Manhã",
      color: "hsl(var(--chart-1))",
    },
    afternoon: {
      label: "Tarde",
      color: "hsl(var(--chart-2))",
    },
    night: {
      label: "Noite",
      color: "hsl(var(--chart-3))",
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Relatórios de Presença</CardTitle>
            <CardDescription>Carregando dados em tempo real...</CardDescription>
          </CardHeader>
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
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
      {/* Header com estatísticas e controles */}
      <Card className="w-full max-w-6xl mx-auto mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Relatórios de Presença
                {(isFilterActive || isAdvancedFilterActive) && (
                  <Badge variant="secondary" className="ml-2">
                    <Filter className="w-3 h-3 mr-1" />
                    Filtrado
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Análise visual dos dados de presença em tempo real - {reportData?.summary.total || 0} registros carregados
                {isAdvancedFilterActive && (
                  <>
                    <br />
                    <span className="text-sm font-medium text-blue-600">
                      📊 Exibindo {filteredRecords.length} de {reportData?.summary.total || 0} registros
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
              <Button variant="outline" onClick={clearAllFilters}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
              <Button 
                variant="outline" 
                onClick={exportFilteredData}
                disabled={!reportData || filteredRecords.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar Filtrado
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
            Configure filtros detalhados baseados em {reportData?.summary.total || 0} registros disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
                  {availableCargos.map(cargo => (
                    <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            {/* Botão de limpeza */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium invisible">Ações</label>
              <Button variant="outline" onClick={clearAllFilters} className="w-full">
                Limpar Filtros
              </Button>
            </div>
          </div>

          {/* Filtros ativos */}
          {isAdvancedFilterActive && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="outline" className="bg-blue-50">
                <TrendingUp className="w-3 h-3 mr-1" />
                {filteredRecords.length} registros filtrados
              </Badge>
              {search && (
                <Badge variant="secondary">
                  Busca: "{search}"
                </Badge>
              )}
              {statusFilter !== "ALL" && (
                <Badge variant="secondary">
                  Status: {statusFilter}
                </Badge>
              )}
              {regionFilter !== "ALL" && (
                <Badge variant="secondary">
                  Região: {regionFilter}
                </Badge>
              )}
              {pastorFilter !== "ALL" && (
                <Badge variant="secondary">
                  Pastor: {pastorFilter}
                </Badge>
              )}
              {cargoFilter !== "ALL" && (
                <Badge variant="secondary">
                  Cargo: {cargoFilter}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-600">{reportData?.summary.total || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard de Estatísticas Detalhadas */}
      {reportData?.records && (
        <StatisticsDashboard 
          records={reportData.records} 
          className="mb-6" 
        />
      )}

      {/* Sistema de Filtros Avançados */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">🔍 Filtros de Pesquisa Avançados</CardTitle>
          <CardDescription>
            Configure filtros detalhados baseados nos dados do Firebase ({reportData?.records?.length || 0} registros totais)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {/* Filtros Temporais e de Status */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="text-sm font-semibold mb-3 text-blue-800">📅 Filtros de Status e Busca</h3>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-2 items-center">
                  <div className="flex flex-col gap-1 w-full md:w-auto">
                    <label className="text-sm font-medium">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Filtrar por Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos os Status</SelectItem>
                        <SelectItem value="Presente">Apenas Presentes</SelectItem>
                        <SelectItem value="Justificado">Apenas Justificados</SelectItem>
                        <SelectItem value="Ausente">Apenas Ausentes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1 w-full md:w-auto">
                    <label className="text-sm font-medium">Buscar Pessoa</label>
                    <Input
                      type="text"
                      placeholder="Nome, CPF, Pastor..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="w-full md:w-64"
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-full md:w-auto">
                    <label className="text-sm font-medium invisible">Ação</label>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto"
                      onClick={() => {
                        // Aplicar filtros localmente
                        const filtered = applyAdvancedFilters();
                        alert(`🔍 Filtros aplicados!\n📊 Encontrados: ${filtered.length} registros`);
                      }}
                    >
                      🔍 Aplicar Filtros
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="bg-green-100 hover:bg-green-200 text-green-700" 
                    onClick={() => setStatusFilter('Presente')}>Só Presentes</Button>
                  <Button size="sm" variant="outline" className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700" 
                    onClick={() => setStatusFilter('Justificado')}>Só Justificados</Button>
                  <Button size="sm" variant="outline" className="bg-red-100 hover:bg-red-200 text-red-700" 
                    onClick={() => setStatusFilter('Ausente')}>Só Ausentes</Button>
                </div>
              </div>
            </div>

            {/* Filtros Geográficos */}
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="text-sm font-semibold mb-3 text-green-800">🌍 Filtros Geográficos</h3>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-2 items-center">
                  <div className="flex flex-col gap-1 w-full md:w-auto">
                    <label className="text-sm font-medium">Região</label>
                    <Select value={regionFilter} onValueChange={setRegionFilter}>
                      <SelectTrigger className="w-full md:w-48">
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
                  <div className="flex flex-col gap-1 w-full md:w-auto">
                    <label className="text-sm font-medium">Cidade</label>
                    <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                      <SelectTrigger className="w-full md:w-48">
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
                  <div className="flex flex-col gap-1 w-full md:w-auto">
                    <label className="text-sm font-medium invisible">Ação</label>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white w-full md:w-auto"
                      onClick={() => {
                        const filtered = applyAdvancedFilters();
                        alert(`🌍 Filtro Geográfico aplicado!\n📊 Encontrados: ${filtered.length} registros`);
                      }}
                    >
                      🌍 Filtrar Local
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableRegions.slice(0, 4).map(regiao => (
                    <Button key={regiao} size="sm" variant="outline" 
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700"
                      onClick={() => setRegionFilter(regiao)}>
                      {regiao}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filtros de Hierarquia */}
            <div className="border rounded-lg p-4 bg-purple-50">
              <h3 className="text-sm font-semibold mb-3 text-purple-800">👥 Filtros de Hierarquia e Cargos</h3>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-2 items-center">
                  <div className="flex flex-col gap-1 w-full md:w-auto">
                    <label className="text-sm font-medium">Pastor</label>
                    <Select value={pastorFilter} onValueChange={setPastorFilter}>
                      <SelectTrigger className="w-full md:w-48">
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
                  <div className="flex flex-col gap-1 w-full md:w-auto">
                    <label className="text-sm font-medium">Cargo/Posição</label>
                    <Select value={cargoFilter} onValueChange={setCargoFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Todos os Cargos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos os Cargos</SelectItem>
                        <SelectItem value="pastor">Apenas Pastores</SelectItem>
                        <SelectItem value="cooperador">Apenas Cooperadores</SelectItem>
                        <SelectItem value="presbítero">Apenas Presbíteros</SelectItem>
                        <SelectItem value="financeiro">Apenas Financeiros</SelectItem>
                        {availableCargos.map(cargo => (
                          <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1 w-full md:w-auto">
                    <label className="text-sm font-medium invisible">Ação</label>
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white w-full md:w-auto"
                      onClick={() => {
                        const filtered = applyAdvancedFilters();
                        alert(`👥 Filtro de Hierarquia aplicado!\n📊 Encontrados: ${filtered.length} registros`);
                      }}
                    >
                      👥 Filtrar Cargo
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="bg-blue-100 hover:bg-blue-200 text-blue-700" 
                    onClick={() => setCargoFilter('pastor')}>Só Pastores</Button>
                  <Button size="sm" variant="outline" className="bg-green-100 hover:bg-green-200 text-green-700" 
                    onClick={() => setCargoFilter('cooperador')}>Só Cooperadores</Button>
                  <Button size="sm" variant="outline" className="bg-orange-100 hover:bg-orange-200 text-orange-700" 
                    onClick={() => setCargoFilter('presbítero')}>Só Presbíteros</Button>
                </div>
              </div>
            </div>

            {/* Ações Gerais */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-semibold mb-3 text-gray-800">⚡ Ações de Filtros</h3>
              <div className="flex flex-col md:flex-row gap-2 items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    onClick={() => {
                      const filtered = applyAdvancedFilters();
                      alert(`🔍 Filtros combinados aplicados!\n📊 Resultado: ${filtered.length} registros`);
                    }}
                  >
                    🔍 APLICAR TODOS
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("ALL");
                      setRegionFilter("ALL");
                      setPastorFilter("ALL");
                      setCargoFilter("ALL");
                      setCidadeFilter("ALL");
                      setTurnoFilter("ALL");
                      alert("🧹 Todos os filtros foram limpos!");
                    }}
                  >
                    🧹 Limpar Filtros
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      const filtered = applyAdvancedFilters();
                      exportFilteredData(filtered);
                    }}
                  >
                    📋 Exportar Filtrado
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros Avançados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Filtros de Pesquisa Avançados
            {isAdvancedFilterActive && (
              <Badge variant="secondary" className="ml-2">
                {filteredRecords.length} registros
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Configure filtros detalhados baseados em {reportData?.records?.length || 0} registros disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {/* Primeira seção: Filtros Temporais e Status */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="text-sm font-semibold mb-3 text-blue-800">📅 Filtros de Status e Busca</h3>
              <div className="flex flex-col md:flex-row gap-2 items-center">
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Filtrar por Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os Status</SelectItem>
                      <SelectItem value="Presente">Apenas Presentes</SelectItem>
                      <SelectItem value="Justificado">Apenas Justificados</SelectItem>
                      <SelectItem value="Ausente">Apenas Ausentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-sm font-medium">Buscar Pessoa</label>
                  <Input
                    type="text"
                    placeholder="Nome, CPF, Pastor..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full md:w-64"
                  />
                </div>
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-sm font-medium">Turnos</label>
                  <Select value={turnoFilter} onValueChange={setTurnoFilter}>
                    <SelectTrigger className="w-full md:w-48">
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
              </div>
            </div>

            {/* Segunda seção: Filtros de Hierarquia */}
            <div className="border rounded-lg p-4 bg-purple-50">
              <h3 className="text-sm font-semibold mb-3 text-purple-800">👥 Filtros de Hierarquia e Cargos</h3>
              <div className="flex flex-col md:flex-row gap-2 items-center">
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-sm font-medium">Pastor</label>
                  <Select value={pastorFilter} onValueChange={setPastorFilter}>
                    <SelectTrigger className="w-full md:w-48">
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
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-sm font-medium">Cargo/Posição</label>
                  <Select value={cargoFilter} onValueChange={setCargoFilter}>
                    <SelectTrigger className="w-full md:w-48">
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
                      <SelectItem value="membro">Apenas Membros</SelectItem>
                      {availableCargos.map(cargo => (
                        <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Terceira seção: Filtros Geográficos */}
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="text-sm font-semibold mb-3 text-green-800">🌍 Filtros Geográficos</h3>
              <div className="flex flex-col md:flex-row gap-2 items-center">
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-sm font-medium">Região</label>
                  <Select value={regionFilter} onValueChange={setRegionFilter}>
                    <SelectTrigger className="w-full md:w-48">
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
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-sm font-medium">Cidade</label>
                  <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
                    <SelectTrigger className="w-full md:w-48">
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
                <div className="flex flex-col gap-1 w-full md:w-auto">
                  <label className="text-sm font-medium">Reclassificação</label>
                  <Select value={reclassificacaoFilter} onValueChange={setReclassificacaoFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="Todas as Reclassif." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas</SelectItem>
                      {availableReclassificacoes.map(reclas => (
                        <SelectItem key={reclas} value={reclas}>{reclas}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Quarta seção: Filtros Rápidos e Ações */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-semibold mb-3 text-gray-800">⚡ Filtros Rápidos e Ações</h3>
              <div className="flex flex-col gap-3">
                {/* Filtros por cargo rápido */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="bg-blue-100 hover:bg-blue-200 text-blue-700" onClick={() => setCargoFilter('pastor')}>Só Pastores</Button>
                  <Button size="sm" variant="outline" className="bg-green-100 hover:bg-green-200 text-green-700" onClick={() => setCargoFilter('cooperador')}>Só Cooperadores</Button>
                  <Button size="sm" variant="outline" className="bg-orange-100 hover:bg-orange-200 text-orange-700" onClick={() => setCargoFilter('presbítero')}>Só Presbíteros</Button>
                  <Button size="sm" variant="outline" className="bg-red-100 hover:bg-red-200 text-red-700" onClick={() => setStatusFilter('Presente')}>Só Presentes</Button>
                  <Button size="sm" variant="outline" className="bg-yellow-100 hover:bg-yellow-200 text-yellow-700" onClick={() => setStatusFilter('Justificado')}>Só Justificados</Button>
                </div>
                
                {/* Botões de ação */}
                <div className="flex flex-col md:flex-row gap-2 items-center justify-between border-t pt-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearAllFilters}
                    >
                      🧹 Limpar Filtros
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRefresh}
                      disabled={loading}
                    >
                      🔄 Recarregar Dados
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Exibindo {filteredRecords.length} de {reportData?.records?.length || 0} registros</span>
                    {isAdvancedFilterActive && (
                      <Badge variant="outline" className="text-xs">Filtros ativos</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de presença por turno */}
        <Card>
          <CardHeader>
            <CardTitle>Presença por Turno</CardTitle>
            <CardDescription>
              Distribuição de presenças nos diferentes turnos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
              <BarChart accessibilityLayer data={attendanceByShift}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="shift"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="total" radius={8} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Card de presença por região removido conforme solicitado */}


        {/* Gráfico de presença por cargo */}
        <Card>
          <CardHeader>
            <CardTitle>Presentes e Justificados por Cargo</CardTitle>
            <CardDescription>
              Distribuição de presentes e justificados por cargo na igreja
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded bg-[hsl(var(--chart-1))]"></span>
                  <span className="text-sm">Presentes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded bg-[hsl(var(--chart-2))]"></span>
                  <span className="text-sm">Justificados</span>
                </div>
              </div>
              <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <BarChart accessibilityLayer data={attendanceByPosition} barCategoryGap={32} barGap={8}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="position"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    interval={0}
                    tick={{ fontSize: 14 }}
                  />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar dataKey="presentes" fill="hsl(var(--chart-1))" name="Presentes" radius={8} label={{ position: 'top', fontSize: 14 }} />
                  <Bar dataKey="justificados" fill="hsl(var(--chart-2))" name="Justificados" radius={8} label={{ position: 'top', fontSize: 14 }} />
                </BarChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de tendência semanal */}
        {weeklyStats.length > 0 && !isFilterActive && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Tendência Semanal</CardTitle>
              <CardDescription>
                Evolução da presença nos últimos 7 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <BarChart accessibilityLayer data={weeklyStats}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent 
                      formatter={(value, name) => [
                        `${value} ${name === 'present' ? 'presentes' : name === 'total' ? 'total' : 'taxa'}`,
                        name === 'present' ? 'Presentes' : name === 'total' ? 'Total' : 'Taxa (%)'
                      ]}
                    />}
                  />
                  <Bar dataKey="present" fill="hsl(var(--chart-1))" radius={4} />
                  <Bar dataKey="total" fill="hsl(var(--chart-2))" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Informações adicionais */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Detalhadas</CardTitle>
          <CardDescription>
            Estatísticas adicionais baseadas nos dados em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium">Taxa de Presença Geral</h4>
              <div className="text-2xl font-bold text-green-600">
                {reportData?.summary.attendanceRate || 0}%
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Turno Mais Popular</h4>
              <div className="text-lg font-semibold">
                {attendanceByShift.reduce((max, shift) => shift.total > max.total ? shift : max, { shift: '-', total: 0 }).shift}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Região Mais Ativa</h4>
              <div className="text-lg font-semibold">
                {attendanceByRegion.reduce((max, region) => region.total > max.total ? region : max, { region: '-', total: 0 }).region}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
