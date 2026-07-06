
"use client";
import Head from "next/head";

import { SynchronizedAnalytics } from "@/components/analytics/synchronized-analytics";
import { FilterPanel, type FilterState } from "@/components/filter-panel";
import { BirthdaysWidget } from "@/components/layout/birthdays-widget";
import { StatisticsDashboard } from "@/components/statistics-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRealtimeReports } from "@/hooks/use-reports";
import { getMembersRecords } from "@/lib/api-actions";
import type { AttendanceRecord } from "@/lib/types";
import { formatDateString } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Calendar,
  Database,
  ExternalLink,
  MapPin,
  RefreshCcw,
  TrendingUp,
  UserCheck,
  Users
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, BarChart as RechartsBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const DashboardContent = () => {
  const { reportData, loading, error, refreshData } = useRealtimeReports();
  const [membersCount, setMembersCount] = useState<number>(0);
  const [membersLoading, setMembersLoading] = useState<boolean>(true);

  // Evitar hydration mismatch no build/export: nao use `new Date()` como estado inicial.
  // Apos montar no browser, setamos a data de hoje (Manaus) como padrao.
  const [filters, setFilters] = useState<FilterState>({ dateFilter: "" });

  useEffect(() => {
    // So define a data padrao se o usuario ainda nao escolheu uma.
    setFilters((prev) => {
      if (prev.dateFilter) return prev;
      try {
        const todayManaus = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Manaus",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        return { ...prev, dateFilter: todayManaus };
      } catch {
        return { ...prev, dateFilter: new Date().toISOString().split("T")[0] };
      }
    });
  }, []);

  // Carregar contagem de membros (coleção members) separada da presença
  useEffect(() => {
    let active = true;
    const fetchMembers = async () => {
      try {
        setMembersLoading(true);
        const members = await getMembersRecords();
        if (active) setMembersCount(members.length);
      } catch (err) {
        console.error("Erro ao carregar members:", err);
        if (active) setMembersCount(0);
      } finally {
        if (active) setMembersLoading(false);
      }
    };
    fetchMembers();
    return () => {
      active = false;
    };
  }, []);

  // Função para atualizar filtros
  const updateFilters = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Estados para os modais
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [selectedShiftData, setSelectedShiftData] = useState<AttendanceRecord[]>([]);

  // Modal de Justificados por Turno
  const [isJustifiedShiftModalOpen, setIsJustifiedShiftModalOpen] = useState(false);
  const [selectedJustifiedShift, setSelectedJustifiedShift] = useState<string>("");
  const [selectedJustifiedShiftData, setSelectedJustifiedShiftData] = useState<AttendanceRecord[]>([]);

  // Modal de Justificados por Região
  const [isJustifiedRegionModalOpen, setIsJustifiedRegionModalOpen] = useState(false);
  const [selectedJustifiedRegion, setSelectedJustifiedRegion] = useState<string>("");
  const [selectedJustifiedRegionData, setSelectedJustifiedRegionData] = useState<AttendanceRecord[]>([]);

  // Modal de Presença por Região
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedRegionData, setSelectedRegionData] = useState<AttendanceRecord[]>([]);

  // Filtragem dos registros
  const filteredRecords = useMemo(() => {
    if (!reportData) return [];
    return reportData.records.filter((r: AttendanceRecord) => {
      // Filtro por Data
      if (filters.dateFilter) {
        if (!r.timestamp) return false;

        const dataRegistro = new Date(r.timestamp);
        const dataFiltro = new Date(filters.dateFilter);

        // Converte para o timezone do Amazonas para garantir comparação correta
        const dataRegistroManaus = new Date(dataRegistro.toLocaleString("en-US", { timeZone: "America/Manaus" }));
        const dataFiltroManaus = new Date(dataFiltro.toLocaleString("en-US", { timeZone: "America/Manaus" }));

        // Compara apenas a data (ano, mês, dia)
        const registroStr = dataRegistroManaus.toISOString().split('T')[0];
        const filtroStr = dataFiltroManaus.toISOString().split('T')[0];

        if (registroStr !== filtroStr) return false;
      }

      return true;
    });
  }, [reportData, filters]);

  // Registros recentes de presença (excluindo cadastros com status Ausente)
  const latestRealtimeRecords = useMemo(() => {
    if (!reportData?.records) return [];
    return reportData.records
      .filter((record: AttendanceRecord) =>
        Boolean(record.timestamp) &&
        (record.status === 'Presente' || record.status === 'Justificado')
      )
      .slice()
      .sort((a, b) => {
        const dataA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const dataB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return dataB - dataA;
      })
      .slice(0, 5);
  }, [reportData]);

  const formatManausDateTime = (timestamp?: Date | string | number | null) => {
    if (!timestamp) return "Data não informada";
    const dataOriginal = new Date(timestamp);
    const dataManaus = new Date(
      dataOriginal.toLocaleString("en-US", { timeZone: "America/Manaus" })
    );
    const dataFormatada = dataManaus.toLocaleDateString("pt-BR");
    const horaFormatada = dataManaus.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    return `${dataFormatada}, ${horaFormatada}`;
  };

  const getShiftFromTimestamp = (record: AttendanceRecord) => {
    const referenceDate = record.timestamp || record.createdAt || record.lastUpdated;

    if (!referenceDate) {
      return record.shift || "";
    }

    const dataOriginal = new Date(referenceDate);
    const dataManaus = new Date(
      dataOriginal.toLocaleString("en-US", { timeZone: "America/Manaus" })
    );

    const hour = dataManaus.getHours();

    if (hour < 12) return "Manhã";
    if (hour < 18) return "Tarde";
    return "Noite";
  };

  const handleRealtimeRefresh = () => {
    refreshData();
  };

  // Registros de presença (excluindo cadastros com status Ausente)
  const presenceRecords = useMemo(() => {
    return filteredRecords.filter((r: AttendanceRecord) =>
      r.status === "Presente" || r.status === "Justificado"
    );
  }, [filteredRecords]);

  // Cadastros novos (apenas status Ausente)
  const newRegistrations = useMemo(() => {
    return filteredRecords.filter((r: AttendanceRecord) => r.status === "Ausente");
  }, [filteredRecords]);

  // Estatísticas baseadas apenas nos registros de presença
  const stats = useMemo(() => {
    const total = presenceRecords.length;
    const present = presenceRecords.filter((r: AttendanceRecord) => r.status === "Presente").length;
    const justified = presenceRecords.filter((r: AttendanceRecord) => r.status === "Justificado").length;
    const absent = 0; // Não contabilizar Ausente nos gráficos
    const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : "0";

    return { total, present, justified, absent, attendanceRate };
  }, [presenceRecords]);

  // Função para lidar com clique no gráfico de turno
  const handleShiftClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedShift = data.activePayload[0].payload.shift;
      setSelectedShift(clickedShift);

      // Filtra registros do turno selecionado usando apenas dados de presença
      const shiftRecords = presenceRecords.filter((r: AttendanceRecord) => getShiftFromTimestamp(r) === clickedShift);
      setSelectedShiftData(shiftRecords);
      setIsShiftModalOpen(true);
    }
  };

  // Função para lidar com clique no gráfico de justificados por turno
  const handleJustifiedShiftClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedShift = data.activePayload[0].payload.shift;
      setSelectedJustifiedShift(clickedShift);

      // Filtra registros justificados do turno selecionado usando apenas dados de presença
      const justifiedShiftRecords = presenceRecords.filter((r: AttendanceRecord) =>
        getShiftFromTimestamp(r) === clickedShift && r.status === "Justificado"
      );
      setSelectedJustifiedShiftData(justifiedShiftRecords);
      setIsJustifiedShiftModalOpen(true);
    }
  };

  // Função para lidar com clique no gráfico de justificados por região
  const handleJustifiedRegionClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedRegion = data.activePayload[0].payload.region;
      setSelectedJustifiedRegion(clickedRegion);

      // Filtra registros justificados da região selecionada usando apenas dados de presença
      const justifiedRegionRecords = presenceRecords.filter((r: AttendanceRecord) =>
        r.region === clickedRegion && r.status === "Justificado"
      );
      setSelectedJustifiedRegionData(justifiedRegionRecords);
      setIsJustifiedRegionModalOpen(true);
    }
  };

  // Função para lidar com clique no gráfico de presença por região
  const handleRegionClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedRegion = data.activePayload[0].payload.region;
      setSelectedRegion(clickedRegion);

      // Filtra registros da região selecionada usando apenas dados de presença
      const regionRecords = presenceRecords.filter((r: AttendanceRecord) => r.region === clickedRegion);
      setSelectedRegionData(regionRecords);
      setIsRegionModalOpen(true);
    }
  };

  // Dados para gráficos baseados apenas em registros de presença (excluindo cadastros)
  const chartData = useMemo(() => {

    // Presença por turno (apenas Manhã e Tarde) - somente Presente e Justificado
    const shifts = ["Manhã", "Tarde"];
    const attendanceByShift = shifts.map(shift => ({
      shift,
      total: presenceRecords.filter((r: AttendanceRecord) => getShiftFromTimestamp(r) === shift).length,
      fill: shift === "Manhã" ? "#3b82f6" : "#10b981"
    }));

    // Status da presença (apenas Presente e Justificado para não misturar com cadastros)
    const statusData = [
      { status: "Presente", total: presenceRecords.filter((r: AttendanceRecord) => r.status === "Presente").length, fill: "#22c55e" },
      { status: "Justificado", total: presenceRecords.filter((r: AttendanceRecord) => r.status === "Justificado").length, fill: "#eab308" }
    ];

    // Justificados por turno (apenas registros de presença)
    const justificadosByShift = shifts.map(shift => ({
      shift,
      total: presenceRecords.filter((r: AttendanceRecord) => getShiftFromTimestamp(r) === shift && r.status === "Justificado").length,
      fill: shift === "Manhã" ? "#fbbf24" : "#f59e0b"
    }));

    // Justificados por região (Top 5) - apenas registros de presença
    const justificadosRegionCounts: Record<string, number> = {};
    presenceRecords.filter((r: AttendanceRecord) => r.status === "Justificado").forEach((r: AttendanceRecord) => {
      if (r.region) {
        justificadosRegionCounts[r.region] = (justificadosRegionCounts[r.region] || 0) + 1;
      }
    });

    const justificadosColors = ["#f59e0b", "#eab308", "#fbbf24", "#fcd34d", "#fde68a"];

    const justificadosByRegion = Object.entries(justificadosRegionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([region, total], index) => ({
        region,
        total,
        fill: justificadosColors[index % justificadosColors.length]
      }));

    // Top 10 regiões (apenas registros de presença)
    const regionCounts: Record<string, number> = {};
    presenceRecords.forEach((r: AttendanceRecord) => {
      if (r.region) {
        regionCounts[r.region] = (regionCounts[r.region] || 0) + 1;
      }
    });

    const regionColors = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#ef4444",
      "#06b6d4", "#d946ef", "#84cc16", "#f59e0b", "#64748b"];

    const attendanceByRegion = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([region, total], index) => ({
        region,
        total,
        fill: regionColors[index % regionColors.length]
      }));

    return { attendanceByShift, statusData, attendanceByRegion, justificadosByShift, justificadosByRegion };
  }, [filteredRecords]);

  // Paginação usando apenas registros de presença
  const totalPages = Math.ceil(presenceRecords.length / pageSize);
  const paginatedRecords = presenceRecords.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [filteredRecords]);

  // ... restante do código ...

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
      {/* Conteúdo Principal - 3 colunas em desktop, 1 coluna em mobile */}
      <div className="lg:col-span-3 flex flex-col gap-4 sm:gap-6 lg:gap-8">
        {/* Filtros de Busca */}
        <div className="space-y-3 sm:space-y-4">
          <FilterPanel
            records={reportData?.records || []}
            filters={filters}
            onFiltersChange={updateFilters}
            compact={true}
          />
        </div>

        {/* Painel de Acesso Rápido */}
        <div className="flex justify-end">
          <Link href="/admin/monitoring">
            <Button variant="outline" className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Monitoramento do Sistema</span>
              <span className="sm:hidden">Monitoramento</span>
            </Button>
          </Link>
        </div>

        {/* Indicador de Data Filtrada */}
        {filters.dateFilter && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center border-l-4 border-l-blue-500">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">
                📊 Dados de {formatDateString(filters.dateFilter)}
              </span>
            </div>
            <p className="text-xs text-blue-600">
              {presenceRecords.length > 0
                ? `${presenceRecords.length} registro${presenceRecords.length !== 1 ? 's' : ''} de presença encontrado${presenceRecords.length !== 1 ? 's' : ''}`
                : '⚠️ Nenhum registro de presença para esta data'
              }
              {newRegistrations.length > 0 && (
                <span className="ml-2 text-orange-600">
                  • {newRegistrations.length} cadastro{newRegistrations.length !== 1 ? 's' : ''} novo{newRegistrations.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        )}

        {!filters.dateFilter && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center border-l-4 border-l-orange-500">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Database className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-800">
                📈 Todos os dados históricos
              </span>
            </div>
            <p className="text-xs text-orange-600">
              {filteredRecords.length} registro{filteredRecords.length !== 1 ? 's' : ''} no total
            </p>
          </div>
        )}

        {/* Cards de Estatísticas - Reorganizados com Animações */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card Membros (coleção members) */}
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950 dark:to-gray-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                👥 Membros (cadastro)
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 animate-in fade-in duration-500">
                {membersLoading ? '...' : membersCount}
              </div>
              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1 font-medium">
                Total de membros cadastrados (coleção members)
              </p>
            </CardContent>
          </Card>

          {/* Card Presentes */}
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950 dark:to-gray-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400">
                ✅ Presentes
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 animate-in fade-in duration-500">
                {stats.present}
              </div>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1 font-medium">
                {stats.present === 0 ? '🔍 Aguardando registros' : `${((stats.present / stats.total) * 100).toFixed(0)}% do total`}
              </p>
            </CardContent>
          </Card>

          {/* Card Justificados */}
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-yellow-500 bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950 dark:to-gray-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                📝 Justificados
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 animate-in fade-in duration-500">
                {stats.justified}
              </div>
              <p className="text-xs text-yellow-600/70 dark:text-yellow-400/70 mt-1 font-medium">
                {stats.justified === 0 ? '✨ Nenhuma justificativa' : `${((stats.justified / stats.total) * 100).toFixed(0)}% do total`}
              </p>
            </CardContent>
          </Card>

          {/* Card Total de Presenças */}
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                📊 Total
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 animate-in fade-in duration-500">
                {stats.total}
              </div>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1 font-medium">
                {stats.total === 0 ? '🚀 Comece a registrar' : 'Registros de presença'}
              </p>
            </CardContent>
          </Card>

          {/* Card Cadastros Novos */}
          {newRegistrations.length > 0 ? (
            <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950 dark:to-gray-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                  🆕 Cadastros
                </CardTitle>
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center animate-pulse">
                  <UserCheck className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 animate-in fade-in duration-500">
                  {newRegistrations.length}
                </div>
                <p className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-1 font-medium">
                  ⏳ Aguardando presença
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950 dark:to-gray-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-400">
                  📈 Taxa de Presença
                </CardTitle>
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 animate-in fade-in duration-500">
                  {stats.attendanceRate}%
                </div>
                <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mt-1 font-medium">
                  {stats.total === 0 ? '📊 Sem dados' : 'Taxa de comparecimento'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dashboard de Estatísticas Detalhadas */}
        <StatisticsDashboard
          records={filteredRecords}
          className="mb-8"
        />

        <SynchronizedAnalytics />

        {/* Seção de Gráficos Interativos */}
        {stats.total > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Primeira linha de gráficos - 2 gráficos principais */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Gráfico de Presença por Turno */}
              <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Presença por Turno
                  </CardTitle>
                  <CardDescription>
                    Distribuição de presenças nos diferentes turnos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={chartData.attendanceByShift}
                        onClick={handleShiftClick}
                        style={{ cursor: 'pointer' }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="shift" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => [`${value} participantes`, "Total"]}
                          labelFormatter={(label) => `Turno: ${label} (Clique para ver detalhes)`}
                        />
                        <Bar
                          dataKey="total"
                          name="Participantes"
                          radius={[4, 4, 0, 0]}
                        >
                          {chartData.attendanceByShift.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    💡 Clique nas barras para ver detalhes dos participantes por turno
                  </p>
                </CardContent>
              </Card>

              {/* Gráfico de Justificados por Turno */}
              <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                    Justificados por Turno
                  </CardTitle>
                  <CardDescription>
                    Ausências justificadas distribuídas por turno
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={chartData.justificadosByShift}
                        onClick={handleJustifiedShiftClick}
                        style={{ cursor: 'pointer' }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="shift" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => [`${value} justificados`, "Total"]}
                          labelFormatter={(label) => `Turno: ${label} (Clique para ver detalhes)`}
                        />
                        <Bar
                          dataKey="total"
                          name="Justificados"
                          radius={[4, 4, 0, 0]}
                        >
                          {chartData.justificadosByShift.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    � Clique nas barras para ver detalhes dos justificados por turno
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Segunda linha de gráficos - 1 gráfico centralizado */}
            <div className="grid gap-6 md:grid-cols-1 max-w-4xl mx-auto">
              {/* NOVO: Gráfico de Justificados por Região */}
              <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-yellow-600" />
                    Justificados por Região
                  </CardTitle>
                  <CardDescription>
                    Top 5 regiões com mais ausências justificadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={chartData.justificadosByRegion}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        onClick={handleJustifiedRegionClick}
                        style={{ cursor: 'pointer' }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="region"
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={60}
                        />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => [`${value} justificados`, "Total"]}
                          labelFormatter={(label) => `Região: ${label} (Clique para ver detalhes)`}
                        />
                        <Bar
                          dataKey="total"
                          name="Justificados"
                          radius={[4, 4, 0, 0]}
                        >
                          {chartData.justificadosByRegion.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    💡 Clique nas barras para ver detalhes dos justificados por região
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Terceira linha - Gráfico por região expandido */}
            <div className="grid gap-6">
              {/* Gráfico de Presença por Região */}
              <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <CardTitle>Presença por Região</CardTitle>
                  <CardDescription>
                    Top 10 regiões com maior participação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={chartData.attendanceByRegion}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        onClick={handleRegionClick}
                        style={{ cursor: "pointer" }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="region"
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={60}
                        />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="total" name="Participantes" radius={[4, 4, 0, 0]}>
                          {chartData.attendanceByRegion.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    💡 Clique nas barras para ver detalhes dos participantes por região
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Registros Recentes */}
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Activity className="h-5 w-5 text-emerald-600" />
                Registros Recentes
              </CardTitle>
              <CardDescription>
                Atualizações em tempo real com base nas últimas presenças registradas
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRealtimeRefresh}
                disabled={loading}
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span className="ml-2 text-sm">
                  {loading ? "Atualizando..." : "Atualizar"}
                </span>
              </Button>
              <Button variant="ghost" size="sm" className="gap-2" asChild>
                <Link href="/monitor/registros-recentes" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Tela cheia
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                Não foi possível carregar os registros recentes. Tente novamente em instantes.
              </div>
            )}

            {latestRealtimeRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-200 py-10 text-center text-sm text-muted-foreground">
                Nenhum registro encontrado ainda. Assim que novas presenças forem marcadas, elas aparecerão aqui.
              </div>
            ) : (
              <div className="space-y-2">
                {latestRealtimeRecords.map((record, index) => {
                  const statusIcon = record.status === "Presente" ? "✅" : record.status === "Justificado" ? "📝" : "❌";
                  const statusColor = record.status === "Presente"
                    ? "text-emerald-600"
                    : record.status === "Justificado"
                      ? "text-amber-600"
                      : "text-red-600";
                  const key = record.id || `${record.cpf}-${record.timestamp}-${index}`;

                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 animate-in fade-in slide-in-from-left duration-500 transition-shadow"
                      style={{ animationDelay: `${index * 100}ms` }}
                      suppressHydrationWarning
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-slate-900">
                            {record.fullName || "Nome não informado"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {record.region || "Região não informada"}
                            <span className="mx-1">•</span>
                            <span className={`font-medium ${statusColor}`}>
                              Status: {record.status || "Presente"}
                            </span>
                          </div>
                        </div>
                        <span className="text-lg">{statusIcon}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatManausDateTime(record.timestamp)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela de Registros Filtrados - Otimizada para Mobile */}
        {presenceRecords.length > 0 && (
          <Card className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📋 Registros de Presença ({presenceRecords.length})
              </CardTitle>
              <CardDescription>
                {filters.dateFilter
                  ? `Lista de registros para ${formatDateString(filters.dateFilter)}`
                  : 'Todos os registros históricos do sistema'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Versão Desktop - Tabela tradicional */}
              <div className="hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-3 border text-left font-medium">Nome</th>
                        <th className="p-3 border text-left font-medium">CPF</th>
                        <th className="p-3 border text-left font-medium">Cargo</th>
                        <th className="p-3 border text-left font-medium">Pastor</th>
                        <th className="p-3 border text-left font-medium">Região</th>
                        <th className="p-3 border text-left font-medium">Status</th>
                        <th className="p-3 border text-left font-medium">Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((record, index) => {
                        const statusIcon = record.status === "Presente" ? "✅" :
                          record.status === "Justificado" ? "📝" : "❌";
                        const statusColor = record.status === "Presente" ? "text-green-600" :
                          record.status === "Justificado" ? "text-yellow-600" : "text-red-600";

                        return (
                          <tr
                            key={record.id}
                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 animate-in fade-in slide-in-from-right duration-500 transition-colors`}
                            style={{ animationDelay: `${index * 50}ms` }}
                            suppressHydrationWarning
                          >
                            <td className="p-3 border font-medium">{record.fullName || 'N/A'}</td>
                            <td className="p-3 border font-mono text-xs">{record.cpf || 'N/A'}</td>
                            <td className="p-3 border">{record.churchPosition || 'N/A'}</td>
                            <td className="p-3 border">{record.pastorName || 'N/A'}</td>
                            <td className="p-3 border">{record.region || 'N/A'}</td>
                            <td className={`p-3 border font-medium ${statusColor}`}>
                              <span className="flex items-center gap-1">
                                {statusIcon} {record.status || 'Presente'}
                              </span>
                            </td>
                            <td className="p-3 border text-xs">
                              {record.timestamp
                                ? `${new Date(record.timestamp).toLocaleDateString('pt-BR')} ${new Date(record.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                : 'N/A'
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Versão Mobile - Cards empilháveis */}
              <div className="block lg:hidden">
                <div className="space-y-3">
                  {paginatedRecords.map((record, index) => {
                    const statusIcon = record.status === "Presente" ? "✅" :
                      record.status === "Justificado" ? "📝" : "❌";
                    const statusColor = record.status === "Presente" ? "text-green-600" :
                      record.status === "Justificado" ? "text-yellow-600" : "text-red-600";

                    return (
                      <div
                        key={record.id}
                        className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom duration-500 transition-shadow"
                        style={{ animationDelay: `${index * 50}ms` }}
                        suppressHydrationWarning
                      >
                        {/* Linha 1: Nome e Status */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-gray-900 truncate mr-2">
                            {record.fullName || 'N/A'}
                          </div>
                          <div className={`flex items-center gap-1 font-medium ${statusColor} text-sm`}>
                            {statusIcon} {record.status || 'Presente'}
                          </div>
                        </div>

                        {/* Linha 2: CPF e Cargo */}
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
                          <div>
                            <span className="font-medium text-gray-700">CPF:</span>
                            <div className="font-mono text-xs">{record.cpf || 'N/A'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Cargo:</span>
                            <div className="truncate">{record.churchPosition || 'N/A'}</div>
                          </div>
                        </div>

                        {/* Linha 3: Pastor e Região */}
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
                          <div>
                            <span className="font-medium text-gray-700">Pastor:</span>
                            <div className="truncate">{record.pastorName || 'N/A'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Região:</span>
                            <div className="truncate">{record.region || 'N/A'}</div>
                          </div>
                        </div>

                        {/* Linha 4: Data/Hora */}
                        <div className="text-xs text-gray-500 pt-2 border-t">
                          <span className="font-medium">Data/Hora:</span> {
                            record.timestamp
                              ? `${new Date(record.timestamp).toLocaleDateString('pt-BR')} às ${new Date(record.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                              : 'N/A'
                          }
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t animate-in fade-in slide-in-from-bottom duration-700">
                  <div className="text-sm text-gray-600">
                    Página {page} de {totalPages} ({presenceRecords.length} registros de presença)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="hover:scale-105 transition-transform duration-200"
                    >
                      ← Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="hover:scale-105 transition-transform duration-200"
                    >
                      Próxima →
                    </Button>
                  </div>
                </div>
              )}

              {/* Botão de Exportação */}
              <div className="flex justify-center mt-4 pt-4 border-t animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '100ms' }} suppressHydrationWarning>
                <Button
                  onClick={() => {
                    const headers = ['Nome', 'CPF', 'Cargo', 'Pastor', 'Região', 'Status', 'Data/Hora'];
                    const csvContent = [
                      headers.join(','),
                      ...filteredRecords.map(r => [
                        `"${r.fullName || ''}"`,
                        `"${r.cpf || ''}"`,
                        `"${r.churchPosition || ''}"`,
                        `"${r.pastorName || ''}"`,
                        `"${r.region || ''}"`,
                        `"${r.status || 'Presente'}"`,
                        r.timestamp ? `"${new Date(r.timestamp).toLocaleDateString('pt-BR')} ${new Date(r.timestamp).toLocaleTimeString('pt-BR')}"` : ''
                      ].join(','))
                    ].join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    const dataStr = filters.dateFilter || new Date().toISOString().split('T')[0];
                    link.setAttribute('download', `registros-presenca-${dataStr}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  📥 Exportar Registros CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de Detalhes do Turno */}
        <Dialog open={isShiftModalOpen} onOpenChange={setIsShiftModalOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
            <DialogHeader className="animate-in slide-in-from-top duration-300">
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Detalhes do Turno: {selectedShift}
              </DialogTitle>
              <DialogDescription>
                Lista completa dos participantes do turno {selectedShift} de hoje
                ({selectedShiftData.length} pessoas)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Estatísticas do Turno */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg animate-in fade-in slide-in-from-bottom duration-500">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedShiftData.length}
                  </div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {selectedShiftData.filter(r => r.status === 'Presente').length}
                  </div>
                  <div className="text-sm text-gray-600">Presente</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {selectedShiftData.filter(r => r.status === 'Justificado').length}
                  </div>
                  <div className="text-sm text-gray-600">Justificado</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {selectedShiftData.filter(r => r.status === 'Ausente').length}
                  </div>
                  <div className="text-sm text-gray-600">Ausente</div>
                </div>
              </div>

              {/* Lista de Participantes */}
              <div>
                <h4 className="font-semibold mb-3">👥 Lista de Participantes</h4>
                {selectedShiftData.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    Nenhum participante encontrado para este turno.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 border text-left">Nome</th>
                          <th className="p-2 border text-left">CPF</th>
                          <th className="p-2 border text-left">Cargo</th>
                          <th className="p-2 border text-left">Pastor</th>
                          <th className="p-2 border text-left">Região</th>
                          <th className="p-2 border text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedShiftData.map((record, index) => (
                          <tr
                            key={record.id}
                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 animate-in fade-in slide-in-from-right duration-300 transition-colors`}
                            style={{ animationDelay: `${index * 30}ms` }}
                            suppressHydrationWarning
                          >
                            <td className="p-2 border">{record.fullName}</td>
                            <td className="p-2 border font-mono text-xs">{record.cpf}</td>
                            <td className="p-2 border">{record.churchPosition}</td>
                            <td className="p-2 border">{record.pastorName}</td>
                            <td className="p-2 border">{record.region}</td>
                            <td className="p-2 border">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${record.status === 'Presente' ? 'bg-green-100 text-green-800' :
                                record.status === 'Justificado' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                {record.status || 'Presente'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Distribuição por Cargo */}
              {selectedShiftData.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">📊 Distribuição por Cargo</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(
                      selectedShiftData.reduce((acc: Record<string, number>, record) => {
                        const cargo = record.churchPosition || 'Não informado';
                        acc[cargo] = (acc[cargo] || 0) + 1;
                        return acc;
                      }, {})
                    )
                      .sort(([, a], [, b]) => b - a)
                      .map(([cargo, count]) => (
                        <div key={cargo} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                          <span className="text-sm">{cargo}:</span>
                          <span className="font-bold text-blue-600">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => {
                    // Exportar dados do turno para CSV
                    const headers = ['Nome', 'CPF', 'Cargo', 'Pastor', 'Região', 'Status', 'Data/Hora'];
                    const csvContent = [
                      headers.join(','),
                      ...selectedShiftData.map(r => [
                        `"${r.fullName || ''}"`,
                        `"${r.cpf || ''}"`,
                        `"${r.churchPosition || ''}"`,
                        `"${r.pastorName || ''}"`,
                        `"${r.region || ''}"`,
                        `"${r.status || 'Presente'}"`,
                        r.timestamp ? `"${new Date(r.timestamp).toLocaleDateString('pt-BR')} ${new Date(r.timestamp).toLocaleTimeString('pt-BR')}"` : ''
                      ].join(','))
                    ].join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    const dataStr = new Date().toISOString().split('T')[0];
                    link.setAttribute('download', `relatorio-turno-${selectedShift}-${dataStr}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  📥 Exportar Turno
                </Button>
                <Button
                  onClick={() => setIsShiftModalOpen(false)}
                  variant="default"
                  className="flex-1"
                >
                  ✖️ Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Detalhes dos Justificados por Turno */}
        <Dialog open={isJustifiedShiftModalOpen} onOpenChange={setIsJustifiedShiftModalOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
            <DialogHeader className="animate-in slide-in-from-top duration-300">
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
                Justificados no Turno: {selectedJustifiedShift}
              </DialogTitle>
              <DialogDescription>
                Lista completa dos participantes com ausência justificada no turno {selectedJustifiedShift} de hoje
                ({selectedJustifiedShiftData.length} pessoas)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Estatísticas dos Justificados */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-yellow-50 rounded-lg animate-in fade-in slide-in-from-bottom duration-500">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {selectedJustifiedShiftData.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Justificados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {[...new Set(selectedJustifiedShiftData.map(r => r.churchPosition))].length}
                  </div>
                  <div className="text-sm text-gray-600">Cargos Diferentes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {[...new Set(selectedJustifiedShiftData.map(r => r.region))].length}
                  </div>
                  <div className="text-sm text-gray-600">Regiões</div>
                </div>
              </div>

              {/* Lista de Participantes */}
              <div>
                <h4 className="font-semibold mb-3">📝 Lista de Justificados</h4>
                {selectedJustifiedShiftData.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    Nenhum participante justificado encontrado para este turno.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm">
                      <thead>
                        <tr className="bg-yellow-100">
                          <th className="p-2 border text-left">Nome</th>
                          <th className="p-2 border text-left">CPF</th>
                          <th className="p-2 border text-left">Cargo</th>
                          <th className="p-2 border text-left">Pastor</th>
                          <th className="p-2 border text-left">Região</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedJustifiedShiftData.map((record, index) => (
                          <tr
                            key={record.id}
                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-yellow-50'} hover:bg-yellow-100 animate-in fade-in slide-in-from-right duration-300 transition-colors`}
                            style={{ animationDelay: `${index * 30}ms` }}
                            suppressHydrationWarning
                          >
                            <td className="p-2 border">{record.fullName}</td>
                            <td className="p-2 border font-mono text-xs">{record.cpf}</td>
                            <td className="p-2 border">{record.churchPosition}</td>
                            <td className="p-2 border">{record.pastorName}</td>
                            <td className="p-2 border">{record.region}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => setIsJustifiedShiftModalOpen(false)}
                  variant="default"
                  className="flex-1"
                >
                  ✖️ Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Detalhes dos Justificados por Região */}
        <Dialog open={isJustifiedRegionModalOpen} onOpenChange={setIsJustifiedRegionModalOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
            <DialogHeader className="animate-in slide-in-from-top duration-300">
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-yellow-600" />
                Justificados na Região: {selectedJustifiedRegion}
              </DialogTitle>
              <DialogDescription>
                Lista completa dos participantes com ausência justificada na região {selectedJustifiedRegion} de hoje
                ({selectedJustifiedRegionData.length} pessoas)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Estatísticas dos Justificados por Região */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-yellow-50 rounded-lg animate-in fade-in slide-in-from-bottom duration-500">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {selectedJustifiedRegionData.length}
                  </div>
                  <div className="text-sm text-gray-600">Total Justificados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedJustifiedRegionData.filter(r => getShiftFromTimestamp(r) === 'Manhã').length}
                  </div>
                  <div className="text-sm text-gray-600">Manhã</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {selectedJustifiedRegionData.filter(r => getShiftFromTimestamp(r) === 'Tarde').length}
                  </div>
                  <div className="text-sm text-gray-600">Tarde</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {[...new Set(selectedJustifiedRegionData.map(r => r.churchPosition))].length}
                  </div>
                  <div className="text-sm text-gray-600">Cargos</div>
                </div>
              </div>

              {/* Lista de Participantes */}
              <div>
                <h4 className="font-semibold mb-3">🌍 Lista de Justificados por Região</h4>
                {selectedJustifiedRegionData.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    Nenhum participante justificado encontrado para esta região.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm">
                      <thead>
                        <tr className="bg-yellow-100">
                          <th className="p-2 border text-left">Nome</th>
                          <th className="p-2 border text-left">CPF</th>
                          <th className="p-2 border text-left">Cargo</th>
                          <th className="p-2 border text-left">Turno</th>
                          <th className="p-2 border text-left">Pastor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedJustifiedRegionData.map((record, index) => (
                          <tr
                            className={`${index % 2 === 0 ? 'bg-white' : 'bg-yellow-50'} hover:bg-yellow-100 animate-in fade-in slide-in-from-right duration-300 transition-colors`}
                            style={{ animationDelay: `${index * 30}ms` }}
                            suppressHydrationWarning
                          >
                            <td className="p-2 border">{record.fullName}</td>
                            <td className="p-2 border font-mono text-xs">{record.cpf}</td>
                            <td className="p-2 border">{record.churchPosition}</td>
                            <td className="p-2 border">{getShiftFromTimestamp(record)}</td>
                            <td className="p-2 border">{record.pastorName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Distribuição por Turno */}
              {selectedJustifiedRegionData.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">📊 Distribuição por Turno</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {['Manhã', 'Tarde'].map(turno => {
                      const count = selectedJustifiedRegionData.filter(r => getShiftFromTimestamp(r) === turno).length;
                      return (
                        <div key={turno} className="flex justify-between items-center p-3 bg-blue-50 rounded">
                          <span className="text-sm font-medium">{turno}:</span>
                          <span className="font-bold text-blue-600">{count} justificados</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => setIsJustifiedRegionModalOpen(false)}
                  variant="default"
                  className="flex-1"
                >
                  ✖️ Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Presença por Região */}
        <Dialog open={isRegionModalOpen} onOpenChange={setIsRegionModalOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-300">
            <DialogHeader className="animate-in slide-in-from-top duration-300">
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Detalhes da Região: {selectedRegion}
              </DialogTitle>
              <DialogDescription>
                Lista completa dos participantes da região {selectedRegion} de hoje
                ({selectedRegionData.length} pessoas)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Estatísticas Resumidas */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg animate-in fade-in slide-in-from-bottom duration-500">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {selectedRegionData.filter(r => r.status === "Presente").length}
                  </div>
                  <div className="text-sm text-gray-600">Presentes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {selectedRegionData.filter(r => r.status === "Justificado").length}
                  </div>
                  <div className="text-sm text-gray-600">Justificados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {selectedRegionData.filter(r => r.status === "Ausente").length}
                  </div>
                  <div className="text-sm text-gray-600">Ausentes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {selectedRegionData.length > 0 ?
                      ((selectedRegionData.filter(r => r.status === "Presente").length / selectedRegionData.length) * 100).toFixed(1) : 0}%
                  </div>
                  <div className="text-sm text-gray-600">Taxa Presença</div>
                </div>
              </div>

              {/* Lista de Participantes */}
              {selectedRegionData.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Lista de Participantes
                  </h4>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {selectedRegionData.map((record, index) => {
                      const statusIcon = record.status === "Presente" ? "✅" :
                        record.status === "Justificado" ? "📝" : "❌";
                      const statusColor = record.status === "Presente" ? "text-green-600" :
                        record.status === "Justificado" ? "text-yellow-600" : "text-red-600";

                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-white rounded border hover:shadow-md hover:-translate-y-0.5 animate-in fade-in slide-in-from-left duration-300 transition-shadow"
                          style={{ animationDelay: `${index * 30}ms` }}
                          suppressHydrationWarning
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{statusIcon}</span>
                            <div>
                              <div className="font-medium">{record.fullName}</div>
                              <div className="text-sm text-gray-500">
                                {record.shift} • {record.region}
                                {getShiftFromTimestamp(record)} • {record.region}
                              </div>
                            </div>
                          </div>
                          <div className={`text-sm font-medium ${statusColor}`}>
                            {record.status}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => setIsRegionModalOpen(false)}
                  variant="default"
                  className="flex-1"
                >
                  ✖️ Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sidebar Direita - Widget de Aniversariantes - 1 coluna em desktop, full width em mobile */}
      <div className="lg:col-span-1">
        <div className="sticky top-6">
          <BirthdaysWidget />
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </Head>
      <DashboardContent />
    </>
  );
}
