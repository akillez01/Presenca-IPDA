"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttendanceRecords } from "@/lib/actions";
import type { AttendanceRecord } from "@/lib/types";
import { useEffect, useState } from "react";

export default function RelatorioPresencaPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecords() {
      setLoading(true);
      try {
        const data = await getAttendanceRecords();
        setRecords(data);
      } catch (err) {
        setError("Erro ao carregar registros de presença.");
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, []);

  function handleExport() {
    // Exporta todos os campos detalhados igual ao CSV padrão
        // Exporta apenas presenças: Nome, Região, Cargo, Nome do Pastor, Data/Hora
        const headers = [
          'Nome Completo',
          'Região',
          'Cargo na Igreja',
          'Nome do Pastor',
          'Data/Hora'
        ];
        const csvContent = [
          headers.join(','),
          ...records.map(r => [
            `"${r.fullName}"`,
            r.region || '',
            r.churchPosition || '',
            `"${r.pastorName}"`,
            r.timestamp ? r.timestamp.toLocaleDateString('pt-BR') + ' ' + r.timestamp.toLocaleTimeString('pt-BR') : ''
          ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio-presenca-simples-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Relatório de Presença</CardTitle>
        <CardDescription>
          Visualize e exporte as presenças registradas com Nome, Região, Cargo e Nome do Pastor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExport} className="mb-4">Exportar CSV</Button>
        {loading ? (
          <div>Carregando...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 border">Nome</th>
                  <th className="p-2 border">Região</th>
                  <th className="p-2 border">Cargo</th>
                  <th className="p-2 border">Nome do Pastor</th>
                  <th className="p-2 border">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2 border">{r.fullName}</td>
                    <td className="p-2 border">{r.region}</td>
                    <td className="p-2 border">{r.churchPosition}</td>
                    <td className="p-2 border">{r.pastorName}</td>
                    <td className="p-2 border">{r.timestamp.toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
