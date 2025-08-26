"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAttendanceRecords } from "@/lib/actions";
import type { AttendanceRecord } from "@/lib/types";
import { useEffect, useState } from "react";

export default function PresencaCadastradosPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    async function fetchRecords() {
      setLoading(true);
      try {
        let inicio, fim;
        if (selectedDate) {
          // Se data selecionada, busca registros daquele dia
          const dataEscolhida = new Date(selectedDate + 'T00:00:00');
          inicio = new Date(Date.UTC(dataEscolhida.getUTCFullYear(), dataEscolhida.getUTCMonth(), dataEscolhida.getUTCDate(), 0, 0, 0));
          fim = new Date(Date.UTC(dataEscolhida.getUTCFullYear(), dataEscolhida.getUTCMonth(), dataEscolhida.getUTCDate(), 23, 59, 59, 999));
        } else {
          // Se vazio, busca registros de hoje
          const hoje = new Date();
          inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 0, 0, 0));
          fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(), 23, 59, 59, 999));
        }
        const data = await getAttendanceRecords({ startDate: inicio.toISOString(), endDate: fim.toISOString() });
        setRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        setError("Erro ao carregar registros de presença.");
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, [selectedDate]);
  // Estatísticas filtradas
  const total = records.length;
  const presentes = records.filter(r => r.status === "Presente").length;
  const justificados = records.filter(r => r.status === "Justificado").length;
  const ausentes = records.filter(r => r.status === "Ausente").length;
  const taxaPresenca = total > 0 ? ((presentes / total) * 100).toFixed(1) : "0";

  function handleExport() {
    const headers = [
      'Nome Completo',
      'CPF',
      'Aniversário',
      'Região',
      'Cargo na Igreja',
      'Nome do Pastor',
      'Data/Hora'
    ];
    const csvContent = [
      headers.join(','),
      ...records.map(r => [
        `"${r.fullName}"`,
        `"${r.cpf || ''}"`,
        `"${r.birthday || ''}"`,
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
    link.setAttribute('download', `relatorio-presenca-cadastrados-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Função para exportar relatório diário (apenas registros do dia atual)
  function handleExportDiario() {
    const hoje = new Date();
    const dia = hoje.getDate();
    const mes = hoje.getMonth();
    const ano = hoje.getFullYear();
    const headers = [
      'Nome Completo',
      'CPF',
      'Aniversário',
      'Região',
      'Cargo na Igreja',
      'Nome do Pastor',
      'Data/Hora'
    ];
    const registrosDiarios = records.filter(r => {
      if (!r.timestamp) return false;
      const data = new Date(r.timestamp);
      return data.getDate() === dia && data.getMonth() === mes && data.getFullYear() === ano;
    });
    const csvContent = [
      headers.join(','),
      ...registrosDiarios.map(r => [
        `"${r.fullName}"`,
        `"${r.cpf || ''}"`,
        `"${r.birthday || ''}"`,
        r.region || '',
        r.churchPosition || '',
        `"${r.pastorName}"`,
        r.timestamp ? new Date(r.timestamp).toLocaleDateString('pt-BR') + ' ' + new Date(r.timestamp).toLocaleTimeString('pt-BR') : ''
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-presenca-diario-${ano}-${(mes+1).toString().padStart(2,'0')}-${dia.toString().padStart(2,'0')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="max-w-5xl mx-auto py-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📅 Selecionar Data para Análise</CardTitle>
          <CardDescription>
            Escolha uma data específica para visualizar as estatísticas de presença. Deixe em branco para ver dados de hoje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Data para análise</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="border rounded px-2 py-1"
              />
            </div>
            <div className="flex gap-2 mt-2 sm:mt-0">
              <Button onClick={() => setSelectedDate("")}>Hoje</Button>
              <Button onClick={handleExport}>Baixar Relatório de Presença</Button>
            </div>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            📊 Visualizando dados de: {selectedDate ? new Date(selectedDate).toLocaleDateString('pt-BR') : 'Hoje (' + new Date().toLocaleDateString('pt-BR') + ')'} - Encontrados: {total} registros
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-green-50">
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-green-700">{presentes}</div>
            <div className="text-sm text-muted-foreground">Presentes</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50">
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-yellow-700">{justificados}</div>
            <div className="text-sm text-muted-foreground">Justificados</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50">
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-red-700">{ausentes}</div>
            <div className="text-sm text-muted-foreground">Ausentes</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50">
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-blue-700">{taxaPresenca}%</div>
            <div className="text-sm text-muted-foreground">Taxa de Presença</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>📊 Registros de Presença</CardTitle>
          <CardDescription>
            Lista dos registros filtrados pela data selecionada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <div>Carregando...</div>}
          {error && <div className="text-red-500">{error}</div>}
          {!loading && !error && (
            total === 0 ? (
              <div className="text-center text-muted-foreground py-8">Nenhum registro de presença encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border">Nome</th>
                      <th className="p-2 border">CPF</th>
                      <th className="p-2 border">Aniversário</th>
                      <th className="p-2 border">Região</th>
                      <th className="p-2 border">Cargo</th>
                      <th className="p-2 border">Nome do Pastor</th>
                      <th className="p-2 border">Status</th>
                      <th className="p-2 border">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2 border">{r.fullName}</td>
                        <td className="p-2 border">{r.cpf}</td>
                        <td className="p-2 border">{r.birthday || '-'}</td>
                        <td className="p-2 border">{r.region}</td>
                        <td className="p-2 border">{r.churchPosition}</td>
                        <td className="p-2 border">{r.pastorName}</td>
                        <td className="p-2 border">{r.status || 'Presente'}</td>
                        <td className="p-2 border">{r.timestamp ? new Date(r.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Manaus' }) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
