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
import { deleteAttendance, getAttendanceRecords, updateAttendanceRecord, updateAttendanceStatus } from "@/lib/actions";
import { deleteAttendancePhoto, getStoragePathFromUrl, uploadAttendancePhoto } from "@/lib/attendance-photo";
import type { AttendanceRecord } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type PhotoSelectionState = {
  file?: File;
  dataUrl?: string | null;
  preview?: string | null;
} | null;

export default function PresencaCadastradosPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, string>>({});
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [regionFilter, setRegionFilter] = useState("__all__");
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [exportDate, setExportDate] = useState("");
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
  const [isMounted, setIsMounted] = useState(false);

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
      const data = await getAttendanceRecords();

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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, regionFilter]);

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
    const record = records.find((r) => r.id === id);
    const nomePessoa = record?.fullName || "pessoa selecionada";
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

      await updateAttendanceStatus(id, statusEscolhido, justificativa || "", currentTimestamp);

      setRecords((prev) =>
        prev.map((r) => {
          if (r.id !== id) {
            return r;
          }

          return {
            ...r,
            status: statusEscolhido,
            absentReason: justificativa || "",
            timestamp: currentTimestamp,
            lastUpdated: currentTimestamp,
          } as AttendanceRecord;
        })
      );

      setError(null);
      alert(`✅ Presença ${statusEscolhido.toLowerCase()} registrada com sucesso para ${nomePessoa}!`);
    } catch (err) {
      console.error("Erro ao registrar presença:", err);
      setError("Erro ao registrar presença.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAllAttendances() {
    try {
      setLoading(true);
      const currentTimestamp = new Date();

      const promises = records.map(async (record) => {
        const statusAtual = attendanceStatus[record.id] || record.status || "Presente";
        const justificativaAtual = justificativas[record.id] || record.absentReason || "";
        return updateAttendanceStatus(record.id, statusAtual, justificativaAtual, currentTimestamp);
      });

      await Promise.all(promises);

      setRecords((prev) =>
        prev.map((record) => {
          const statusAtual = attendanceStatus[record.id] || record.status || "Presente";
          const justificativaAtual = justificativas[record.id] || record.absentReason || "";
          return {
            ...record,
            status: statusAtual,
            absentReason: justificativaAtual,
            timestamp: currentTimestamp,
            lastUpdated: currentTimestamp,
          } as AttendanceRecord;
        })
      );

      setError(null);
      alert("Todas as presenças foram registradas com sucesso!");
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

      const updateData: Partial<AttendanceRecord> = {
        ...editModalFields,
        status: statusAtual,
        absentReason: justificativaAtual,
        timestamp: currentTimestamp,
        lastUpdated: currentTimestamp,
      };

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

      try {
        await updateAttendanceRecord(id, updateData);
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

          return {
            ...record,
            ...updateData,
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

  async function handleExport() {
    setLoading(true);
    try {
      const data = await getAttendanceRecords();
      console.log(`Exportando ${data.length} registros do Firebase`);

      const headers = [
        "Nome Completo",
        "CPF",
        "Aniversário",
        "Região",
        "Cargo na Igreja",
        "Nome do Pastor",
        "Status",
        "Justificativa",
        "Data/Hora",
      ];

      const csvContent = [
        headers.join(","),
        ...data.map((record) => {
          const values = [
            `"${record.fullName || ""}"`,
            `"${record.cpf || ""}"`,
            `"${record.birthday || ""}"`,
            `"${record.region || ""}"`,
            `"${record.churchPosition || ""}"`,
            `"${record.pastorName || ""}"`,
            `"${record.status || "Presente"}"`,
            `"${record.absentReason || ""}"`,
            record.timestamp
              ? `${new Date(record.timestamp).toLocaleDateString("pt-BR")} ${new Date(record.timestamp).toLocaleTimeString("pt-BR")}`
              : "",
          ];

          return values.join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `relatorio-presenca-completo-${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`Relatório exportado com sucesso! ${data.length} registros incluídos.`);
    } catch (err) {
      console.error("Erro na exportação:", err);
      setError("Erro ao exportar relatório. Verifique a conexão com o Firebase.");
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
        alert(`✅ Sucesso! Todos os ${sucessos} registros de hoje foram removidos com sucesso.`);
      } else {
        alert(`⚠️ Processo concluído com alguns problemas:
• ${sucessos} registros removidos com sucesso
• ${erros} registros falharam ao ser removidos

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

  async function handleExportPorData() {
    if (!exportDate) {
      alert("Por favor, selecione uma data para exportar o relatório.");
      return;
    }

    setLoading(true);
    try {
      const data = await getAttendanceRecords();
      const dataEscolhida = new Date(`${exportDate}T00:00:00`);

      const registrosDaData = data.filter((record: AttendanceRecord) => {
        if (!record.timestamp) {
          return false;
        }

        const dataRegistro = toManausDate(new Date(record.timestamp));
        const dataEscolhidaManaus = toManausDate(dataEscolhida);

        return (
          dataRegistro.getDate() === dataEscolhidaManaus.getDate() &&
          dataRegistro.getMonth() === dataEscolhidaManaus.getMonth() &&
          dataRegistro.getFullYear() === dataEscolhidaManaus.getFullYear()
        );
      });

      if (registrosDaData.length === 0) {
        alert(`Nenhum registro encontrado para a data ${new Date(exportDate).toLocaleDateString("pt-BR")}.`);
        return;
      }

      const headers = [
        "Nome Completo",
        "CPF",
        "Aniversário",
        "Região",
        "Cargo na Igreja",
        "Nome do Pastor",
        "Status",
        "Justificativa",
        "Data/Hora",
      ];

      const csvContent = [
        headers.join(","),
        ...registrosDaData.map((record: AttendanceRecord) => {
          const dataRegistro = record.timestamp ? toManausDate(new Date(record.timestamp)) : null;
          const dataFormatada = dataRegistro
            ? `${dataRegistro.toLocaleDateString("pt-BR")} ${dataRegistro.toLocaleTimeString("pt-BR")}`
            : "";

          const values = [
            `"${record.fullName || ""}"`,
            `"${record.cpf || ""}"`,
            `"${record.birthday || ""}"`,
            `"${record.region || ""}"`,
            `"${record.churchPosition || ""}"`,
            `"${record.pastorName || ""}"`,
            `"${record.status || "Presente"}"`,
            `"${record.absentReason || ""}"`,
            dataFormatada,
          ];

          return values.join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const dataFormatada = exportDate.split("-").reverse().join("-");
      link.href = url;
      link.download = `relatorio-presenca-${dataFormatada}.csv`;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(
        `Relatório da data ${new Date(exportDate).toLocaleDateString("pt-BR")} exportado com sucesso! ${registrosDaData.length} registros incluídos.`
      );
    } catch (err) {
      console.error("Erro na exportação por data:", err);
      setError("Erro ao exportar relatório por data. Verifique a conexão com o Firebase.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportDiario() {
    setLoading(true);
    try {
      const data = await getAttendanceRecords();
      console.log(`Buscando registros diários de ${data.length} registros totais`);

      const hoje = new Date();
      const registrosDiarios = data.filter((record: AttendanceRecord) => {
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

      console.log(`Encontrados ${registrosDiarios.length} registros para hoje`);

      const headers = [
        "Nome Completo",
        "CPF",
        "Aniversário",
        "Região",
        "Cargo na Igreja",
        "Nome do Pastor",
        "Status",
        "Justificativa",
        "Data/Hora",
      ];

      const csvContent = [
        headers.join(","),
        ...registrosDiarios.map((record: AttendanceRecord) => {
          const dataRegistro = record.timestamp ? toManausDate(new Date(record.timestamp)) : null;
          const dataFormatada = dataRegistro
            ? `${dataRegistro.toLocaleDateString("pt-BR")} ${dataRegistro.toLocaleTimeString("pt-BR")}`
            : "";

          const values = [
            `"${record.fullName || ""}"`,
            `"${record.cpf || ""}"`,
            `"${record.birthday || ""}"`,
            `"${record.region || ""}"`,
            `"${record.churchPosition || ""}"`,
            `"${record.pastorName || ""}"`,
            `"${record.status || "Presente"}"`,
            `"${record.absentReason || ""}"`,
            dataFormatada,
          ];

          return values.join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const hojeManaus = toManausDate(hoje);
      const ano = hojeManaus.getFullYear();
      const mes = (hojeManaus.getMonth() + 1).toString().padStart(2, "0");
      const dia = hojeManaus.getDate().toString().padStart(2, "0");
      link.setAttribute("download", `relatorio-presenca-diario-${ano}-${mes}-${dia}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`Relatório diário exportado com sucesso! ${registrosDiarios.length} registros de hoje incluídos.`);
    } catch (err) {
      console.error("Erro na exportação diária:", err);
      setError("Erro ao exportar relatório diário. Verifique a conexão com o Firebase.");
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const statusAtual = attendanceStatus[record.id] || record.status || "Presente";

      if (statusFilter !== "todos" && statusAtual !== statusFilter) {
        return false;
      }

      if (regionFilter !== "__all__") {
        const region = record.region || "";
        if (region.toLowerCase() !== regionFilter.toLowerCase()) {
          return false;
        }
      }

      const term = search.trim().toLowerCase();
      if (!term) {
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

      return searchableFields.some((field) => field.toLowerCase().includes(term));
    });
  }, [attendanceStatus, records, regionFilter, search, statusFilter]);

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
    });
    setEditPhotoSelection(null);
    setEditPhotoPreview(record.photoUrl ?? null);
    setEditOriginalPhotoUrl(record.photoUrl ?? null);
    setEditPhotoMarkedForRemoval(false);
    setIsUploadingEditPhoto(false);
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
      <Card className="w-full max-w-6xl mx-auto">
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-sm sm:text-lg font-medium">Filtros de pesquisa</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Combine busca textual com filtros por status e região para localizar registros rapidamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
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
          </div>
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
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={exportDate}
                onChange={(event) => setExportDate(event.target.value)}
                className="flex-1"
                placeholder="Data para exportar"
              />
              <Button onClick={handleExportPorData} disabled={loading || !exportDate} className="whitespace-nowrap">
                📋 Exportar data
              </Button>
            </div>
            <Button onClick={handleExportDiario} disabled={loading} className="flex items-center justify-center gap-2">
              📅 Exportar hoje
            </Button>
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
                setExportDate("");
              }}
              className="flex items-center gap-2 text-sm"
            >
              Limpar filtros
            </Button>
            <Button onClick={handleExport} variant="secondary" disabled={loading} className="flex items-center gap-2 text-sm">
              Exportar CSV completo
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {search && <span>🔍 Buscando por "{search}". </span>}
            <span>
              {filteredRecords.length} registro(s) após filtros — {records.length} registro(s) totais carregados.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-6xl mx-auto">
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
                    {paginatedRecords.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-gray-50/50 transition-colors">
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
                {paginatedRecords.map((record) => (
                  <Card key={record.id} className="p-4">
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