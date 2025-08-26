"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { deleteAttendance, getAttendanceRecords, updateAttendanceStatus } from "@/lib/actions";
import type { AttendanceRecord } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PresencaCadastradosPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, string>>({});
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  // Estados para paginação e edição
  const [currentPage, setCurrentPage] = useState(1);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [editFields, setEditFields] = useState<Record<string, Partial<AttendanceRecord>>>({});
  const itemsPerPage = 10;
  
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  async function fetchRecords() {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    try {
      // Busca todos os registros sem filtros complexos
      const data = await getAttendanceRecords();
      if (Array.isArray(data) && data.length > 0) {
        setRecords(data);
        
        const initialStatus: Record<string, string> = {};
        const initialJust: Record<string, string> = {};
        data.forEach((r: AttendanceRecord) => {
          initialStatus[r.id] = r.status || 'Presente';
          if (r.absentReason) initialJust[r.id] = r.absentReason;
        });
        setAttendanceStatus(initialStatus);
        setJustificativas(initialJust);
      } else {
        setRecords([]);
        setAttendanceStatus({});
        setJustificativas({});
      }
    } catch (err) {
      setError("Erro ao carregar registros de presença.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) fetchRecords();
  }, [user, authLoading, router]);

  function handleStatusChange(id: string, value: string) {
    setAttendanceStatus((prev) => ({ ...prev, [id]: value }));
    if (value === 'Presente') {
      setJustificativas((prev) => ({ ...prev, [id]: '' }));
    }
  }

  function handleJustificativaChange(id: string, value: string) {
    setJustificativas((prev) => ({ ...prev, [id]: value }));
  }

  // Função para enviar presença individual
  async function handleSubmitAttendance(id: string) {
    try {
      setLoading(true);
      const currentTimestamp = new Date();
      
      // Atualiza status, justificativa e timestamp no backend
      await updateAttendanceStatus(id, attendanceStatus[id], justificativas[id] || '', currentTimestamp);
      
      // Atualiza os dados localmente com novo timestamp
      setRecords((prev) => prev.map(r => {
        if (r.id !== id) return r;
        return {
          ...r,
          status: attendanceStatus[id],
          absentReason: justificativas[id] || '',
          timestamp: currentTimestamp,
          lastUpdated: currentTimestamp,
        } as AttendanceRecord;
      }));

      setError(null);
      // Feedback visual de sucesso
      const successMessage = `Presença ${attendanceStatus[id].toLowerCase()} registrada com sucesso!`;
      alert(successMessage);
    } catch (err) {
      setError('Erro ao registrar presença.');
      console.error('Erro ao registrar presença:', err);
    } finally {
      setLoading(false);
    }
  }

  // Função para enviar todas as presenças de uma vez
  async function handleSubmitAllAttendances() {
    try {
      setLoading(true);
      const currentTimestamp = new Date();
      const promises = records.map(async (r) => {
        return updateAttendanceStatus(r.id, attendanceStatus[r.id], justificativas[r.id] || '', currentTimestamp);
      });

      await Promise.all(promises);

      // Atualiza todos os registros localmente
      setRecords((prev) => prev.map(r => ({
        ...r,
        status: attendanceStatus[r.id],
        absentReason: justificativas[r.id] || '',
        timestamp: currentTimestamp,
        lastUpdated: currentTimestamp,
      })));

      setError(null);
      alert('Todas as presenças foram registradas com sucesso!');
    } catch (err) {
      setError('Erro ao registrar presenças.');
      console.error('Erro ao registrar presenças:', err);
    } finally {
      setLoading(false);
    }
  }

  // Função para enviar todos os dados editados para o backend
  async function handleSaveAttendance(id: string) {
    try {
      setLoading(true);
      const currentTimestamp = new Date();
      
      // Atualiza status, justificativa e dados editados no backend
      await updateAttendanceStatus(id, attendanceStatus[id], justificativas[id] || '', currentTimestamp);
      
      // Atualiza todos os campos localmente
      setRecords((prev) => prev.map(r => {
        if (r.id !== id) return r;
        return {
          ...r,
          ...editFields[id],
          status: attendanceStatus[id],
          absentReason: justificativas[id] || '',
          timestamp: currentTimestamp,
          lastUpdated: currentTimestamp,
        } as AttendanceRecord;
      }));
      
      setEditMode((prev) => ({ ...prev, [id]: false }));
      setError(null);
    } catch (err) {
      setError('Erro ao salvar presença.');
      console.error('Erro ao salvar presença:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleEditField(id: string, field: keyof AttendanceRecord, value: string) {
    setEditFields((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  // Função para excluir um registro
  async function handleDeleteRecord(id: string, fullName: string) {
    if (!confirm(`Tem certeza que deseja excluir o registro de ${fullName}?`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await deleteAttendance(id);
      
      if (result.success) {
        // Remove da lista local
        setRecords(prev => prev.filter(r => r.id !== id));
        // Remove dos estados de edição se estiver sendo editado
        setEditMode(prev => ({ ...prev, [id]: false }));
        setEditFields(prev => {
          const newFields = { ...prev };
          delete newFields[id];
          return newFields;
        });
        setAttendanceStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[id];
          return newStatus;
        });
        setJustificativas(prev => {
          const newJust = { ...prev };
          delete newJust[id];
          return newJust;
        });
      } else {
        setError(result.error || 'Erro ao excluir registro.');
      }
    } catch (err) {
      setError('Erro ao excluir registro.');
    } finally {
      setLoading(false);
    }
  }

  // Função para exportar relatório CSV sempre com dados atualizados do backend
  async function handleExport() {
    setLoading(true);
    try {
      // Busca os dados mais recentes do backend, sempre do Firebase
      const data = await getAttendanceRecords();
      console.log(`Exportando ${data.length} registros do Firebase`);
      
      const headers = [
        'Nome Completo',
        'CPF',
        'Aniversário',
        'Região',
        'Cargo na Igreja',
        'Nome do Pastor',
        'Status',
        'Justificativa',
        'Data/Hora'
      ];
      const csvContent = [
        headers.join(','),
        ...data.map((r) => [
          `"${r.fullName || ''}"`,
          `"${r.cpf || ''}"`,
          `"${r.birthday || ''}"`,
          `"${r.region || ''}"`,
          `"${r.churchPosition || ''}"`,
          `"${r.pastorName || ''}"`,
          `"${r.status || 'Presente'}"`,
          `"${r.absentReason || ''}"`,
          r.timestamp ? new Date(r.timestamp).toLocaleDateString('pt-BR') + ' ' + new Date(r.timestamp).toLocaleTimeString('pt-BR') : ''
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio-presenca-completo-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Feedback para o usuário
      alert(`Relatório exportado com sucesso! ${data.length} registros incluídos.`);
    } catch (err) {
      console.error('Erro na exportação:', err);
      setError('Erro ao exportar relatório. Verifique a conexão com o Firebase.');
    } finally {
      setLoading(false);
    }
  }

  // Função para exportar relatório diário (apenas registros do dia atual) - sempre do Firebase
  async function handleExportDiario() {
    setLoading(true);
    try {
      // Busca todos os dados mais recentes do Firebase
      const data = await getAttendanceRecords();
      console.log(`Buscando registros diários de ${data.length} registros totais`);
      
      // Filtra por hoje no timezone do Amazonas
      const hoje = new Date();
      const registrosDiarios = data.filter((r: AttendanceRecord) => {
        if (!r.timestamp) return false;
        // Converte para o timezone do Amazonas
        const dataRegistro = new Date(r.timestamp);
        const dataManaus = new Date(dataRegistro.toLocaleString("en-US", { timeZone: "America/Manaus" }));
        const hojeManaus = new Date(hoje.toLocaleString("en-US", { timeZone: "America/Manaus" }));
        
        return dataManaus.getDate() === hojeManaus.getDate() && 
               dataManaus.getMonth() === hojeManaus.getMonth() && 
               dataManaus.getFullYear() === hojeManaus.getFullYear();
      });
      
      console.log(`Encontrados ${registrosDiarios.length} registros para hoje`);
      
      const headers = [
        'Nome Completo',
        'CPF',
        'Aniversário',
        'Região',
        'Cargo na Igreja',
        'Nome do Pastor',
        'Status',
        'Justificativa',
        'Data/Hora'
      ];
      const csvContent = [
        headers.join(','),
        ...registrosDiarios.map((r: AttendanceRecord) => [
          `"${r.fullName || ''}"`,
          `"${r.cpf || ''}"`,
          `"${r.birthday || ''}"`,
          `"${r.region || ''}"`,
          `"${r.churchPosition || ''}"`,
          `"${r.pastorName || ''}"`,
          `"${r.status || 'Presente'}"`,
          `"${r.absentReason || ''}"`,
          r.timestamp ? new Date(r.timestamp.toLocaleString("en-US", { timeZone: "America/Manaus" })).toLocaleDateString('pt-BR') + ' ' + new Date(r.timestamp.toLocaleString("en-US", { timeZone: "America/Manaus" })).toLocaleTimeString('pt-BR') : ''
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      const hojeManaus = new Date(hoje.toLocaleString("en-US", { timeZone: "America/Manaus" }));
      const ano = hojeManaus.getFullYear();
      const mes = (hojeManaus.getMonth()+1).toString().padStart(2,'0');
      const dia = hojeManaus.getDate().toString().padStart(2,'0');
      link.setAttribute('download', `relatorio-presenca-diario-${ano}-${mes}-${dia}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Feedback para o usuário
      alert(`Relatório diário exportado com sucesso! ${registrosDiarios.length} registros de hoje incluídos.`);
    } catch (err) {
      console.error('Erro na exportação diária:', err);
      setError('Erro ao exportar relatório diário. Verifique a conexão com o Firebase.');
    } finally {
      setLoading(false);
    }
  }

  // Filtra os registros baseado na busca em todos os campos visíveis da tabela
  const filteredRecords = records.filter(r => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    
    // Campos pesquisáveis: Presença, Nome, CPF, Aniversário, Região, Cargo, Pastor, Data/Hora
    const searchableFields = [
      r.status || 'Presente', // Presença
      r.fullName || '', // Nome
      r.cpf || '', // CPF
      r.birthday || '', // Aniversário
      r.region || '', // Região
      r.churchPosition || '', // Cargo
      r.pastorName || '', // Pastor
      r.timestamp ? new Date(r.timestamp).toLocaleDateString('pt-BR') : '', // Data/Hora
      r.lastUpdated ? new Date(r.lastUpdated).toLocaleDateString('pt-BR') : '' // Última Presença
    ];
    
    // Verifica se o termo de busca está presente em algum dos campos
    return searchableFields.some(field => 
      field.toLowerCase().includes(term)
    );
  });

  // Paginação
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-2 md:px-4">
      {/* Filtro de Busca Simples */}
      <Card className="w-full max-w-6xl mx-auto mb-4">
        <CardHeader>
          <CardTitle className="text-lg">🔍 Buscar nas Presenças Cadastradas</CardTitle>
          <CardDescription>
            Pesquise por: Nome, CPF, Aniversário, Região, Cargo, Pastor, Data/Hora ou Status de Presença
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Buscar em todos os campos</label>
              <Input
                type="text"
                placeholder="Digite nome, CPF, região, cargo, pastor, data ou status..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Exemplo: "João Silva", "123.456.789-00", "Norte", "Pastor", "15/08/2025", "Presente"
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSearch("")}
                className="px-4"
              >
                🗑️ Limpar
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4"
              >
                📥 Exportar Completo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportDiario}
                disabled={loading}
                className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4"
              >
                📅 Exportar Hoje
              </Button>
            </div>
          </div>
          
          {/* Resumo de busca */}
          {search && (
            <div className="mt-3 p-2 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                🔍 Buscando por: "<strong>{search}</strong>" - 
                Encontrados: <strong>{filteredRecords.length}</strong> registros
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="w-full max-w-6xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>Presença de Cadastrados</CardTitle>
          <CardDescription>
            {records.length > 0 ? (
              <div className="space-y-1">
                <div className="text-base font-medium">
                  📊 {records.length} registro(s) encontrado(s) - Exibindo {filteredRecords.length} após filtros
                </div>
              </div>
            ) : 'Nenhum registro encontrado'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-4">Carregando...</div>}
          {error && <div className="text-red-500 text-center py-4">{error}</div>}
          {!loading && !error && filteredRecords.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhum registro de presença encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              {/* Tabela para desktop */}
              <div className="hidden md:block">
                <table className="min-w-full border text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 border w-[150px]">Presença</th>
                      <th className="p-2 border min-w-[120px]">Nome</th>
                      <th className="p-2 border w-[120px]">CPF</th>
                      <th className="p-2 border w-[100px]">Aniversário</th>
                      <th className="p-2 border w-[100px]">Região</th>
                      <th className="p-2 border w-[120px]">Cargo</th>
                      <th className="p-2 border min-w-[120px]">Pastor</th>
                      <th className="p-2 border w-[140px]">Data/Hora</th>
                      <th className="p-2 border w-[120px]">Última Presença</th>
                      <th className="p-2 border w-[120px]">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2 border">
                          <Select
                            value={attendanceStatus[r.id] || 'Presente'}
                            onValueChange={(value) => handleStatusChange(r.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Presente">Presente</SelectItem>
                              <SelectItem value="Justificado">Justificado</SelectItem>
                              <SelectItem value="Ausente">Ausente</SelectItem>
                            </SelectContent>
                          </Select>
                          {(attendanceStatus[r.id] === 'Justificado' || attendanceStatus[r.id] === 'Ausente') && (
                            <Input
                              type="text"
                              placeholder="Justificativa"
                              value={justificativas[r.id] || ''}
                              onChange={(e) => handleJustificativaChange(r.id, e.target.value)}
                              className="mt-1 text-xs"
                            />
                          )}
                        </td>
                        
                        <td className="p-2 border">
                          {editMode[r.id] ? (
                            <Input
                              value={(editFields[r.id]?.fullName ?? r.fullName) || ''}
                              onChange={(e) => handleEditField(r.id, 'fullName', e.target.value)}
                              className="text-sm"
                            />
                          ) : (
                            r.fullName
                          )}
                        </td>

                        <td className="p-2 border">
                          {editMode[r.id] ? (
                            <Input
                              value={(editFields[r.id]?.cpf ?? r.cpf) || ''}
                              onChange={(e) => handleEditField(r.id, 'cpf', e.target.value)}
                              className="text-sm"
                            />
                          ) : (
                            r.cpf
                          )}
                        </td>

                        <td className="p-2 border">
                          {editMode[r.id] ? (
                            <Input
                              value={(editFields[r.id]?.birthday ?? r.birthday) || ''}
                              onChange={(e) => handleEditField(r.id, 'birthday', e.target.value)}
                              className="text-sm"
                            />
                          ) : (
                            r.birthday
                          )}
                        </td>

                        <td className="p-2 border">
                          {editMode[r.id] ? (
                            <Input
                              value={(editFields[r.id]?.region ?? r.region) || ''}
                              onChange={(e) => handleEditField(r.id, 'region', e.target.value)}
                              className="text-sm"
                            />
                          ) : (
                            r.region
                          )}
                        </td>

                        <td className="p-2 border">
                          {editMode[r.id] ? (
                            <Input
                              value={(editFields[r.id]?.churchPosition ?? r.churchPosition) || ''}
                              onChange={(e) => handleEditField(r.id, 'churchPosition', e.target.value)}
                              className="text-sm"
                            />
                          ) : (
                            r.churchPosition
                          )}
                        </td>

                        <td className="p-2 border">
                          {editMode[r.id] ? (
                            <Input
                              value={(editFields[r.id]?.pastorName ?? r.pastorName) || ''}
                              onChange={(e) => handleEditField(r.id, 'pastorName', e.target.value)}
                              className="text-sm"
                            />
                          ) : (
                            r.pastorName
                          )}
                        </td>

                        <td className="p-2 border text-xs">
                          {r.timestamp 
                            ? new Date(r.timestamp).toLocaleDateString('pt-BR') + ' ' + new Date(r.timestamp).toLocaleTimeString('pt-BR')
                            : 'N/A'
                          }
                        </td>

                        <td className="p-2 border text-xs">
                          {r.lastUpdated 
                            ? new Date(r.lastUpdated).toLocaleDateString('pt-BR') + ' ' + new Date(r.lastUpdated).toLocaleTimeString('pt-BR')
                            : 'N/A'
                          }
                        </td>

                        <td className="p-2 border">
                          <div className="flex flex-col gap-1">
                            {editMode[r.id] ? (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSaveAttendance(r.id)}
                                  disabled={loading}
                                  className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700"
                                >
                                  💾 Salvar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setEditMode(prev => ({ ...prev, [r.id]: false }))}
                                  className="text-xs px-2 py-1"
                                >
                                  ❌ Cancelar
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={() => handleSubmitAttendance(r.id)}
                                  disabled={loading}
                                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700"
                                >
                                  ✅ Registrar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setEditMode(prev => ({ ...prev, [r.id]: true }))}
                                  className="text-xs px-2 py-1"
                                >
                                  ✏️ Editar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => handleDeleteRecord(r.id, r.fullName)}
                                  disabled={loading}
                                  className="text-xs px-2 py-1"
                                >
                                  🗑️ Excluir
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards para mobile */}
              <div className="md:hidden space-y-4">
                {paginatedRecords.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium">{r.fullName}</h3>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            onClick={() => handleSubmitAttendance(r.id)}
                            disabled={loading}
                            className="text-xs px-2 py-1"
                          >
                            ✅
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setEditMode(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                            className="text-xs px-2 py-1"
                          >
                            ✏️
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleDeleteRecord(r.id, r.fullName)}
                            disabled={loading}
                            className="text-xs px-2 py-1"
                          >
                            🗑️
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><strong>CPF:</strong> {r.cpf}</div>
                        <div><strong>Região:</strong> {r.region}</div>
                        <div><strong>Cargo:</strong> {r.churchPosition}</div>
                        <div><strong>Pastor:</strong> {r.pastorName}</div>
                      </div>

                      <div className="mt-2">
                        <Select
                          value={attendanceStatus[r.id] || 'Presente'}
                          onValueChange={(value) => handleStatusChange(r.id, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Presente">Presente</SelectItem>
                            <SelectItem value="Justificado">Justificado</SelectItem>
                            <SelectItem value="Ausente">Ausente</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {(attendanceStatus[r.id] === 'Justificado' || attendanceStatus[r.id] === 'Ausente') && (
                          <Input
                            type="text"
                            placeholder="Justificativa"
                            value={justificativas[r.id] || ''}
                            onChange={(e) => handleJustificativaChange(r.id, e.target.value)}
                            className="mt-2"
                          />
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Paginação */}
              <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Mostrando {Math.min(filteredRecords.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(filteredRecords.length, currentPage * itemsPerPage)} de {filteredRecords.length} registros
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="px-3 py-1 text-sm">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>

              {/* Ações em lote */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleSubmitAllAttendances}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  💾 Salvar Todas as Presenças
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={loading}
                >
                  📥 Exportar Relatório Completo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportDiario}
                  disabled={loading}
                >
                  📅 Exportar Relatório de Hoje
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
