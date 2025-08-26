"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttendanceRecords } from "@/lib/actions";
import type { AttendanceRecord } from "@/lib/types";
import { useEffect, useState } from "react";

export default function RelatorioCadastradosPage() {
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
    const headers = [
      'Nome Completo',
      'Região',
      'Cargo na Igreja',
      'Nome do Pastor'
    ];
    const csvContent = [
      headers.join(','),
      ...records.map(r => [
        `"${r.fullName}"`,
        r.region || '',
        r.churchPosition || '',
        `"${r.pastorName}"`
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-cadastrados-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Relatório de Cadastrados</CardTitle>
        <CardDescription>
          Visualize e exporte os cadastrados com Nome, Região, Cargo e Nome do Pastor.
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
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2 border">{r.fullName}</td>
                    <td className="p-2 border">{r.region}</td>
                    <td className="p-2 border">{r.churchPosition}</td>
                    <td className="p-2 border">{r.pastorName}</td>
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
