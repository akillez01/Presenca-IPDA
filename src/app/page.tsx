
"use client";
import { AuthGuard } from "@/components/auth/auth-guard";
import Head from "next/head";

import { SynchronizedAnalytics } from "@/components/analytics/synchronized-analytics";
import { StatisticsDashboard } from "@/components/statistics-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRealtimeReports } from "@/hooks/use-reports";
import type { AttendanceRecord } from "@/lib/types";
import {
  BarChart3,
  Calendar,
  TrendingUp,
  UserCheck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, Legend, Pie, PieChart, BarChart as RechartsBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Definir todayDateStr uma única vez após os useState
const todayDateStr = new Date().toISOString().slice(0, 10);

// ... código existente ...

const DashboardContent = () => {
  const { reportData, loading, error, refreshData } = useRealtimeReports();
  const [selectedDate, setSelectedDate] = useState("");
  const [turnoFilter, setTurnoFilter] = useState("ALL");
  const [cargoFilter, setCargoFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [cidadeFilter, setCidadeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ... outros estados ...

  // Filtragem dos registros
  const filteredRecords = useMemo(() => {
    if (!reportData) return [];
    return reportData.records.filter((r: AttendanceRecord) => {
      if (selectedDate && r.timestamp.toISOString().slice(0, 10) !== selectedDate) return false;
      if (turnoFilter !== "ALL" && r.shift !== turnoFilter) return false;
      if (cargoFilter !== "ALL" && r.churchPosition !== cargoFilter) return false;
      if (regionFilter !== "ALL" && r.region !== regionFilter) return false;
      if (cidadeFilter !== "ALL" && r.city !== cidadeFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.fullName?.toLowerCase().includes(s) ||
          r.cpf?.toLowerCase().includes(s) ||
          r.pastorName?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [reportData, selectedDate, turnoFilter, cargoFilter, regionFilter, cidadeFilter, statusFilter, search]);

  // Estatísticas filtradas
  const stats = useMemo(() => {
    const data = selectedDate ? 
      filteredRecords : 
      filteredRecords.filter((r: AttendanceRecord) => r.timestamp.toISOString().slice(0, 10) === todayDateStr);
    
    const total = data.length;
    const present = data.filter((r: AttendanceRecord) => r.status === "Presente").length;
    const justified = data.filter((r: AttendanceRecord) => r.status === "Justificado").length;
    const absent = data.filter((r: AttendanceRecord) => r.status === "Ausente").length;
    const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : "0";
    
    return { total, present, justified, absent, attendanceRate };
  }, [filteredRecords, selectedDate]);

  const todayRecords = useMemo(() => {
    return filteredRecords.filter((r: AttendanceRecord) => r.timestamp.toISOString().slice(0, 10) === todayDateStr);
  }, [filteredRecords]);

  // Dados para gráficos
  const chartData = useMemo(() => {
    const data = selectedDate ? filteredRecords : todayRecords;
    
    // Presença por turno (apenas Manhã e Tarde)
    const shifts = ["Manhã", "Tarde"];
    const attendanceByShift = shifts.map(shift => ({
      shift,
      total: data.filter((r: AttendanceRecord) => r.shift === shift).length,
      fill: shift === "Manhã" ? "#3b82f6" : "#10b981"
    }));

    // Status da presença
    const statusData = [
      { status: "Presente", total: data.filter((r: AttendanceRecord) => r.status === "Presente").length, fill: "#22c55e" },
      { status: "Justificado", total: data.filter((r: AttendanceRecord) => r.status === "Justificado").length, fill: "#eab308" },
      { status: "Ausente", total: data.filter((r: AttendanceRecord) => r.status === "Ausente").length, fill: "#ef4444" }
    ];

    // Presença por cargo
    const positions = [...new Set(data.map((r: AttendanceRecord) => r.churchPosition))];
    const attendanceByPosition = positions.map(position => ({
      position,
      presente: data.filter((r: AttendanceRecord) => r.churchPosition === position && r.status === "Presente").length,
      justificado: data.filter((r: AttendanceRecord) => r.churchPosition === position && r.status === "Justificado").length
    }));

    // Top 10 regiões
    const regionCounts: Record<string, number> = {};
    data.forEach((r: AttendanceRecord) => {
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

    return { attendanceByShift, statusData, attendanceByPosition, attendanceByRegion };
  }, [filteredRecords, todayRecords, selectedDate]);

  // Paginação
  const totalPages = Math.ceil((selectedDate ? filteredRecords.length : todayRecords.length) / pageSize);
  const paginatedRecords = (selectedDate ? filteredRecords : todayRecords).slice(
    (page - 1) * pageSize, 
    page * pageSize
  );

  useEffect(() => {
    setPage(1);
  }, [filteredRecords, selectedDate]);

  // ... restante do código ...

  return (
    <div className="flex flex-col gap-8">
      {/* Seletor de Data */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            📅 Selecionar Data para Análise
          </CardTitle>
          <CardDescription>
            Escolha uma data específica para visualizar as estatísticas de presença. 
            Deixe em branco para ver dados de hoje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-2">Data para análise</label>
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)} 
                className="w-[180px]" 
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setSelectedDate("")} 
              className="px-4"
            >
              🗑️ Limpar (Hoje)
            </Button>
          </div>
          
          {/* Resumo da data selecionada */}
          <div className="mt-3 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-700">
              📊 Visualizando dados de: <strong>
                {selectedDate ? 
                  new Date(selectedDate).toLocaleDateString('pt-BR') : 
                  'Hoje (' + new Date().toLocaleDateString('pt-BR') + ')'
                }
              </strong> - Encontrados: <strong>
                {selectedDate ? filteredRecords.length : todayRecords.length}
              </strong> registros
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {selectedDate ? 'Presentes na Data' : 'Presentes Hoje'}
            </CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            <p className="text-xs text-muted-foreground">
              {stats.present === 0 ? 
                selectedDate ? 
                  'Nenhum participante presente na data selecionada.' : 
                  'Nenhum participante presente hoje.' : 
                `Participantes presentes ${selectedDate ? 'na data' : 'hoje'}`
              }
            </p>
          </CardContent>
        </Card>
        
        {/* Outros cards de estatísticas similares */}
      </div>

      {/* Dashboard de Estatísticas Detalhadas */}
      <StatisticsDashboard 
        records={selectedDate ? filteredRecords : todayRecords} 
        className="mb-8" 
        selectedDate={selectedDate} 
      />

      <SynchronizedAnalytics />

      {/* Seção de Gráficos Interativos */}
      {stats.total > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Gráfico de Presença por Turno */}
          <Card>
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
                  <RechartsBarChart data={chartData.attendanceByShift}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="shift" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [`${value} participantes`, "Total"]}
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
            </CardContent>
          </Card>

          {/* Gráfico de Status Geral */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Status da Presença
              </CardTitle>
              <CardDescription>
                Distribuição geral dos status de presença
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => 
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {chartData.statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${value} participantes`, ""]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Presentes e Justificados por Cargo */}
          <Card>
            <CardHeader>
              <CardTitle>Presentes e Justificados por Cargo</CardTitle>
              <CardDescription>
                Distribuição de presentes e justificados por cargo na igreja
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={chartData.attendanceByPosition}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="position" 
                      angle={-45} 
                      textAnchor="end" 
                      interval={0}
                      height={60}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="presente" 
                      name="Presentes" 
                      fill="#22c55e" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="justificado" 
                      name="Justificados" 
                      fill="#eab308" 
                      radius={[4, 4, 0, 0]}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de Top 10 Regiões */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Regiões</CardTitle>
              <CardDescription>
                Regiões com maior número de registros
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={chartData.attendanceByRegion}
                    layout="vertical"
                    margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      type="category" 
                      dataKey="region" 
                      width={80}
                    />
                    <Tooltip 
                      formatter={(value) => [`${value} participantes`, "Total"]}
                    />
                    <Bar 
                      dataKey="total" 
                      name="Participantes"
                      radius={[0, 4, 4, 0]}
                    >
                      {chartData.attendanceByRegion.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Registros */}
      <Card>
        <CardHeader>
          <CardTitle>Registros {selectedDate ? 'da Data Selecionada' : 'de Hoje'}</CardTitle>
          <CardDescription>
            Lista das presenças registradas {selectedDate ? 'na data selecionada' : 'hoje'} 
            no sistema ({selectedDate ? filteredRecords.length : todayRecords.length} registros).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* ... código da tabela ... */}
        </CardContent>
      </Card>
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
      <AuthGuard>
        <DashboardContent />
      </AuthGuard>
    </>
  );
}