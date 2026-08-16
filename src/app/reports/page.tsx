"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePeriodReports } from "@/hooks/use-reports";
import { getAttendanceHistoryByCpf, syncMemberProfile, updateAttendanceRecord } from "@/lib/actions";
import { getMemberDirectoryRecords } from "@/lib/member-data";
import type { AttendanceRecord } from "@/lib/types";
import { Edit, FileDown, QrCode, Save, X } from "lucide-react";
import QRCode from 'qrcode';
import * as React from "react";

export const dynamic = 'force-dynamic';


// Interface corrigida
interface FilteredStats {
  summary: {
    total: number;
    present: number;
    absent: number;
    justified: number;
  };
}

const MANAUS_TIME_ZONE = "America/Manaus";

function getManausYearMonth(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANAUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
  };
}

function isInManausMonth(value: Date | string | undefined, monthFilter: string) {
  if (!monthFilter || !value) return true;

  const [targetYear, targetMonth] = monthFilter.split("-").map(Number);
  if (!targetYear || !targetMonth) return false;

  if (!value) return false;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const parts = getManausYearMonth(date);
  return parts.year === targetYear && parts.month === targetMonth;
}

function formatMonthFilterLabel(monthFilter: string) {
  if (!monthFilter) return "";

  const [year, month] = monthFilter.split("-").map(Number);
  if (!year || !month) return monthFilter;

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getReferenceYear(dateFilter: string) {
  if (dateFilter) {
    const [year] = dateFilter.split("-").map(Number);
    if (year) return year;
  }

  return getManausYearMonth(new Date()).year;
}

function buildMonthOptionsForYear(referenceYear: number) {
  const { year: currentYear, month: currentMonth } = getManausYearMonth(new Date());
  const totalMonths = referenceYear === currentYear ? currentMonth : 12;

  return Array.from({ length: totalMonths }, (_, index) => {
    const month = totalMonths - index;
    const value = `${referenceYear}-${String(month).padStart(2, "0")}`;

    return {
      value,
      label: formatMonthFilterLabel(value),
    };
  });
}


export default function ReportsPage() {
  // Hooks de dados
  const { reportData, loading, error, loadPeriod } = usePeriodReports();

  // Estados de filtro simplificados
  const [regionFilter, setRegionFilter] = React.useState("ALL");
  const [positionFilter, setPositionFilter] = React.useState("ALL"); // ✅ Filtro por cargo (Obreiro, Presbítero, etc.)
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("todos"); // ✅ Filtro de status
  const [dateFilter, setDateFilter] = React.useState(""); // ✅ Filtro de data pontual (mantido para retrocompatibilidade)
  const [startDateFilter, setStartDateFilter] = React.useState("");
  const [endDateFilter, setEndDateFilter] = React.useState("");
  const [monthFilter, setMonthFilter] = React.useState("");
  const [isFiltersExpanded, setIsFiltersExpanded] = React.useState(true); // ✅ Estado para expandir/minimizar

  // ✅ Período efetivamente buscado no Firestore: por padrão só HOJE.
  // Mudar mês/data/intervalo dispara uma nova consulta indexada só para aquele
  // período — em vez de baixar o histórico inteiro de presença toda vez.
  const selectedPeriod = React.useMemo(() => {
    if (monthFilter) {
      const [year, month] = monthFilter.split("-").map(Number);
      return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0), // último dia do mês
      };
    }
    if (startDateFilter || endDateFilter) {
      return {
        start: new Date((startDateFilter || endDateFilter) + "T00:00:00"),
        end: new Date((endDateFilter || startDateFilter) + "T00:00:00"),
      };
    }
    if (dateFilter) {
      const d = new Date(dateFilter + "T00:00:00");
      return { start: d, end: d };
    }
    const today = new Date();
    return { start: today, end: today };
  }, [monthFilter, startDateFilter, endDateFilter, dateFilter]);

  React.useEffect(() => {
    loadPeriod(selectedPeriod.start, selectedPeriod.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const refreshData = React.useCallback(() => {
    loadPeriod(selectedPeriod.start, selectedPeriod.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  // Atualiza automaticamente o período atual a cada 5 minutos (mesma cadência de antes)
  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Estados para modal interativo
  const [selectedRecord, setSelectedRecord] = React.useState<AttendanceRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editFields, setEditFields] = React.useState<Partial<AttendanceRecord>>({});
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = React.useState<string | null>(null);

  // Estado para membros únicos do cadastro mestre com fallback seguro para legado
  const [allMembers, setAllMembers] = React.useState<Map<string, any>>(new Map());

  React.useEffect(() => {
    let active = true;

    const loadDirectory = async () => {
      try {
        const members = await getMemberDirectoryRecords();
        if (!active) return;

        const membersMap = new Map<string, AttendanceRecord>();
        members.forEach((member) => {
          if (member.cpf) {
            membersMap.set(member.cpf, member);
          }
        });

        setAllMembers(membersMap);
      } catch (directoryError) {
        console.error("Erro ao carregar diretório de membros:", directoryError);
        if (!active || !reportData) return;

        const fallbackMap = new Map<string, AttendanceRecord>();
        reportData.records.forEach((record) => {
          if (record.cpf && !fallbackMap.has(record.cpf)) {
            fallbackMap.set(record.cpf, record);
          }
        });
        setAllMembers(fallbackMap);
      }
    };

    void loadDirectory();

    return () => {
      active = false;
    };
  }, [reportData]);

  // Regiões e cargos disponíveis vêm do cadastro mestre de membros (não do período
  // carregado) — assim as opções não somem do filtro quando o dia/mês selecionado
  // não tem ninguém daquela região/cargo.
  const availableRegions = React.useMemo(() => {
    return Array.from(new Set(Array.from(allMembers.values()).map((m) => m.region).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [allMembers]);

  // Apenas os cargos disponíveis (Obreiro, Presbítero, etc.)
  const availablePositions = React.useMemo(() => {
    return Array.from(new Set(Array.from(allMembers.values()).map((m) => m.churchPosition).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [allMembers]);

  // Lista fixa dos últimos 24 meses (independente do período carregado — o mês
  // escolhido aqui é que dispara a consulta ao Firestore, não o contrário).
  const availableMonths = React.useMemo(() => {
    const { year: curYear, month: curMonth } = getManausYearMonth(new Date());
    const months: { value: string; label: string }[] = [];

    for (let i = 0; i < 24; i++) {
      const totalMonthIndex = curYear * 12 + (curMonth - 1) - i;
      const y = Math.floor(totalMonthIndex / 12);
      const m = (totalMonthIndex % 12) + 1;
      const value = `${y}-${String(m).padStart(2, "0")}`;
      months.push({ value, label: formatMonthFilterLabel(value) });
    }

    return months;
  }, []);

  // Histórico completo do membro selecionado (baseado no CPF).
  // Buscado sob demanda ao abrir o modal — não depende do período carregado na tela,
  // então mostra TODO o histórico do CPF mesmo quando só "hoje" está na tela.
  const [memberHistory, setMemberHistory] = React.useState<AttendanceRecord[]>([]);
  const [isLoadingMemberHistory, setIsLoadingMemberHistory] = React.useState(false);

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

  // Filtragem com Status e Data + Usuários Ausentes
  const filteredRecords = React.useMemo(() => {
    if (!reportData) return [];
    
    let records = reportData.records;

    // 🚨 LÓGICA ESPECIAL: Se filtro "Ausente" está ativo, mostrar MEMBROS SEM registro no dia
    if (statusFilter === "Ausente") {
      const targetDate = dateFilter || new Date().toISOString().split('T')[0];
      
      // CPFs dos membros que JÁ registraram presença no dia específico
      const registeredCPFs = new Set<string>();
      reportData.records.forEach(r => {
        if (!r.timestamp) return;
        
        const recordDate = new Date(r.timestamp);
        const filterDate = new Date(targetDate + "T00:00:00");
        const recordDateStr = recordDate.toLocaleDateString("pt-BR");
        const filterDateStr = filterDate.toLocaleDateString("pt-BR");
        
        if (recordDateStr === filterDateStr && r.cpf) {
          registeredCPFs.add(r.cpf);
        }
      });
      
      // Criar registros virtuais para membros que NÃO registraram no dia
      const absentMembers = Array.from(allMembers.entries())
        .filter(([cpf]) => cpf && !registeredCPFs.has(cpf))
        .map(([cpf, member]) => ({
          id: `absent-${cpf}`,
          cpf: member.cpf,
          fullName: member.fullName,
          status: 'Ausente',
          region: member.region,
          churchPosition: member.churchPosition,
          pastorName: member.pastorName,
          reclassification: member.reclassification,
          city: member.city,
          shift: member.shift,
          timestamp: new Date(targetDate + "T00:00:00"),
          photoUrl: member.photoUrl,
        } as AttendanceRecord));
      
      records = absentMembers;
    } else {
      // Filtro normal de status (Presente, Justificado, etc.)
      records = records.filter(r => {
        if (statusFilter !== "todos" && r.status !== statusFilter) {
          return false;
        }
        return true;
      });
    }
    
    // ✅ Filtro de região
    records = records.filter(r => {
      if (regionFilter !== "ALL" && !(r.region || '').toLowerCase().includes(regionFilter.toLowerCase())) {
        return false;
      }
      return true;
    });

    // ✅ Filtro de cargo (Obreiro, Presbítero, etc.)
    records = records.filter(r => {
      if (positionFilter !== "ALL" && r.churchPosition !== positionFilter) {
        return false;
      }
      return true;
    });

    // ✅ Filtro de data exata (legado) para quem ainda usa o campo único
    if (dateFilter && statusFilter !== "Ausente") {
      records = records.filter(r => {
        if (!r.timestamp) return false;
        const recordDate = new Date(r.timestamp);
        const filterDate = new Date(dateFilter + "T00:00:00");
        return recordDate.toLocaleDateString("pt-BR") === filterDate.toLocaleDateString("pt-BR");
      });
    }

    // ✅ Novo filtro por intervalo de datas (início/fim)
    if ((startDateFilter || endDateFilter) && statusFilter !== "Ausente") {
      const start = startDateFilter ? new Date(startDateFilter + "T00:00:00") : null;
      const end = endDateFilter ? new Date(endDateFilter + "T23:59:59") : null;

      records = records.filter((r) => {
        if (!r.timestamp) return false;
        const recordDate = new Date(r.timestamp);
        if (start && recordDate < start) return false;
        if (end && recordDate > end) return false;
        return true;
      });
    }

    if (monthFilter) {
      records = records.filter((record) => isInManausMonth(record.timestamp, monthFilter));
    }

    // ✅ Busca por Nome e CPF
    const term = search.trim().toLowerCase();
    if (term) {
      records = records.filter(r => {
        const searchableFields = [
          r.fullName || '',
          r.cpf || '',
          (r.cpf || '').replace(/\D/g, ''),
        ];
        
        return searchableFields.some(field => {
          const fieldStr = String(field).toLowerCase().trim();
          return fieldStr && fieldStr.includes(term);
        });
      });
    }
    
    return records;
  }, [reportData, regionFilter, positionFilter, search, statusFilter, dateFilter, allMembers, monthFilter]);

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
    return (
      regionFilter !== "ALL" ||
      positionFilter !== "ALL" ||
      search.trim() !== "" ||
      statusFilter !== "todos" ||
      dateFilter !== "" ||
      monthFilter !== "" ||
      startDateFilter !== "" ||
      endDateFilter !== ""
    );
  }, [dateFilter, endDateFilter, monthFilter, regionFilter, positionFilter, search, startDateFilter, statusFilter]);

  // Função para limpar todos os filtros
  function clearAllFilters() {
    setRegionFilter("ALL");
    setPositionFilter("ALL");
    setSearch("");
    setStatusFilter("todos"); // ✅ Limpar filtro de status
    setDateFilter(""); // ✅ Limpar filtro de data
    setStartDateFilter("");
    setEndDateFilter("");
    setMonthFilter("");
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
    setMemberHistory([]);

    // Gerar QR Code automaticamente com o CPF
    if (record.cpf) {
      generateQRCode(record.cpf);
      loadMemberHistory(record.cpf);
    }
  };

  // Busca o histórico completo de presença do CPF (todas as datas), sob demanda
  const loadMemberHistory = async (cpf: string) => {
    setIsLoadingMemberHistory(true);
    try {
      const history = await getAttendanceHistoryByCpf(cpf);
      setMemberHistory(history as unknown as AttendanceRecord[]);
    } catch (historyError) {
      console.error("Erro ao carregar histórico do membro:", historyError);
      setMemberHistory([]);
    } finally {
      setIsLoadingMemberHistory(false);
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
      await syncMemberProfile(
        {
          ...selectedRecord,
          ...editFields,
          cpf: (editFields.cpf ?? selectedRecord.cpf ?? "").toString(),
        },
        { lastPresenceAt: selectedRecord.lastPresenceAt ?? selectedRecord.timestamp ?? null }
      );
      
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
    setMemberHistory([]);
  };

  // Funções de exportação para PDF
  function exportFilteredDataPDF() {
    if (!reportData || filteredRecords.length === 0) {
      alert("Nenhum registro para exportar");
      return;
    }

    try {
      // Criar HTML para o PDF
      let html = `
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { text-align: center; color: #333; }
              .meta { text-align: center; color: #666; margin: 10px 0; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #4CAF50; color: white; }
              tr:nth-child(even) { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>RELATÓRIO DE PRESENÇA</h1>
            <div class="meta">
              <p>Data de Geração: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              <p>Total de Registros: ${filteredRecords.length}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Pastor</th>
                  <th>Cargo</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
      `;

      filteredRecords.forEach((record) => {
        const statusColor = record.status === "Presente" ? "#4CAF50" : record.status === "Ausente" ? "#f44336" : "#FF9800";
        html += `
          <tr>
            <td>${record.fullName || ""}</td>
            <td>${record.cpf || ""}</td>
            <td>${record.pastorName || ""}</td>
            <td>${record.churchPosition || ""}</td>
            <td style="background-color: ${statusColor}; color: white;">${record.status || "Presente"}</td>
            <td>${record.timestamp ? new Date(record.timestamp).toLocaleDateString("pt-BR") : ""}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </body>
        </html>
      `;

      // Usar a função print do navegador para salvar como PDF
      const printWindow = window.open("", "", "height=400,width=800");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        // Aguardar um pouco para garantir que o documento foi carregado
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      alert("Erro ao gerar PDF. Tente novamente.");
    }
  }

  function exportSummaryDataPDF() {
    if (!reportData) {
      alert("Nenhum dado para exportar");
      return;
    }

    try {
      // Criar HTML para o PDF
      let html = `
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
              h1 { text-align: center; color: #333; }
              .meta { text-align: center; color: #666; margin: 10px 0; font-size: 12px; }
              .stats { margin: 20px 0; }
              .stat-item { 
                display: inline-block; 
                width: 45%; 
                margin: 10px 2.5%; 
                padding: 15px; 
                background-color: white; 
                border-radius: 5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .stat-label { font-weight: bold; color: #666; }
              .stat-value { font-size: 24px; color: #4CAF50; margin-top: 5px; }
              .section { margin-top: 30px; }
              .section-title { 
                font-weight: bold; 
                font-size: 14px; 
                color: white; 
                background-color: #4CAF50; 
                padding: 10px; 
                margin: 10px 0 5px 0;
              }
              .item { padding: 8px; border-bottom: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <h1>RESUMO ESTATÍSTICO DE PRESENÇA</h1>
            <div class="meta">
              <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            <div class="stats">
              <div class="stat-item">
                <div class="stat-label">Total de Registros</div>
                <div class="stat-value">${reportData.summary.total}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Presentes</div>
                <div class="stat-value" style="color: #4CAF50;">${reportData.summary.present}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Ausentes</div>
                <div class="stat-value" style="color: #f44336;">${reportData.summary.absent}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Justificados</div>
                <div class="stat-value" style="color: #FF9800;">${reportData.summary.justified || 0}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Taxa de Presença</div>
                <div class="stat-value" style="color: #2196F3;">${reportData.summary.attendanceRate}%</div>
              </div>
            </div>
      `;

      if (reportData.byShift && Object.keys(reportData.byShift).length > 0) {
        html += `<div class="section"><div class="section-title">Distribuição por Turno</div>`;
        Object.entries(reportData.byShift).forEach(([turno, count]) => {
          html += `<div class="item">${turno}: <strong>${count}</strong></div>`;
        });
        html += `</div>`;
      }

      if (reportData.byRegion && Object.keys(reportData.byRegion).length > 0) {
        html += `<div class="section"><div class="section-title">Distribuição por Região</div>`;
        Object.entries(reportData.byRegion).forEach(([regiao, count]) => {
          html += `<div class="item">${regiao}: <strong>${count}</strong></div>`;
        });
        html += `</div>`;
      }

      html += `
          </body>
        </html>
      `;

      // Usar a função print do navegador para salvar como PDF
      const printWindow = window.open("", "", "height=400,width=800");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        // Aguardar um pouco para garantir que o documento foi carregado
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      alert("Erro ao gerar PDF. Tente novamente.");
    }
  }

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
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8 animate-in fade-in duration-500" suppressHydrationWarning>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 animate-in slide-in-from-top duration-500">
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

      {/* Indicador do período carregado — por padrão só o dia de hoje */}
      <div className="bg-slate-100 text-slate-700 p-2 sm:p-3 rounded text-xs sm:text-sm">
        📅 Mostrando: <strong>
          {monthFilter
            ? formatMonthFilterLabel(monthFilter)
            : startDateFilter || endDateFilter
              ? `${startDateFilter ? new Date(startDateFilter + "T00:00:00").toLocaleDateString("pt-BR") : "início livre"} → ${endDateFilter ? new Date(endDateFilter + "T00:00:00").toLocaleDateString("pt-BR") : "sem fim"}`
              : dateFilter
                ? new Date(dateFilter + "T00:00:00").toLocaleDateString("pt-BR")
                : `hoje (${new Date().toLocaleDateString("pt-BR")})`}
        </strong>{" "}
        — use os filtros de mês, data ou intervalo abaixo para consultar outros períodos.
      </div>

      {/* Filtros Colapsáveis */}
      <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '100ms' }}>
        <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-300">
          {/* Header Colapsável */}
          <div 
            className="p-3 sm:p-6 cursor-pointer hover:bg-gray-50 hover:scale-[1.01] transition-all duration-300 rounded-t-lg"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm sm:text-lg font-bold flex items-center gap-2">
                  <span className="text-lg">{isFiltersExpanded ? "🔽" : "▶️"}</span>
                  <span className="hidden sm:inline">Filtros de Relatórios</span>
                  <span className="sm:hidden">Filtros</span>
                </h2>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">
                  {isFiltersExpanded ? (
                    "Combine filtros por status, data, mês, região, cargo e busca textual"
                  ) : (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-semibold text-gray-900">{filteredRecords.length} registro(s)</span>
                      {search && <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">🔍 "{search}"</span>}
                      {dateFilter && <span className="bg-purple-100 px-2 py-0.5 rounded text-xs">📅 {new Date(dateFilter + "T00:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}</span>}
                      {(startDateFilter || endDateFilter) && (
                        <span className="bg-pink-100 px-2 py-0.5 rounded text-xs">
                          ⏳
                          {startDateFilter ? ` ${new Date(startDateFilter + "T00:00:00").toLocaleDateString("pt-BR")}` : ' início livre'}
                          {" → "}
                          {endDateFilter ? new Date(endDateFilter + "T00:00:00").toLocaleDateString("pt-BR") : ' sem fim'}
                        </span>
                      )}
                      {statusFilter !== "todos" && <span className="bg-green-100 px-2 py-0.5 rounded text-xs">✅ {statusFilter}</span>}
                      {regionFilter !== "ALL" && <span className="bg-orange-100 px-2 py-0.5 rounded text-xs truncate max-w-[120px]">📍 {regionFilter}</span>}
                      {positionFilter !== "ALL" && <span className="bg-teal-100 px-2 py-0.5 rounded text-xs truncate max-w-[140px]">🧑‍💼 {positionFilter}</span>}
                      {monthFilter && (
                        <span className="bg-amber-100 px-2 py-0.5 rounded text-xs truncate max-w-[220px]">
                          🗓️ {formatMonthFilterLabel(monthFilter)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button
                className="shrink-0 bg-gray-200 hover:bg-gray-300 px-3 py-1.5 rounded text-xs sm:text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFiltersExpanded(!isFiltersExpanded);
                }}
              >
                {isFiltersExpanded ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {/* Conteúdo dos Filtros */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isFiltersExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="p-3 sm:p-6 pt-0 space-y-4">
              {/* Primeira Linha: Busca, Status, Mês */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                    🔍 Buscar por Nome ou CPF
                  </label>
                  <input 
                    type="text" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    placeholder="Digite o nome ou CPF..." 
                    className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border rounded px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                    ✅ Filtrar por Status
                  </label>
                  <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value)} 
                    className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border rounded px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="todos">Todos</option>
                    <option value="Presente">Presente</option>
                    <option value="Justificado">Justificado</option>
                    <option value="Ausente">Ausente</option>
                  </select>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                    🗓️ Filtrar por Mês
                  </label>
                  <Select value={monthFilter || "__all__"} onValueChange={(value) => setMonthFilter(value === "__all__" ? "" : value)}>
                    <SelectTrigger className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border text-xs sm:text-sm focus:ring-2 focus:ring-amber-500">
                      <SelectValue placeholder="Filtrar por mês" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos os meses</SelectItem>
                      {availableMonths.map((monthOption) => (
                        <SelectItem key={monthOption.value} value={monthOption.value}>
                          {monthOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Segunda Linha: Região, cargo e data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                    📅 Filtrar por Data
                  </label>
                  <input 
                    type="date" 
                    value={dateFilter} 
                    onChange={e => setDateFilter(e.target.value)} 
                    className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border rounded px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="p-3 bg-pink-50 dark:bg-pink-950 rounded-lg">
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                    ⏳ Intervalo de Datas (início → fim)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border rounded px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="Data inicial"
                    />
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border rounded px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                      placeholder="Data final"
                    />
                  </div>
                </div>

                <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                    📍 Filtrar por Região
                  </label>
                  <select 
                    value={regionFilter} 
                    onChange={e => setRegionFilter(e.target.value)} 
                    className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border rounded px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="ALL">Todas as Regiões</option>
                    {availableRegions.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-teal-50 dark:bg-teal-950 rounded-lg">
                  <label className="block text-xs sm:text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                    🧑‍💼 Filtrar por Cargo
                  </label>
                  <select
                    value={positionFilter}
                    onChange={e => setPositionFilter(e.target.value)}
                    className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border rounded px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="ALL">Todos os Cargos</option>
                    {availablePositions.map(position => (
                      <option key={position} value={position}>{position}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Aviso especial para filtro "Ausente" */}
              {statusFilter === "Ausente" && (
                <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded">
                  <p className="text-xs sm:text-sm text-red-700">
                    <strong>⚠️ Modo Ausentes:</strong> Mostrando membros que <strong>NÃO registraram presença</strong> no dia {dateFilter ? new Date(dateFilter + "T00:00:00").toLocaleDateString("pt-BR") : "de hoje"}.
                    <br />
                    <small>Base: {allMembers.size} membros do cadastro mestre com fallback seguro para legado.</small>
                  </p>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-2 flex-wrap pt-3 border-t">
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
                  <span className="hidden sm:inline">📥 Exportar CSV Filtrado</span>
                  <span className="sm:hidden">📥 CSV Filtrado</span>
                </button>
                <button 
                  onClick={exportSummaryData} 
                  disabled={!reportData} 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex-1 sm:flex-none"
                >
                  <span className="hidden sm:inline">📋 Exportar CSV Resumo</span>
                  <span className="sm:hidden">📋 CSV Resumo</span>
                </button>
                <button 
                  onClick={exportFilteredDataPDF} 
                  disabled={!reportData || filteredRecords.length === 0} 
                  className="bg-red-600 hover:bg-red-700 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex-1 sm:flex-none"
                >
                  <span className="hidden sm:inline">📄 Exportar PDF Filtrado</span>
                  <span className="sm:hidden">📄 PDF Filtrado</span>
                </button>
                <button 
                  onClick={exportSummaryDataPDF} 
                  disabled={!reportData} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex-1 sm:flex-none"
                >
                  <span className="hidden sm:inline">📊 Exportar PDF Resumo</span>
                  <span className="sm:hidden">📊 PDF Resumo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo dos dados filtrados */}
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="text-center p-3 sm:p-4 border rounded-lg bg-green-50 hover:shadow-lg hover:-translate-y-1 transition-all animate-in fade-in slide-in-from-bottom duration-500" style={{ animationDelay: '300ms' }}>
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
          <div className="text-center p-3 sm:p-4 border rounded-lg bg-yellow-50 hover:shadow-lg hover:-translate-y-1 transition-all animate-in fade-in slide-in-from-bottom duration-500" style={{ animationDelay: '350ms' }}>
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
          <div className="text-center p-3 sm:p-4 border rounded-lg bg-red-50 hover:shadow-lg hover:-translate-y-1 transition-all animate-in fade-in slide-in-from-bottom duration-500" style={{ animationDelay: '400ms' }}>
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
      <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '450ms' }}>
        <div className="bg-white rounded-lg shadow border p-3 sm:p-4 hover:shadow-lg transition-shadow duration-300">
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
                    <tr key={r.id || idx} className="hover:bg-blue-50 border-b last:border-b-0 animate-in fade-in slide-in-from-right duration-500 transition-colors" style={{ animationDelay: `${idx * 30}ms` }}>
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

                  {/* Foto do Membro */}
                  {!isEditMode && (selectedRecord.photoUrl || photoPreview) && (
                    <div className="flex justify-center mb-2">
                      <img
                        src={photoPreview || selectedRecord.photoUrl || ""}
                        alt={`Foto de ${selectedRecord.fullName}`}
                        className="w-28 h-28 object-cover rounded-full border-4 border-blue-200 shadow"
                      />
                    </div>
                  )}

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

                  {/* TOTVS */}
                  <div>
                    <Label>TOTVS</Label>
                    {isEditMode ? (
                      <Input
                        value={editFields.totvs || ''}
                        onChange={(e) => handleEditFieldChange('totvs', e.target.value)}
                        placeholder="Digite o código TOTVS"
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{selectedRecord.totvs || '-'}</p>
                    )}
                  </div>

                  {/* ETDA */}
                  <div>
                    <Label>ETDA</Label>
                    {isEditMode ? (
                      <Input
                        value={editFields.etda || ''}
                        onChange={(e) => handleEditFieldChange('etda', e.target.value)}
                        placeholder="Digite o código ETDA"
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{selectedRecord.etda || '-'}</p>
                    )}
                  </div>

                  {/* Telefone */}
                  <div>
                    <Label>📞 Telefone / WhatsApp</Label>
                    {isEditMode ? (
                      <Input
                        value={(editFields as any).phone || ''}
                        onChange={(e) => handleEditFieldChange('phone', e.target.value)}
                        placeholder="(XX) XXXXX-XXXX"
                        className="mt-1"
                      />
                    ) : (
                      <p className="font-medium">{(selectedRecord as any).phone || '-'}</p>
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

              {/* Histórico de Presenças do Membro */}
              <div className="space-y-3 border rounded-lg p-3 sm:p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    🗂️ Histórico de Presenças (CPF: {selectedRecord.cpf || 'n/d'})
                  </h3>
                  <span className="text-sm text-gray-600">
                    {memberHistory.length} registro(s)
                  </span>
                </div>

                {isLoadingMemberHistory ? (
                  <p className="text-sm text-gray-600">Carregando histórico...</p>
                ) : memberHistory.length === 0 ? (
                  <p className="text-sm text-gray-600">Nenhum histórico encontrado para este CPF.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto border rounded-md bg-white">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-2">Data/Hora</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Região</th>
                          <th className="text-left p-2">Cidade</th>
                          <th className="text-left p-2">Turno</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberHistory.map((h, idx) => (
                          <tr key={h.id || idx} className={idx % 2 ? "bg-gray-50" : ""}>
                            <td className="p-2 whitespace-nowrap">
                              {h.timestamp
                                ? new Date(h.timestamp).toLocaleDateString("pt-BR") +
                                  " " +
                                  new Date(h.timestamp).toLocaleTimeString("pt-BR")
                                : "-"}
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              <Badge
                                variant={
                                  h.status === "Presente"
                                    ? "default"
                                    : h.status === "Justificado"
                                    ? "secondary"
                                    : "destructive"
                                }
                              >
                                {h.status || "Presente"}
                              </Badge>
                            </td>
                            <td className="p-2">{h.region || "-"}</td>
                            <td className="p-2">{h.city || "-"}</td>
                            <td className="p-2">{h.shift || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
