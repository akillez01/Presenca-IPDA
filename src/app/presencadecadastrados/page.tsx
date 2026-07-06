"use client";

import { PhotoCaptureField } from "@/components/attendance/photo-capture-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { deleteAttendance, getAttendanceRecords, registerAttendanceByCpf, syncMemberProfile, updateAttendanceRecord } from "@/lib/actions";
import { deleteAttendancePhoto, getStoragePathFromUrl, uploadAttendancePhoto } from "@/lib/attendance-photo";
import { createManualBackup } from "@/lib/backup-client";
import { auth } from "@/lib/firebase";
import { getMemberDirectoryRecords } from "@/lib/member-data";
import type { AttendanceRecord } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export const dynamic = 'force-dynamic';

type PhotoSelectionState = {
  file?: File;
  dataUrl?: string | null;
  preview?: string | null;
} | null;

const MANAUS_TIME_ZONE = "America/Manaus";

function getTodayManausInputDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANAUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseDateSafely(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

async function getMemberDirectoryRecordsViaApi(): Promise<AttendanceRecord[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return [];
  }

  try {
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/admin/members-directory", {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !Array.isArray(payload.members)) {
      return [];
    }

    return payload.members
      .map((member: any) => {
        const timestamp =
          parseDateSafely(member.lastPresenceAt) ||
          parseDateSafely(member.updatedAt) ||
          parseDateSafely(member.createdAt) ||
          new Date();

        return {
          id: String(member.id || member.cpf || ""),
          memberId: String(member.id || member.cpf || ""),
          sourceCollection: "members",
          timestamp,
          createdAt: parseDateSafely(member.createdAt) || timestamp,
          updatedAt: parseDateSafely(member.updatedAt) || undefined,
          lastPresenceAt: parseDateSafely(member.lastPresenceAt),
          fullName: String(member.fullName || ""),
          cpf: String(member.cpf || "").replace(/\D/g, ""),
          birthday: String(member.birthday || ""),
          reclassification: String(member.reclassification || ""),
          pastorName: String(member.pastorName || ""),
          region: String(member.region || ""),
          churchPosition: String(member.churchPosition || ""),
          city: String(member.city || ""),
          shift: String(member.shift || ""),
          totvs: String(member.totvs || ""),
          etda: String(member.etda || ""),
          status: String(member.status || "Ausente"),
          photoUrl: member.photoUrl ?? null,
          absentReason: String(member.absentReason || ""),
        } as AttendanceRecord;
      })
      .filter((member: AttendanceRecord) => Boolean(member.cpf));
  } catch (error) {
    console.warn("Nao foi possivel carregar membros via API admin.", error);
    return [];
  }
}

function normalizeSearchText(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

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

export default function PresencaCadastradosPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, string>>({});
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [regionFilter, setRegionFilter] = useState("__all__");
  const [dateFilter, setDateFilter] = useState(""); // ✅ Novo filtro de data
  const [monthFilter, setMonthFilter] = useState("");
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [editModalFields, setEditModalFields] = useState<Partial<AttendanceRecord>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editPhotoSelection, setEditPhotoSelection] = useState<PhotoSelectionState>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editOriginalPhotoUrl, setEditOriginalPhotoUrl] = useState<string | null>(null);
  const [editPhotoMarkedForRemoval, setEditPhotoMarkedForRemoval] = useState(false);
  const [isUploadingEditPhoto, setIsUploadingEditPhoto] = useState(false);
  const [editTimestamp, setEditTimestamp] = useState<string>(""); // ✅ Para editar data/hora de presença
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true); // ✅ Estado para expandir/minimizar filtros
  const [isMounted, setIsMounted] = useState(false);
  const [allMembers, setAllMembers] = useState<Map<string, any>>(new Map()); // ✅ Membros únicos para filtro "Ausente"

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const selectedRecord = useMemo(() => {
    if (!selectedRecordId) return null;
    return records.find((record) => record.id === selectedRecordId) ?? null;
  }, [records, selectedRecordId]);

  function toManausDate(date: Date) {
    return new Date(date.toLocaleString("en-US", { timeZone: "America/Manaus" }));
  }

  async function fetchRecords() {
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    try {
      const [data, adminDirectory] = await Promise.all([
        getAttendanceRecords(),
        getMemberDirectoryRecordsViaApi(),
      ]);

      let directory: AttendanceRecord[] = adminDirectory;

      if (directory.length === 0) {
        try {
          directory = await getMemberDirectoryRecords();
        } catch (directoryError) {
          console.warn("Nao foi possivel carregar o diretorio de membros. Usando dados disponiveis.", directoryError);
        }
      }

      if (directory.length === 0) {
        console.warn("Diretorio de membros indisponivel no momento. Somente registros de presenca estao visiveis.");
      }

      if (Array.isArray(data) && data.length > 0) {
        setRecords(data);

        const initialStatus: Record<string, string> = {};
        const initialJust: Record<string, string> = {};

        data.forEach((record: AttendanceRecord) => {
          initialStatus[record.id] = record.status || "Presente";
          if (record.absentReason) {
            initialJust[record.id] = record.absentReason;
          }
        });

        setAttendanceStatus(initialStatus);
        setJustificativas(initialJust);
      } else {
        setRecords([]);
        setAttendanceStatus({});
        setJustificativas({});
      }

      const membersMap = new Map<string, AttendanceRecord>();
      directory.forEach((member) => {
        if (member.cpf) {
          membersMap.set(member.cpf, member);
        }
      });
      data.forEach((record) => {
        if (record.cpf && !membersMap.has(record.cpf)) {
          membersMap.set(record.cpf, record);
        }
      });
      setAllMembers(membersMap);

      setError(null);
    } catch (err) {
      console.error("Erro ao carregar registros de presença:", err);
      setError("Erro ao carregar registros de presença.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    fetchRecords();
  }, [authLoading, router, user]);

  useEffect(() => {
    const regions = Array.from(
      new Set(
        records
          .map((record) => record.region)
          .filter((region): region is string => Boolean(region))
      )
    ).sort((a, b) => a.localeCompare(b));

    setAvailableRegions(regions);
  }, [records]);

  const referenceYear = useMemo(() => getReferenceYear(dateFilter), [dateFilter]);
  const availableMonths = useMemo(() => buildMonthOptionsForYear(referenceYear), [referenceYear]);

  useEffect(() => {
    if (monthFilter && !availableMonths.some((monthOption) => monthOption.value === monthFilter)) {
      setMonthFilter("");
    }
  }, [availableMonths, monthFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, regionFilter, dateFilter, monthFilter]);

  useEffect(() => {
    if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) {
      handleModalOpenChange(false);
    }
  }, [records, selectedRecordId]);

  function handleStatusChange(id: string, value: string) {
    setAttendanceStatus((prev) => ({ ...prev, [id]: value }));
    if (value === "Presente") {
      setJustificativas((prev) => ({ ...prev, [id]: "" }));
    }
  }

  function handleJustificativaChange(id: string, value: string) {
    setJustificativas((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmitAttendance(id: string) {
    const record = records.find((r) => r.id === id) ?? (id.startsWith("absent-") ? allMembers.get(id.replace("absent-", "")) : null);
    const nomePessoa = record?.fullName || "pessoa selecionada";
    const cpfPessoa = record?.cpf || "";
    const statusEscolhido = attendanceStatus[id] || "Presente";
    const justificativa = justificativas[id];

    const confirmacao = confirm(`Confirmar registro de presença?

👤 Pessoa: ${nomePessoa}
📝 Status: ${statusEscolhido}
${justificativa ? `💬 Justificativa: ${justificativa}` : ""}
⏰ Data/Hora: ${new Date().toLocaleString("pt-BR")}

Clique OK para confirmar ou Cancelar para abortar.`);

    if (!confirmacao) {
      return;
    }

    try {
      setLoading(true);
      const currentTimestamp = new Date();

      const result = await registerAttendanceByCpf(cpfPessoa, statusEscolhido, justificativa || "", currentTimestamp);
      if (!result.success) {
        setError(result.error || "Erro ao registrar presença.");
        return;
      }

      await fetchRecords();

      setError(null);
      alert(`✅ Presença ${statusEscolhido.toLowerCase()} registrada com sucesso para ${nomePessoa}!`);
    } catch (err) {
      console.error("Erro ao registrar presença:", err);
      
      // ✅ Tratamento específico para erro de duplicação
      const errorMessage = err instanceof Error ? err.message : "Erro ao registrar presença.";
      
      if (errorMessage.includes("Duplicação bloqueada")) {
        alert(errorMessage); // Mostra mensagem específica de duplicação
        setError(errorMessage);
      } else {
        setError("Erro ao registrar presença.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAllAttendances() {
    try {
      setLoading(true);
      const currentTimestamp = new Date();
      const uniqueRecords = Array.from(
        new Map(
          filteredRecords
            .filter((record) => record.cpf)
            .map((record) => [record.cpf, record])
        ).values()
      );

      // ✅ Registrar em lote com controle de erros individual
      let successCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      const promises = uniqueRecords.map(async (record) => {
        const statusAtual = attendanceStatus[record.id] || record.status || "Presente";
        const justificativaAtual = justificativas[record.id] || record.absentReason || "";
        
        try {
          const result = await registerAttendanceByCpf(record.cpf, statusAtual, justificativaAtual, currentTimestamp);
          if (!result.success) {
            throw new Error(result.error || "Falha ao registrar presença.");
          }
          successCount++;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "";
          if (errorMessage.includes("Duplicação bloqueada")) {
            duplicateCount++;
            console.log(`Duplicação bloqueada para ${record.fullName}`);
          } else {
            errorCount++;
            console.error(`Erro ao registrar ${record.fullName}:`, err);
          }
        }
      });

      await Promise.all(promises);
      await fetchRecords();

      setError(null);
      
      // ✅ Mensagem detalhada sobre o resultado
      let message = `✅ Registros processados:\n• ${successCount} registrados com sucesso`;
      if (duplicateCount > 0) {
        message += `\n• ${duplicateCount} duplicados bloqueados`;
      }
      if (errorCount > 0) {
        message += `\n• ${errorCount} erros`;
      }
      
      alert(message);
    } catch (err) {
      console.error("Erro ao registrar presenças:", err);
      setError("Erro ao registrar presenças.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRecord(id: string) {
    if (!selectedRecord) {
      return;
    }

    let uploadedPhoto: { downloadURL: string; storagePath: string } | null = null;
    let photoUrlToDelete: string | null = null;

    try {
      setLoading(true);
      setError(null);

      const currentTimestamp = new Date();
      const statusAtual = attendanceStatus[id] || "Presente";
      const justificativaAtual = justificativas[id] || "";

      // ✅ Prepara dados para atualização
      const updateData: Partial<AttendanceRecord> = {
        ...editModalFields,
        status: statusAtual,
        absentReason: justificativaAtual,
        lastUpdated: currentTimestamp,
      };
      
      // ✅ Se o timestamp foi editado manualmente, inclui na atualização
      if (editTimestamp && editTimestamp !== "") {
        const editedDate = new Date(editTimestamp);
        if (!isNaN(editedDate.getTime())) {
          updateData.timestamp = editedDate;
        }
      }

      if (editPhotoSelection) {
        setIsUploadingEditPhoto(true);
        try {
          const cpfForUpload = (editModalFields.cpf ?? selectedRecord.cpf ?? "").toString();
          uploadedPhoto = await uploadAttendancePhoto({
            cpf: cpfForUpload,
            file: editPhotoSelection.file,
            dataUrl: editPhotoSelection.dataUrl ?? undefined,
          });
          updateData.photoUrl = uploadedPhoto.downloadURL;
          if (editOriginalPhotoUrl && editOriginalPhotoUrl !== uploadedPhoto.downloadURL) {
            photoUrlToDelete = editOriginalPhotoUrl;
          }
        } catch (uploadError) {
          console.error("Erro ao enviar foto durante edição:", uploadError);
          setError("Não foi possível enviar a nova foto. Verifique a conexão e tente novamente.");
          return;
        } finally {
          setIsUploadingEditPhoto(false);
        }
      } else if (editPhotoMarkedForRemoval && editOriginalPhotoUrl) {
        updateData.photoUrl = null;
        photoUrlToDelete = editOriginalPhotoUrl;
      }

      Object.entries(updateData).forEach(([key, value]) => {
        if (value === undefined) {
          delete (updateData as Record<string, unknown>)[key];
        }
      });

      // ✅ Permite edição de timestamp APENAS se fornecido explicitamente
      // Caso contrário, não inclui no updateData (preserva o original)
      if (!updateData.timestamp) {
        delete (updateData as Record<string, unknown>)['timestamp'];
      }

      try {
        await updateAttendanceRecord(id, updateData);
        await syncMemberProfile(
          {
            ...selectedRecord,
            ...updateData,
            cpf: (editModalFields.cpf ?? selectedRecord.cpf ?? "").toString(),
          },
          { lastPresenceAt: selectedRecord.lastPresenceAt ?? selectedRecord.timestamp ?? null }
        );
      } catch (saveError) {
        if (uploadedPhoto) {
          try {
            await deleteAttendancePhoto(uploadedPhoto.storagePath);
          } catch (cleanupError) {
            console.warn("⚠️ Falha ao remover foto após erro de atualização:", cleanupError);
          }
        }
        throw saveError;
      }

      setRecords((prev) =>
        prev.map((record) => {
          if (record.id !== id) {
            return record;
          }

          // ✅ PRESERVA o timestamp original - apenas atualiza outros campos
          const originalTimestamp = record.timestamp;
          return {
            ...record,
            ...updateData,
            timestamp: originalTimestamp, // ✅ Garante que timestamp não muda
          } as AttendanceRecord;
        })
      );

      if (photoUrlToDelete) {
        const storagePath = getStoragePathFromUrl(photoUrlToDelete);
        if (storagePath && (!uploadedPhoto || storagePath !== uploadedPhoto.storagePath)) {
          try {
            await deleteAttendancePhoto(storagePath);
          } catch (cleanupError) {
            console.warn("⚠️ Falha ao remover foto antiga do Storage:", cleanupError);
          }
        }
      }

      if (uploadedPhoto) {
        setEditPhotoPreview(uploadedPhoto.downloadURL);
        setEditOriginalPhotoUrl(uploadedPhoto.downloadURL);
      } else if (Object.prototype.hasOwnProperty.call(updateData, "photoUrl") && updateData.photoUrl === null) {
        setEditPhotoPreview(null);
        setEditOriginalPhotoUrl(null);
      }

      setEditPhotoSelection(null);
      setEditPhotoMarkedForRemoval(false);
      await fetchRecords();

      setError(null);
      alert("Dados salvos com sucesso!");
      handleModalOpenChange(false);
    } catch (err) {
      console.error("Erro ao salvar dados:", err);
      setError("Erro ao salvar dados. Verifique a conexão.");
    } finally {
      setIsUploadingEditPhoto(false);
      setLoading(false);
    }
  }

  async function handleDeleteRecord(id: string, fullName: string) {
    if (!confirm(`Tem certeza que deseja excluir o registro de ${fullName}?`)) {
      return;
    }

    try {
      setLoading(true);
      const result = await deleteAttendance(id);

      if (result.success) {
        setRecords((prev) => prev.filter((record) => record.id !== id));

        setAttendanceStatus((prev) => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });

        setJustificativas((prev) => {
          const updated = { ...prev };
          delete updated[id];
          return updated;
        });

        if (selectedRecordId === id) {
          handleModalOpenChange(false);
        }

        setError(null);
      } else {
        setError(result.error || "Erro ao excluir registro.");
      }
    } catch (err) {
      console.error("Erro ao excluir registro:", err);
      setError("Erro ao excluir registro.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDesfazerRegistrosDeHoje() {
    const confirmacao = confirm(`
⚠️ ATENÇÃO: Esta ação irá desfazer TODOS os registros de presença feitos hoje.

Isso significa que:
• Todos os status de presença registrados hoje serão removidos
• Os registros voltarão para o estado original (sem status definido)
• Esta ação NÃO pode ser desfeita

Tem certeza que deseja continuar?`);

    if (!confirmacao) {
      return;
    }

    const confirmacaoFinal = confirm(`
🔴 CONFIRMAÇÃO FINAL

Você está prestes a desfazer TODOS os registros de presença de hoje.
Digite OK para confirmar ou Cancelar para abortar.

Esta é sua última chance de cancelar!`);

    if (!confirmacaoFinal) {
      return;
    }

    setLoading(true);
    try {
      const data = await getAttendanceRecords();
      console.log(`Verificando ${data.length} registros para desfazer registros de hoje`);

      const hoje = new Date();
      const registrosDeHoje = data.filter((record: AttendanceRecord) => {
        if (!record.timestamp) {
          return false;
        }

        const dataRegistro = new Date(record.timestamp);
        const dataManaus = toManausDate(dataRegistro);
        const hojeManaus = toManausDate(hoje);

        return (
          dataManaus.getDate() === hojeManaus.getDate() &&
          dataManaus.getMonth() === hojeManaus.getMonth() &&
          dataManaus.getFullYear() === hojeManaus.getFullYear()
        );
      });

      console.log(`Encontrados ${registrosDeHoje.length} registros de hoje para desfazer`);

      if (registrosDeHoje.length === 0) {
        alert("Nenhum registro de hoje encontrado para desfazer.");
        return;
      }

      const backupResult = await createManualBackup({
        reason: `Backup automático antes de desfazer ${registrosDeHoje.length} registros do dia`,
      });

      if (!backupResult.success || !backupResult.metadata) {
        throw new Error(backupResult.error || "Falha ao criar backup de proteção antes da remoção.");
      }

      const promises = registrosDeHoje.map((record: AttendanceRecord) => deleteAttendance(record.id));
      const results = await Promise.all(promises);
      const sucessos = results.filter((result) => result.success).length;
      const erros = results.filter((result) => !result.success).length;

      setRecords((prev) => prev.filter((record) => !registrosDeHoje.some((r) => r.id === record.id)));

      setAttendanceStatus((prev) => {
        const updated = { ...prev };
        registrosDeHoje.forEach((record) => {
          delete updated[record.id];
        });
        return updated;
      });

      setJustificativas((prev) => {
        const updated = { ...prev };
        registrosDeHoje.forEach((record) => {
          delete updated[record.id];
        });
        return updated;
      });

      if (selectedRecordId && registrosDeHoje.some((record) => record.id === selectedRecordId)) {
        handleModalOpenChange(false);
      }

      if (erros === 0) {
        alert(`✅ Sucesso! Todos os ${sucessos} registros de hoje foram removidos com sucesso.\n\nBackup de proteção criado: ${backupResult.metadata.id}`);
      } else {
        alert(`⚠️ Processo concluído com alguns problemas:
• ${sucessos} registros removidos com sucesso
• ${erros} registros falharam ao ser removidos

Backup de proteção criado: ${backupResult.metadata.id}

Recarregue a página para ver o estado atualizado.`);
      }

      await fetchRecords();
    } catch (err) {
      console.error("Erro ao desfazer registros de hoje:", err);
      setError("Erro ao desfazer registros de hoje. Verifique a conexão com o Firebase.");
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = useMemo(() => {
    const normalizedTerm = normalizeSearchText(search);
    const shouldShowAbsentWithSearch = statusFilter === "Ausente" || (statusFilter === "todos" && normalizedTerm.length > 0);
    const targetDate = dateFilter || getTodayManausInputDate();
    let absentVirtualRecords: AttendanceRecord[] = [];
    let filtered: AttendanceRecord[] = [];

    if (shouldShowAbsentWithSearch) {
      // CPFs dos membros que JÁ registraram presença no dia específico
      const registeredCPFs = new Set<string>();
      records.forEach(r => {
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
      absentVirtualRecords = Array.from(allMembers.entries())
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
    }

    // 🚨 LÓGICA ESPECIAL: Se filtro "Ausente" está ativo, mostrar MEMBROS SEM registro no dia
    if (statusFilter === "Ausente") {
      filtered = absentVirtualRecords;
    } else {
      // Filtro normal
      filtered = records.filter((record) => {
        const statusAtual = attendanceStatus[record.id] || record.status || "Presente";

        // ✅ Filtro de status
        if (statusFilter !== "todos" && statusAtual !== statusFilter) {
          return false;
        }

        // ✅ Filtro de região
        if (regionFilter !== "__all__") {
          const region = record.region || "";
          if (region.toLowerCase() !== regionFilter.toLowerCase()) {
            return false;
          }
        }

        // ✅ Filtro de data
        if (dateFilter) {
          if (!record.timestamp) {
            return false;
          }
          
          const recordDate = new Date(record.timestamp);
          const filterDate = new Date(dateFilter + "T00:00:00");
          
          const recordDateStr = recordDate.toLocaleDateString("pt-BR");
          const filterDateStr = filterDate.toLocaleDateString("pt-BR");
          
          if (recordDateStr !== filterDateStr) {
            return false;
          }
        }

        if (monthFilter && !isInManausMonth(record.timestamp, monthFilter)) {
          return false;
        }

        // ✅ Busca textual
        if (!normalizedTerm) {
          return true;
        }

        const searchableFields = [
          record.fullName || "",
          record.cpf || "",
          statusAtual,
          record.region || "",
          record.churchPosition || "",
          record.pastorName || "",
          record.city || "",
          record.shift || "",
          record.reclassification || "",
          record.timestamp ? new Date(record.timestamp).toLocaleDateString("pt-BR") : "",
          record.absentReason || "",
        ];

        return searchableFields.some((field) => normalizeSearchText(field).includes(normalizedTerm));
      });

      if (statusFilter === "todos" && absentVirtualRecords.length > 0) {
        const alreadyInFiltered = new Set(filtered.map((record) => record.cpf).filter(Boolean));
        const missingFromToday = absentVirtualRecords.filter((record) => record.cpf && !alreadyInFiltered.has(record.cpf));
        filtered = [...filtered, ...missingFromToday];
      }
    }

    // Aplicar filtros adicionais (região e busca) para modo Ausente também
    if (statusFilter === "Ausente" || (statusFilter === "todos" && absentVirtualRecords.length > 0)) {
      // Filtro de região
      if (regionFilter !== "__all__") {
        filtered = filtered.filter(r => {
          const region = r.region || "";
          return region.toLowerCase() === regionFilter.toLowerCase();
        });
      }

      // Busca textual
      if (normalizedTerm) {
        filtered = filtered.filter(r => {
          const searchableFields = [
            r.fullName || "",
            r.cpf || "",
            r.region || "",
            r.churchPosition || "",
            r.pastorName || "",
          ];
          return searchableFields.some((field) => normalizeSearchText(field).includes(normalizedTerm));
        });
      }
    }

    if (statusFilter === "Ausente" && monthFilter) {
      filtered = filtered.filter((record) => isInManausMonth(record.timestamp, monthFilter));
    }

    // ✅ Ordena por timestamp (mais recente primeiro)
    return filtered.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [attendanceStatus, records, regionFilter, search, statusFilter, dateFilter, allMembers, monthFilter]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [currentPage, filteredRecords.length, itemsPerPage]);

  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [currentPage, filteredRecords, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));

  function openEditRecord(id: string) {
    const record = records.find((r) => r.id === id);
    if (!record) {
      return;
    }

    setSelectedRecordId(id);
    setEditModalFields({
      fullName: record.fullName || "",
      cpf: record.cpf || "",
      birthday: record.birthday || "",
      region: record.region || "",
      churchPosition: record.churchPosition || "",
      pastorName: record.pastorName || "",
      city: record.city || "",
      shift: record.shift || "",
      reclassification: record.reclassification || "",
      totvs: record.totvs || "",
      etda: record.etda || "",
    });
    setEditPhotoSelection(null);
    setEditPhotoPreview(record.photoUrl ?? null);
    setEditOriginalPhotoUrl(record.photoUrl ?? null);
    setEditPhotoMarkedForRemoval(false);
    setIsUploadingEditPhoto(false);
    
    // ✅ Inicializa timestamp editável no formato datetime-local (yyyy-MM-ddTHH:mm)
    if (record.timestamp) {
      const date = new Date(record.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      setEditTimestamp(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setEditTimestamp("");
    }
    
    setIsEditModalOpen(true);
  }

  function handleModalFieldChange(field: keyof AttendanceRecord, value: string) {
    setEditModalFields((prev) => ({ ...prev, [field]: value }));
  }

  function handleModalOpenChange(open: boolean) {
    setIsEditModalOpen(open);
    if (!open) {
      setSelectedRecordId(null);
      setEditModalFields({});
      setEditPhotoSelection(null);
      setEditPhotoPreview(null);
      setEditOriginalPhotoUrl(null);
      setEditPhotoMarkedForRemoval(false);
      setIsUploadingEditPhoto(false);
    }
  }

  function handlePhotoSelectionChange(selection: PhotoSelectionState) {
    if (selection) {
      setEditPhotoSelection(selection);
      setEditPhotoPreview(selection.preview ?? null);
      setEditPhotoMarkedForRemoval(false);
    } else {
      setEditPhotoSelection(null);
      setEditPhotoPreview(null);
      setEditPhotoMarkedForRemoval(Boolean(editOriginalPhotoUrl));
    }
  }

  if (!isMounted || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">
      <Card className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-top duration-500">
        <CardHeader 
          className="p-3 sm:p-6 cursor-pointer hover:bg-accent/50 hover:scale-[1.01] transition-all duration-300" 
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm sm:text-lg font-medium flex items-center gap-2">
                <span className="text-lg">{isFiltersExpanded ? "🔽" : "▶️"}</span>
                <span>Filtros de pesquisa</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                {isFiltersExpanded ? (
                  "Combine busca textual com filtros por status, data, mês e região"
                ) : (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-semibold text-foreground">{filteredRecords.length} registro(s)</span>
                    {search && <span className="bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded text-xs">🔍 "{search}"</span>}
                    {dateFilter && <span className="bg-purple-100 dark:bg-purple-900 px-2 py-0.5 rounded text-xs">📅 {new Date(dateFilter + "T00:00:00").toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' })}</span>}
                    {statusFilter !== "todos" && <span className="bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded text-xs">✅ {statusFilter}</span>}
                    {regionFilter !== "__all__" && <span className="bg-orange-100 dark:bg-orange-900 px-2 py-0.5 rounded text-xs truncate max-w-[120px]">📍 {regionFilter}</span>}
                    {monthFilter && (
                      <span className="bg-amber-100 dark:bg-amber-900 px-2 py-0.5 rounded text-xs truncate max-w-[220px]">
                        🗓️ {formatMonthFilterLabel(monthFilter)}
                      </span>
                    )}
                  </div>
                )}
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="shrink-0 text-xs sm:text-sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsFiltersExpanded(!isFiltersExpanded);
              }}
            >
              {isFiltersExpanded ? "Ocultar" : "Mostrar"}
            </Button>
          </div>
        </CardHeader>
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isFiltersExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              type="text"
              placeholder="Buscar por nome, CPF, cargo ou pastor"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Presente">Presente</SelectItem>
                <SelectItem value="Justificado">Justificado</SelectItem>
                <SelectItem value="Ausente">Ausente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter || "__all__"} onValueChange={(value) => setMonthFilter(value === "__all__" ? "" : value)}>
              <SelectTrigger>
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

          {/* ⚠️ Aviso especial para filtro "Ausente" */}
          {statusFilter === "Ausente" && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border-l-4 border-red-400 rounded">
              <p className="text-xs sm:text-sm text-red-700 dark:text-red-300">
                <strong>⚠️ Modo Ausentes:</strong> Mostrando membros que <strong>NÃO registraram presença</strong> no dia {dateFilter ? new Date(dateFilter + "T00:00:00").toLocaleDateString("pt-BR") : "de hoje"}.
                <br />
                <small>Base: {allMembers.size} membros do cadastro mestre com fallback seguro para legado.</small>
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as regiões</SelectItem>
                {availableRegions.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              placeholder="Filtrar por data"
              title="Filtrar registros por data específica"
            />
            <Button variant="destructive" onClick={handleDesfazerRegistrosDeHoje} disabled={loading} className="flex items-center justify-center gap-2">
              ⚠️ Desfazer hoje
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatusFilter("todos");
                setRegionFilter("__all__");
                setDateFilter(""); // ✅ Limpar filtro de data
                setMonthFilter("");
              }}
              className="flex items-center gap-2 text-sm"
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
        </div>
      </Card>

      <Card className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: '200ms' }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
          <div>
            <CardTitle className="text-sm sm:text-lg font-medium">
              <span className="hidden sm:inline">Presença de Cadastrados</span>
              <span className="sm:hidden">Presença</span>
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {records.length > 0 ? `${records.length} registro(s) carregado(s)` : "Nenhum registro encontrado"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {loading && <div className="text-center py-4">Carregando...</div>}
          {error && <div className="text-red-500 text-center py-4">{error}</div>}
          {!loading && !error && filteredRecords.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Nenhum registro de presença encontrado.</div>
          ) : (
            <div className="w-full">
              <div className="hidden md:block">
                <table className="w-full table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 border text-left">Nome</th>
                      <th className="p-2 border text-left">CPF</th>
                      <th className="p-2 border text-left">Região</th>
                      <th className="p-2 border text-left">Cargo</th>
                      <th className="p-2 border text-left">Pastor</th>
                      <th className="p-2 border text-left">Cidade</th>
                      <th className="p-2 border text-left">Presença</th>
                      <th className="p-2 border text-left">Data/Hora</th>
                      <th className="p-2 border text-left">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRecords.map((record, index) => (
                      <tr key={record.id} className="border-b hover:bg-blue-50 transition-colors animate-in fade-in slide-in-from-right duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                        <td className="p-2 border">
                          <div className="truncate" title={record.fullName}>
                            {record.fullName}
                          </div>
                          <div className="text-xs text-muted-foreground">Aniv.: {record.birthday || "-"}</div>
                        </td>
                        <td className="p-2 border">
                          <div className="truncate">{record.cpf}</div>
                          <div className="text-xs text-muted-foreground">Turno: {record.shift || "-"}</div>
                        </td>
                        <td className="p-2 border">
                          <div className="truncate">{record.region}</div>
                          <div className="text-xs text-muted-foreground">Reclass.: {record.reclassification || "-"}</div>
                        </td>
                        <td className="p-2 border">
                          <div className="truncate" title={record.churchPosition}>
                            {record.churchPosition}
                          </div>
                        </td>
                        <td className="p-2 border">
                          <div className="truncate" title={record.pastorName}>
                            {record.pastorName}
                          </div>
                        </td>
                        <td className="p-2 border">
                          <div className="truncate">{record.city || "-"}</div>
                        </td>
                        <td className="p-2 border">
                          <Select
                            value={attendanceStatus[record.id] || "Presente"}
                            onValueChange={(value) => handleStatusChange(record.id, value)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Presente">Presente</SelectItem>
                              <SelectItem value="Justificado">Justificado</SelectItem>
                              <SelectItem value="Ausente">Ausente</SelectItem>
                            </SelectContent>
                          </Select>
                          {(attendanceStatus[record.id] === "Justificado" || attendanceStatus[record.id] === "Ausente") && (
                            <Input
                              type="text"
                              placeholder="Motivo"
                              value={justificativas[record.id] || ""}
                              onChange={(event) => handleJustificativaChange(record.id, event.target.value)}
                              className="mt-2 h-8 text-sm"
                            />
                          )}
                        </td>
                        <td className="p-2 border text-xs">
                          {record.timestamp
                            ? `${new Date(record.timestamp).toLocaleDateString("pt-BR")} ${new Date(record.timestamp).toLocaleTimeString("pt-BR")}`
                            : "-"}
                        </td>
                        <td className="p-2 border">
                          <div className="flex flex-col gap-2">
                            <Button size="sm" onClick={() => openEditRecord(record.id)} className="h-8 text-xs">
                              ✏️ Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSubmitAttendance(record.id)}
                              disabled={loading}
                              className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                            >
                              ✅ Registrar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteRecord(record.id, record.fullName)}
                              disabled={loading}
                              className="h-8 text-xs"
                            >
                              🗑️ Excluir
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-4">
                {paginatedRecords.map((record, index) => (
                  <Card key={record.id} className="p-4 hover:shadow-lg hover:-translate-y-1 animate-in fade-in slide-in-from-bottom duration-500 transition-shadow" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">{record.fullName}</h3>
                        <p className="text-xs text-muted-foreground">CPF: {record.cpf}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => openEditRecord(record.id)} className="h-8 text-xs">
                          ✏️
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSubmitAttendance(record.id)}
                          disabled={loading}
                          className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                        >
                          ✅
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteRecord(record.id, record.fullName)}
                          disabled={loading}
                          className="h-8 text-xs"
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div><strong>Região:</strong> {record.region}</div>
                      <div><strong>Cargo:</strong> {record.churchPosition}</div>
                      <div><strong>Pastor:</strong> {record.pastorName}</div>
                      <div><strong>Cidade:</strong> {record.city || "-"}</div>
                      <div><strong>Turno:</strong> {record.shift || "-"}</div>
                      <div><strong>Reclass.:</strong> {record.reclassification || "-"}</div>
                    </div>

                    {record.timestamp && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <strong>Data/Hora:</strong> {new Date(record.timestamp).toLocaleDateString("pt-BR")} {" "}
                        {new Date(record.timestamp).toLocaleTimeString("pt-BR")}
                      </div>
                    )}

                    <div className="mt-3 space-y-2">
                      <Select
                        value={attendanceStatus[record.id] || "Presente"}
                        onValueChange={(value) => handleStatusChange(record.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Presente">Presente</SelectItem>
                          <SelectItem value="Justificado">Justificado</SelectItem>
                          <SelectItem value="Ausente">Ausente</SelectItem>
                        </SelectContent>
                      </Select>
                      {(attendanceStatus[record.id] === "Justificado" || attendanceStatus[record.id] === "Ausente") && (
                        <Input
                          type="text"
                          placeholder="Justificativa"
                          value={justificativas[record.id] || ""}
                          onChange={(event) => handleJustificativaChange(record.id, event.target.value)}
                          className="h-8 text-xs"
                        />
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-sm">
                <p className="text-muted-foreground">
                  Mostrando {Math.min(filteredRecords.length, (currentPage - 1) * itemsPerPage + 1)} a {Math.min(filteredRecords.length, currentPage * itemsPerPage)} de {filteredRecords.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span>
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRecord ? `Editar presença de ${selectedRecord.fullName}` : "Editar presença"}
            </DialogTitle>
            <DialogDescription>
              Atualize os dados cadastrais e registre a presença em um único painel.
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-fullname">Nome completo</Label>
                  <Input
                    id="edit-fullname"
                    value={editModalFields.fullName ?? ""}
                    onChange={(event) => handleModalFieldChange("fullName", event.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cpf">CPF</Label>
                  <Input
                    id="edit-cpf"
                    value={editModalFields.cpf ?? ""}
                    onChange={(event) => handleModalFieldChange("cpf", event.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-birthday">Aniversário</Label>
                  <Input
                    id="edit-birthday"
                    value={editModalFields.birthday ?? ""}
                    onChange={(event) => handleModalFieldChange("birthday", event.target.value)}
                    placeholder="dd/mm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-region">Região</Label>
                  <Input
                    id="edit-region"
                    value={editModalFields.region ?? ""}
                    onChange={(event) => handleModalFieldChange("region", event.target.value)}
                    placeholder="Região"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-church-position">Cargo na igreja</Label>
                  <Input
                    id="edit-church-position"
                    value={editModalFields.churchPosition ?? ""}
                    onChange={(event) => handleModalFieldChange("churchPosition", event.target.value)}
                    placeholder="Cargo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pastor">Pastor responsável</Label>
                  <Input
                    id="edit-pastor"
                    value={editModalFields.pastorName ?? ""}
                    onChange={(event) => handleModalFieldChange("pastorName", event.target.value)}
                    placeholder="Nome do pastor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-city">Cidade</Label>
                  <Input
                    id="edit-city"
                    value={editModalFields.city ?? ""}
                    onChange={(event) => handleModalFieldChange("city", event.target.value)}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-shift">Turno</Label>
                  <Input
                    id="edit-shift"
                    value={editModalFields.shift ?? ""}
                    onChange={(event) => handleModalFieldChange("shift", event.target.value)}
                    placeholder="Manhã, Tarde..."
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-reclassification">Reclassificação</Label>
                  <Input
                    id="edit-reclassification"
                    value={editModalFields.reclassification ?? ""}
                    onChange={(event) => handleModalFieldChange("reclassification", event.target.value)}
                    placeholder="Informações adicionais"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-totvs">TOTVS</Label>
                  <Input
                    id="edit-totvs"
                    value={editModalFields.totvs ?? ""}
                    onChange={(event) => handleModalFieldChange("totvs", event.target.value)}
                    placeholder="Digite o código TOTVS"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-etda">ETDA</Label>
                  <Input
                    id="edit-etda"
                    value={editModalFields.etda ?? ""}
                    onChange={(event) => handleModalFieldChange("etda", event.target.value)}
                    placeholder="Digite o código ETDA"
                  />
                </div>
              </div>

              <div className="space-y-2 p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20">
                <Label htmlFor="edit-timestamp" className="text-amber-700 dark:text-amber-400 font-semibold">
                  ⚠️ Data/Hora de Registro (Apenas para correções)
                </Label>
                <Input
                  id="edit-timestamp"
                  type="datetime-local"
                  value={editTimestamp}
                  onChange={(e) => setEditTimestamp(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Use este campo APENAS para corrigir registros com data/hora incorreta. 
                  Não altere a menos que seja necessário!
                </p>
              </div>

              <PhotoCaptureField
                value={editPhotoPreview}
                onChange={handlePhotoSelectionChange}
                disabled={loading || isUploadingEditPhoto}
                description="Atualize ou substitua a foto cadastrada. Limpe para remover a imagem."
              />
              {isUploadingEditPhoto && (
                <p className="text-xs text-muted-foreground">Enviando foto, aguarde...</p>
              )}

              <div className="space-y-3">
                <Label>Status da presença</Label>
                <Select
                  value={attendanceStatus[selectedRecord.id] || selectedRecord.status || "Presente"}
                  onValueChange={(value) => handleStatusChange(selectedRecord.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Presente">Presente</SelectItem>
                    <SelectItem value="Justificado">Justificado</SelectItem>
                    <SelectItem value="Ausente">Ausente</SelectItem>
                  </SelectContent>
                </Select>
                {(attendanceStatus[selectedRecord.id] === "Justificado" || attendanceStatus[selectedRecord.id] === "Ausente") && (
                  <Textarea
                    value={justificativas[selectedRecord.id] ?? selectedRecord.absentReason ?? ""}
                    onChange={(event) => handleJustificativaChange(selectedRecord.id, event.target.value)}
                    placeholder="Informe o motivo ou justificativa"
                    className="min-h-[80px]"
                  />
                )}
              </div>

              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
                <p>Última atualização: {selectedRecord.timestamp ? new Date(selectedRecord.timestamp).toLocaleString("pt-BR") : "Não registrada"}</p>
                <p>Registro criado em: {selectedRecord.createdAt ? new Date(selectedRecord.createdAt).toLocaleString("pt-BR") : "Não informado"}</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button size="sm" onClick={() => handleSaveRecord(selectedRecord.id)} disabled={loading || isUploadingEditPhoto}>
                  {loading ? "Salvando..." : "Salvar alterações"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSubmitAttendance(selectedRecord.id)}
                  disabled={loading || isUploadingEditPhoto}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? "Registrando..." : "Registrar presença"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleModalOpenChange(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
