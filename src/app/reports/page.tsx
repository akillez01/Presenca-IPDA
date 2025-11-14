"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeReports } from "@/hooks/use-reports";
import { updateAttendanceRecord } from "@/lib/api-actions";
import type { AttendanceRecord } from "@/lib/types";
import { Edit, FileDown, QrCode, Save, X } from "lucide-react";
import QRCode from 'qrcode';
import * as React from "react";


// Interface corrigida
interface FilteredStats {
  summary: {
    total: number;
    present: number;
    absent: number;
    justified: number;
  };
}


export default function ReportsPage() {
  // Hooks de autenticação e dados
  const { user } = useAuth();
  const { reportData, loading, error, refreshData } = useRealtimeReports();

  // Estados de filtro simplificados
  const [regionFilter, setRegionFilter] = React.useState("ALL");
  const [search, setSearch] = React.useState("");

  // Estados para modal interativo
  const [selectedRecord, setSelectedRecord] = React.useState<AttendanceRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editFields, setEditFields] = React.useState<Partial<AttendanceRecord>>({});
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string | null>(null);

  // Apenas as regiões disponíveis
  const availableRegions = React.useMemo(() => {
    if (!reportData) return [];
    return Array.from(new Set(reportData.records.map(r => r.region).filter(Boolean)));
  }, [reportData]);

  // 🧮 FUNÇÃO PARA CALCULAR SIMILARIDADE ENTRE STRINGS (Distância de Levenshtein)
  function calcularSimilaridade(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const matrix = [];
    const len1 = s1.length;
    const len2 = s2.length;
    
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return maxLen > 0 ? 1 - (matrix[len2][len1] / maxLen) : 0;
  }

  // 🔍 FUNÇÃO PARA NORMALIZAR TEXTO (remove acentos, espaços, etc.)
  function normalizarTexto(texto: string): string {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ' ') // Remove pontuação
      .replace(/\s+/g, ' ') // Remove espaços múltiplos
      .trim();
  }

  // Filtragem simplificada - apenas Nome, CPF e Região
  const filteredRecords = React.useMemo(() => {
    if (!reportData) return [];
    return reportData.records.filter(r => {
      // Filtro de região
      if (regionFilter !== "ALL" && !(r.region || '').toLowerCase().includes(regionFilter.toLowerCase())) {
        return false;
      }

      // Busca por Nome e CPF
      const term = search.trim().toLowerCase();
      if (!term) return true;
      
      // Campos de busca: apenas nome e CPF
      const searchableFields = [
        r.fullName || '', // Nome Completo
        r.cpf || '', // CPF original
        (r.cpf || '').replace(/\D/g, ''), // CPF só números
      ];
      
      // Verifica se o termo está presente em qualquer campo de busca
      const found = searchableFields.some(field => {
        const fieldStr = String(field).toLowerCase().trim();
        if (!fieldStr) return false;
        
        // Busca simples por inclusão
        return fieldStr.includes(term);
      });
      
      return found;
    });
  }, [reportData, regionFilter, search]);

  // Estatísticas filtradas
  const filteredStats = React.useMemo(() => {
    const total = filteredRecords.length;
    const present = filteredRecords.filter(r => r.status === "Presente").length;
    const justified = filteredRecords.filter(r => r.status === "Justificado").length;
    const absent = filteredRecords.filter(r => r.status === "Ausente").length;
    return {
      summary: { total, present, justified, absent }
    };
  }, [filteredRecords]);

  // Estado de filtro simplificado
  const isFilterActive = React.useMemo(() => {
    return regionFilter !== "ALL" || search.trim() !== "";
  }, [regionFilter, search]);

  // Função para limpar todos os filtros
  function clearAllFilters() {
    setRegionFilter("ALL");
    setSearch("");
  }

  // ===== FUNÇÕES DO MODAL INTERATIVO =====
  
  // Função para abrir modal de edição ao clicar no nome
  const handleNameClick = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setEditFields(record);
    setIsEditMode(false);
    setPhotoPreview(null);
    setQrCodeUrl(null);
    setIsEditModalOpen(true);
    
    // Gerar QR Code automaticamente com o CPF
    if (record.cpf) {
      generateQRCode(record.cpf);
    }
  };

  // Função para gerar QR Code com o CPF
  const generateQRCode = async (cpf: string) => {
    try {
      const qrText = `IPDA-PRESENCA:${cpf}`;
      const qrDataURL = await QRCode.toDataURL(qrText, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataURL);
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
    }
  };

  // Função para alterar campo na edição
  const handleEditFieldChange = (field: string, value: string) => {
    setEditFields(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Função para upload de foto
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPhotoPreview(result);
        setEditFields(prev => ({
          ...prev,
          photoUrl: result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Função para salvar alterações
  const handleSaveChanges = async () => {
    if (!selectedRecord) return;
    
    setIsSaving(true);
    try {
      await updateAttendanceRecord(selectedRecord.id, editFields);
      
      // Atualizar dados locais
      refreshData();
      
      alert('✅ Informações atualizadas com sucesso!');
      setIsEditMode(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('❌ Erro ao salvar as alterações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Função para fechar modal
  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedRecord(null);
    setEditFields({});
    setIsEditMode(false);
    setPhotoPreview(null);
    setQrCodeUrl(null);
  };

  // Funções de exportação (implementação igual ao original)
  function exportFilteredData() {
    if (!reportData || filteredRecords.length === 0) return;
    const headers = [
      `RELATÓRIO FILTRADO - ${new Date().toLocaleDateString('pt-BR')}`,
      `Filtros: ${search ? `Busca: ${search}` : ''}`,
      `Total: ${filteredRecords.length} registros`,
      "",
      "Nome Completo,CPF,Pastor,Cargo,Região,Status,Data/Hora",
      ...filteredRecords.map((r) => [
        `"${r.fullName || ""}"`,
        `"${r.cpf || ""}"`,
        `"${r.pastorName || ""}"`,
        `"${r.churchPosition || ""}"`,
        `"${r.region || ""}"`,
        `"${r.status || "Presente"}"`,
        r.timestamp ? new Date(r.timestamp).toLocaleDateString("pt-BR") + " " + new Date(r.timestamp).toLocaleTimeString("pt-BR") : "",
      ].join(","))
    ];
    const csvContent = headers.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-filtrado-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert(`Exportação concluída!\n${filteredRecords.length} registros exportados`);
  }

  function exportSummaryData() {
    if (!reportData) return;
    const headers = [
      `RESUMO ESTATÍSTICO - ${new Date().toLocaleDateString('pt-BR')}`,
      `Total: ${reportData.summary.total} registros`,
      `Presentes: ${reportData.summary.present}`,
      `Justificados: ${reportData.summary.justified}`,
      `Ausentes: ${reportData.summary.absent}`,
      `Taxa de presença: ${reportData.summary.attendanceRate}%`,
    ];
    const csvContent = headers.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `resumo-estatistico-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert(`Resumo exportado!`);
  }

  // Renderização principal (mantém o JSX original)
  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">
          <span className="hidden sm:inline">Relatórios de Presença</span>
          <span className="sm:hidden">Relatórios</span>
        </h1>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="bg-red-100 text-red-700 p-2 sm:p-3 rounded text-sm">{error}</div>
      )}

      {/* Carregando */}
      {loading && (
        <div className="bg-blue-100 text-blue-700 p-2 sm:p-3 rounded text-sm">Carregando dados...</div>
      )}

      {/* Filtros */}
      <div className="w-full max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <h2 className="text-sm sm:text-lg font-bold mb-3 sm:mb-4">
            <span className="hidden sm:inline">Filtros de Relatórios</span>
            <span className="sm:hidden">Filtros</span>
          </h2>
        
        {/* Filtros Simplificados - apenas Nome, CPF e Região */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <label className="block text-xs sm:text-sm font-medium mb-2">
              <span className="hidden sm:inline">🔍 Buscar por Nome ou CPF</span>
              <span className="sm:hidden">🔍 Buscar</span>
            </label>
            <input 
              type="text" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Digite o nome ou CPF..." 
              className="w-full border rounded px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="p-3 bg-green-50 rounded-lg">
            <label className="block text-xs sm:text-sm font-medium mb-2">
              <span className="hidden sm:inline">📍 Filtrar por Região</span>
              <span className="sm:hidden">📍 Região</span>
            </label>
            <select 
              value={regionFilter} 
              onChange={e => setRegionFilter(e.target.value)} 
              className="w-full border rounded px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">Todas as Regiões</option>
              {availableRegions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 flex-wrap pt-3 border-t mt-3">
          <button onClick={clearAllFilters} className="bg-gray-200 hover:bg-gray-300 px-3 sm:px-4 py-2 rounded text-xs sm:text-sm flex-1 sm:flex-none">
            <span className="hidden sm:inline">🗑️ Limpar Filtros</span>
            <span className="sm:hidden">🗑️ Limpar</span>
          </button>
          <button onClick={refreshData} className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm flex-1 sm:flex-none">
            <span className="hidden sm:inline">🔄 Atualizar Dados</span>
            <span className="sm:hidden">🔄 Atualizar</span>
          </button>
          <button 
            onClick={exportFilteredData} 
            disabled={!reportData || filteredRecords.length === 0} 
            className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex-1 sm:flex-none"
          >
            <span className="hidden sm:inline">📥 Exportar Filtrado</span>
            <span className="sm:hidden">📥 Filtrado</span>
          </button>
          <button 
            onClick={exportSummaryData} 
            disabled={!reportData} 
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex-1 sm:flex-none"
          >
            <span className="hidden sm:inline">📋 Exportar Resumo</span>
            <span className="sm:hidden">📋 Resumo</span>
          </button>
        </div>

        {/* Resumo de filtros ativos */}
        {isFilterActive && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
            <p className="text-xs sm:text-sm text-blue-700 font-medium mb-2">
              <span className="hidden sm:inline">🔍 Filtros ativos - Encontrados: <strong>{filteredRecords.length}</strong> registros</span>
              <span className="sm:hidden">🔍 <strong>{filteredRecords.length}</strong> encontrados</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-blue-600">
              {search && (
                <div className="truncate" title={`Busca por Nome/CPF: "${search}"`}>
                  <span className="hidden sm:inline">• Busca por Nome/CPF: "{search}"</span>
                  <span className="sm:hidden">• Busca: "{search.substring(0, 15)}{search.length > 15 ? '...' : ''}"</span>
                </div>
              )}
              {regionFilter !== "ALL" && (
                <div className="truncate" title={`Região: "${regionFilter}"`}>
                  • Região: "{regionFilter}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resumo dos dados filtrados */}
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="text-center p-3 sm:p-4 border rounded-lg bg-green-50">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
              {isFilterActive && filteredStats ? 
                `${((filteredStats.summary.present / (filteredStats.summary.total || 1)) * 100).toFixed(1)}%` :
                reportData ? `${((reportData.summary.present / (reportData.summary.total || 1)) * 100).toFixed(1)}%` : '0%'}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              <span className="hidden sm:inline">Taxa de Presença</span>
              <span className="sm:hidden">Presentes</span>
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 border rounded-lg bg-yellow-50">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-yellow-600">
              {isFilterActive && filteredStats ? 
                `${((filteredStats.summary.justified / (filteredStats.summary.total || 1)) * 100).toFixed(1)}%` :
                reportData ? `${((reportData.summary.justified / (reportData.summary.total || 1)) * 100).toFixed(1)}%` : '0%'}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              <span className="hidden sm:inline">Taxa de Justificação</span>
              <span className="sm:hidden">Justificados</span>
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 border rounded-lg bg-red-50">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">
              {isFilterActive && filteredStats ? 
                `${((filteredStats.summary.absent / (filteredStats.summary.total || 1)) * 100).toFixed(1)}%` :
                reportData ? `${((reportData.summary.absent / (reportData.summary.total || 1)) * 100).toFixed(1)}%` : '0%'}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              <span className="hidden sm:inline">Taxa de Ausência</span>
              <span className="sm:hidden">Ausentes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de registros filtrados */}
      <div className="w-full max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow border p-3 sm:p-4">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold mb-3 sm:mb-4">
            Registros Filtrados ({filteredRecords.length})
          </h2>
          {filteredRecords.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              Nenhum registro encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[20%] sm:w-[18%]" />
                  <col className="w-[15%] sm:w-[13%]" />
                  <col className="w-0 sm:w-[12%]" />
                  <col className="w-0 sm:w-[10%]" />
                  <col className="w-[25%] sm:w-[15%]" />
                  <col className="w-0 md:w-[12%]" />
                  <col className="w-0 md:w-[8%]" />
                  <col className="w-[20%] sm:w-[10%]" />
                  <col className="w-[20%] sm:w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-1 sm:p-2 font-medium text-xs sm:text-sm border-b truncate">
                      Nome
                    </th>
                    <th className="text-left p-1 sm:p-2 font-medium text-xs sm:text-sm border-b truncate">
                      CPF
                    </th>
                    <th className="hidden sm:table-cell text-left p-1 sm:p-2 font-medium text-xs sm:text-sm border-b truncate">
                      Pastor
                    </th>
                    <th className="hidden sm:table-cell text-left p-1 sm:p-2 font-medium text-xs sm:text-sm border-b truncate">
                      Cargo
                    </th>
                    <th className="text-left p-1 sm:p-2 font-medium text-xs sm:text-sm border-b truncate">
                      Região
                    </th>
                    <th className="hidden md:table-cell text-left p-1 sm:p-2 font-medium text-xs sm:text-sm border-b truncate">
                      Cidade
                    </th>
                    <th className="hidden md:table-cell text-left p-1 sm:p-2 font-medium text-xs sm:text-sm border-b truncate">
                      Reclas.
                    </th>
                    <th className="text-left p-1 sm:p-2 font-medium text-xs sm:text-sm border-b truncate">
                      Status
                    </th>
                    <th className="text-left p-1 sm:p-2 font-medium text-xs sm:text-sm border-b truncate">
                      <span className="hidden sm:inline">Data/Hora</span>
                      <span className="sm:hidden">Data</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r, idx) => (
                    <tr key={r.id || idx} className="hover:bg-muted/25 border-b last:border-b-0">
                      <td className="p-1 sm:p-2 text-xs sm:text-sm">
                        <button 
                          onClick={() => handleNameClick(r)}
                          className="text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer truncate block w-full text-left"
                          title={r.fullName}
                        >
                          {r.fullName}
                        </button>
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm truncate" title={r.cpf}>
                        {r.cpf}
                      </td>
                      <td className="hidden sm:table-cell p-1 sm:p-2 text-xs sm:text-sm truncate" title={r.pastorName}>
                        {r.pastorName}
                      </td>
                      <td className="hidden sm:table-cell p-1 sm:p-2 text-xs sm:text-sm truncate" title={r.churchPosition}>
                        {r.churchPosition}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm truncate" title={r.region}>
                        {r.region}
                      </td>
                      <td className="hidden md:table-cell p-1 sm:p-2 text-xs sm:text-sm truncate" title={r.city}>
                        {r.city}
                      </td>
                      <td className="hidden md:table-cell p-1 sm:p-2 text-xs sm:text-sm truncate text-center">
                        {r.reclassification}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          r.status === 'Presente'
                            ? 'bg-green-100 text-green-800'
                            : r.status === 'Justificado'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }`}>
                          <span className="hidden sm:inline">{r.status}</span>
                          <span className="sm:hidden">
                            {r.status === 'Presente' ? 'P' : r.status === 'Justificado' ? 'J' : 'A'}
                          </span>
                        </span>
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm truncate" title={r.timestamp ? new Date(r.timestamp).toLocaleDateString("pt-BR") + " " + new Date(r.timestamp).toLocaleTimeString("pt-BR") : ""}>
                        <span className="hidden sm:inline">
                          {r.timestamp ? new Date(r.timestamp).toLocaleDateString("pt-BR") + " " + new Date(r.timestamp).toLocaleTimeString("pt-BR") : ""}
                        </span>
                        <span className="sm:hidden">
                          {r.timestamp ? new Date(r.timestamp).toLocaleDateString("pt-BR") : "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Interativo de Edição e QR Code */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[700px] max-w-[95vw] max-h-[90vh] overflow-y-auto mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Informações de {selectedRecord?.fullName}
            </DialogTitle>
            <DialogDescription>
              Visualize, edite informações e gere QR Code para registro de presença
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-6">
              {/* Barra de Ações */}
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsEditMode(!isEditMode)}
                    variant={isEditMode ? "destructive" : "default"}
                    size="sm"
                  >
                    {isEditMode ? (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Cancelar Edição
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-1" />
                        Editar Informações
                      </>
                    )}
                  </Button>
                  
                  {isEditMode && (
                    <Button
                      onClick={handleSaveChanges}
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      {isSaving ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-1" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      Salvar Alterações
                    </Button>
                  )}
                </div>
                <Button
                  onClick={handleCloseModal}
                  variant="outline"
                  size="sm"
                >
                  <X className="h-4 w-4 mr-1" />
                  Fechar
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Coluna Esquerda - Informações Pessoais */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">📋 Informações Pessoais</h3>
                  
                  {/* Nome Completo */}
                  <div>
                    <Label>Nome Completo</Label>
                    {isEditMode ? (
                      <Input
                        value={editFields.fullName || ''}
                        onChange={(e) => handleEditFieldChange('fullName', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{selectedRecord.fullName}</p>
                    )}
                  </div>

                  {/* CPF */}
                  <div>
                    <Label>CPF</Label>
                    {isEditMode ? (
                      <Input
                        value={editFields.cpf || ''}
                        onChange={(e) => handleEditFieldChange('cpf', e.target.value)}
                        className="mt-1"
                        placeholder="000.000.000-00"
                      />
                    ) : (
                      <p className="font-medium">{selectedRecord.cpf}</p>
                    )}
                  </div>

                  {/* Região */}
                  <div>
                    <Label>Região</Label>
                    {isEditMode ? (
                      <Input
                        value={editFields.region || ''}
                        onChange={(e) => handleEditFieldChange('region', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{selectedRecord.region}</p>
                    )}
                  </div>

                  {/* Cidade */}
                  <div>
                    <Label>Cidade</Label>
                    {isEditMode ? (
                      <Input
                        value={editFields.city || ''}
                        onChange={(e) => handleEditFieldChange('city', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{selectedRecord.city}</p>
                    )}
                  </div>

                  {/* Pastor */}
                  <div>
                    <Label>Nome do Pastor</Label>
                    {isEditMode ? (
                      <Input
                        value={editFields.pastorName || ''}
                        onChange={(e) => handleEditFieldChange('pastorName', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{selectedRecord.pastorName}</p>
                    )}
                  </div>

                  {/* Cargo na Igreja */}
                  <div>
                    <Label>Cargo na Igreja</Label>
                    {isEditMode ? (
                      <Input
                        value={editFields.churchPosition || ''}
                        onChange={(e) => handleEditFieldChange('churchPosition', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{selectedRecord.churchPosition}</p>
                    )}
                  </div>

                  {/* Reclassificação */}
                  <div>
                    <Label>Reclassificação</Label>
                    {isEditMode ? (
                      <Input
                        value={editFields.reclassification || ''}
                        onChange={(e) => handleEditFieldChange('reclassification', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{selectedRecord.reclassification}</p>
                    )}
                  </div>

                  {/* Upload de Foto */}
                  {isEditMode && (
                    <div>
                      <Label>📷 Foto do Participante</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="mt-1"
                      />
                      {photoPreview && (
                        <div className="mt-2">
                          <img 
                            src={photoPreview} 
                            alt="Preview" 
                            className="w-24 h-24 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Coluna Direita - QR Code e Status */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">🔄 Status e QR Code</h3>
                  
                  {/* Status Atual */}
                  <div>
                    <Label>Status Atual</Label>
                    <Badge 
                      variant={
                        selectedRecord.status === 'Presente' ? 'default' :
                        selectedRecord.status === 'Justificado' ? 'secondary' : 
                        'destructive'
                      }
                      className="mt-1"
                    >
                      {selectedRecord.status || 'Presente'}
                    </Badge>
                  </div>

                  {/* Data/Hora do Registro */}
                  <div>
                    <Label>Data/Hora do Registro</Label>
                    <p className="font-medium">
                      {selectedRecord.timestamp ? 
                        new Date(selectedRecord.timestamp).toLocaleDateString('pt-BR') + ' ' + 
                        new Date(selectedRecord.timestamp).toLocaleTimeString('pt-BR') 
                        : 'Não registrado'
                      }
                    </p>
                  </div>

                  {/* QR Code para Presença */}
                  <div className="text-center">
                    <Label className="block mb-2">📱 QR Code para Registro de Presença</Label>
                    {qrCodeUrl ? (
                      <div className="bg-white p-4 rounded-lg border inline-block">
                        <img 
                          src={qrCodeUrl} 
                          alt="QR Code para presença" 
                          className="w-40 h-40 mx-auto"
                        />
                        <p className="text-xs text-gray-600 mt-2">
                          Escaneie para registrar presença
                        </p>
                        <p className="text-xs text-gray-500">
                          CPF: {selectedRecord.cpf}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gray-100 p-8 rounded-lg">
                        <QrCode className="h-16 w-16 mx-auto text-gray-400" />
                        <p className="text-sm text-gray-500 mt-2">
                          QR Code indisponível
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Botão para Baixar QR Code */}
                  {qrCodeUrl && (
                    <Button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.download = `qr-code-${selectedRecord.cpf}-${selectedRecord.fullName}.png`;
                        link.href = qrCodeUrl;
                        link.click();
                      }}
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Baixar QR Code
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

