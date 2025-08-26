"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttendanceRecord } from "@/lib/types";
import { useEffect, useState } from "react";

interface StatisticsDashboardProps {
  records: AttendanceRecord[];
  className?: string;
  selectedDate?: string;
}

interface Statistics {
  totalPastores: number;
  totalCooperadores: number;
  totalPresbiteros: number;
  totalFinanceiros: number;
  totalDiaconos: number;
  totalObreiros: number;
  totalMembroComuns: number;
  distribucaoTurnos: Record<string, number>;
  distribucaoRegioes: Record<string, number>;
  distribucaoCidades: Record<string, number>;
}

export function StatisticsDashboard({ records, className = "", selectedDate }: StatisticsDashboardProps) {
  const [statistics, setStatistics] = useState<Statistics>({
    totalPastores: 0,
    totalCooperadores: 0,
    totalPresbiteros: 0,
    totalFinanceiros: 0,
    totalDiaconos: 0,
    totalObreiros: 0,
    totalMembroComuns: 0,
    distribucaoTurnos: {},
    distribucaoRegioes: {},
    distribucaoCidades: {}
  });

  useEffect(() => {
    const calculateStatistics = () => {
      const stats: Statistics = {
        totalPastores: 0,
        totalCooperadores: 0,
        totalPresbiteros: 0,
        totalFinanceiros: 0,
        totalDiaconos: 0,
        totalObreiros: 0,
        totalMembroComuns: 0,
        distribucaoTurnos: {},
        distribucaoRegioes: {},
        distribucaoCidades: {}
      };

      records.forEach(record => {
        // Contar por cargo
        const cargo = record.churchPosition?.toLowerCase() || '';
        if (cargo.includes('pastor')) {
          stats.totalPastores++;
        } else if (cargo.includes('cooperador')) {
          stats.totalCooperadores++;
        } else if (cargo.includes('presbítero') || cargo.includes('presbitero')) {
          stats.totalPresbiteros++;
        } else if (cargo.includes('financeiro')) {
          stats.totalFinanceiros++;
        } else if (cargo.includes('diácono') || cargo.includes('diacono')) {
          stats.totalDiaconos++;
        } else if (cargo.includes('obreiro')) {
          stats.totalObreiros++;
        } else {
          stats.totalMembroComuns++;
        }

        // Distribuição por turno
        const turno = record.turno || record.shift || 'Não informado';
        stats.distribucaoTurnos[turno] = (stats.distribucaoTurnos[turno] || 0) + 1;

        // Distribuição por região
        const regiao = record.region || 'Não informada';
        stats.distribucaoRegioes[regiao] = (stats.distribucaoRegioes[regiao] || 0) + 1;

        // Distribuição por cidade
        const cidade = record.cidade || record.city || 'Não informada';
        stats.distribucaoCidades[cidade] = (stats.distribucaoCidades[cidade] || 0) + 1;
      });

      setStatistics(stats);
    };

    calculateStatistics();
  }, [records]);

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          📊 Dashboard de Estatísticas em Tempo Real
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </CardTitle>
        <CardDescription>
          Dados atualizados automaticamente baseados nos registros carregados ({records.length} registros)
          {selectedDate && (
            <div className="mt-1 text-sm font-medium text-blue-600">
              📅 Visualizando dados de: {new Date(selectedDate).toLocaleDateString('pt-BR')}
            </div>
          )}
          {records.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {/* Mostra período dos dados */}
              {(() => {
                if (records.length === 0) return null;
                const dates = records
                  .map(r => r.createdAt || r.timestamp)
                  .filter(Boolean)
                  .map(d => d instanceof Date ? d : new Date(d));
                
                if (dates.length === 0) return null;
                
                const oldest = new Date(Math.min(...dates.map(d => d.getTime())));
                const newest = new Date(Math.max(...dates.map(d => d.getTime())));
                
                const today = new Date();
                const isToday = oldest.toDateString() === today.toDateString() && 
                               newest.toDateString() === today.toDateString();
                
                if (isToday) {
                  return "• Dados de hoje";
                } else if (oldest.toDateString() === newest.toDateString()) {
                  return `• Dados de ${oldest.toLocaleDateString('pt-BR')}`;
                } else {
                  return `• Período: ${oldest.toLocaleDateString('pt-BR')} até ${newest.toLocaleDateString('pt-BR')}`;
                }
              })()}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Estatísticas por Cargo */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold">{statistics.totalPastores}</div>
            <div className="text-xs opacity-90">Pastores</div>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold">{statistics.totalCooperadores}</div>
            <div className="text-xs opacity-90">Cooperadores</div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold">{statistics.totalPresbiteros}</div>
            <div className="text-xs opacity-90">Presbíteros</div>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold">{statistics.totalFinanceiros}</div>
            <div className="text-xs opacity-90">Financeiros</div>
          </div>
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold">{statistics.totalDiaconos}</div>
            <div className="text-xs opacity-90">Diáconos</div>
          </div>
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold">{statistics.totalObreiros}</div>
            <div className="text-xs opacity-90">Obreiros</div>
          </div>
          <div className="bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg px-3 py-2 text-center">
            <div className="text-lg font-bold">{statistics.totalMembroComuns}</div>
            <div className="text-xs opacity-90">Membros</div>
          </div>
        </div>

        {/* Distribuições */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Distribuição por Turnos */}
          <div className="bg-white border rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-2 text-gray-700">🌅 Distribuição por Turnos:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Object.entries(statistics.distribucaoTurnos)
                .sort(([,a], [,b]) => b - a)
                .map(([turno, count]) => (
                <div key={turno} className="flex justify-between text-xs">
                  <span>{turno}:</span>
                  <span className="font-mono font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(statistics.distribucaoTurnos).length === 0 && (
                <div className="text-xs text-gray-500 italic">Nenhum dado disponível</div>
              )}
            </div>
          </div>

          {/* Distribuição por Regiões */}
          <div className="bg-white border rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-2 text-gray-700">🌍 Distribuição por Regiões:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Object.entries(statistics.distribucaoRegioes)
                .sort(([,a], [,b]) => b - a)
                .map(([regiao, count]) => (
                <div key={regiao} className="flex justify-between text-xs">
                  <span>{regiao}:</span>
                  <span className="font-mono font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(statistics.distribucaoRegioes).length === 0 && (
                <div className="text-xs text-gray-500 italic">Nenhum dado disponível</div>
              )}
            </div>
          </div>

          {/* Distribuição por Cidades */}
          <div className="bg-white border rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-2 text-gray-700">🏘️ Distribuição por Cidades:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Object.entries(statistics.distribucaoCidades)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10) // Mostrar apenas os top 10 para não poluir
                .map(([cidade, count]) => (
                <div key={cidade} className="flex justify-between text-xs">
                  <span>{cidade}:</span>
                  <span className="font-mono font-bold">{count}</span>
                </div>
              ))}
              {Object.keys(statistics.distribucaoCidades).length > 10 && (
                <div className="text-xs text-gray-500 italic">
                  ... e mais {Object.keys(statistics.distribucaoCidades).length - 10} cidades
                </div>
              )}
              {Object.keys(statistics.distribucaoCidades).length === 0 && (
                <div className="text-xs text-gray-500 italic">Nenhum dado disponível</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
