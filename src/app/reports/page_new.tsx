"use client"

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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeReports } from "@/hooks/use-reports";
import type { AttendanceRecord } from "@/lib/types";
import { CheckCircle, Clock, Download, Filter, RefreshCw, TrendingUp, Users, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

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
    if (!dataSource) return { attendanceByShift: [], statusData: [], attendanceByPosition: [], attendanceByRegion: [] };

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
    const attendanceByPosition = (isAdvancedFilterActive && filteredStats ? filteredStats.cargoStats : 
      reportData ? reportData.byPosition ? Object.entries(reportData.byPosition).map(([position, count]) => ({
        position,
        presente: reportData.records.filter(r => r.status === 'Presente' && r.churchPosition === position).length,
        justificado: reportData.records.filter(r => r.status === 'Justificado' && r.churchPosition === position).length
      })) : [] : []
    );

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
                {isAdvancedFilterActive && (
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

      {/* Dashboard de Estatísticas Detalhadas - StatisticsDashboard Component */}
      {reportData?.records && (
        <StatisticsDashboard 
          records={isAdvancedFilterActive ? filteredRecords : reportData.records} 
          className="w-full max-w-6xl mx-auto mb-6" 
        />
      )}

      {/* Seção de Gráficos Responsivos aos Filtros */}
      <div className="grid gap-6 md:grid-cols-2 w-full max-w-6xl mx-auto">
        {/* Gráfico de Presença por Turno */}
        <Card>
          <CardHeader>
            <CardTitle>Presença por Turno</CardTitle>
            <CardDescription>
              Distribuição de presenças nos diferentes turnos
              {isAdvancedFilterActive && " (dados filtrados)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[200px] w-full"
            >
              <BarChart accessibilityLayer data={chartData.attendanceByShift}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="shift"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Status Geral */}
        <Card>
          <CardHeader>
            <CardTitle>Status da Presença</CardTitle>
            <CardDescription>
              Distribuição geral dos status de presença
              {isAdvancedFilterActive && " (dados filtrados)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[200px] w-full"
            >
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData.statusData}
                    dataKey="total"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {chartData.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Presentes e Justificados por Cargo */}
        <Card>
          <CardHeader>
            <CardTitle>Presentes e Justificados por Cargo</CardTitle>
            <CardDescription>
              Distribuição de presentes e justificados por cargo na igreja
              {isAdvancedFilterActive && " (dados filtrados)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[300px] w-full"
            >
              <BarChart accessibilityLayer data={chartData.attendanceByPosition} barCategoryGap={32} barGap={8}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="position"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="presente" fill="#22c55e" radius={4} />
                <Bar dataKey="justificado" fill="#eab308" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Top 10 Regiões */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Regiões</CardTitle>
            <CardDescription>
              Regiões com maior número de registros
              {isAdvancedFilterActive && " (dados filtrados)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={chartConfig}
              className="min-h-[300px] w-full"
            >
              <BarChart accessibilityLayer data={chartData.attendanceByRegion}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="region"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Informações Detalhadas */}
      <Card className="w-full max-w-6xl mx-auto mt-6">
        <CardHeader>
          <CardTitle>Informações Detalhadas</CardTitle>
          <CardDescription>
            Estatísticas adicionais baseadas nos dados 
            {isAdvancedFilterActive ? " filtrados" : " em tempo real"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {isAdvancedFilterActive && filteredStats ? 
                  `${((filteredStats.summary.present / filteredStats.summary.total) * 100).toFixed(2)}%` :
                  reportData ? `${((reportData.summary.present / reportData.summary.total) * 100).toFixed(2)}%` : '0%'
                }
              </div>
              <div className="text-sm text-muted-foreground">Taxa de Presença Geral</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {chartData.attendanceByShift.length > 0 ? 
                  chartData.attendanceByShift.reduce((max: any, shift: any) => shift.total > max.total ? shift : max, { shift: '-', total: 0 }).shift :
                  'Não disponível'
                }
              </div>
              <div className="text-sm text-muted-foreground">Turno Mais Popular</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {chartData.attendanceByRegion.length > 0 ? 
                  chartData.attendanceByRegion[0]?.region || 'Não disponível' :
                  'Não disponível'
                }
              </div>
              <div className="text-sm text-muted-foreground">Região Mais Ativa</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
