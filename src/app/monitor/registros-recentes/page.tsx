"use client";

import { Activity, ArrowLeft, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useRealtimeReports } from "@/hooks/use-reports";
import type { AttendanceRecord } from "@/lib/types";

const formatManausDateTime = (timestamp?: string) => {
  if (!timestamp) return "Data não informada";
  const dataOriginal = new Date(timestamp);
  const dataManaus = new Date(
    dataOriginal.toLocaleString("en-US", { timeZone: "America/Manaus" })
  );
  const dataFormatada = dataManaus.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const horaFormatada = dataManaus.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  return `${dataFormatada} • ${horaFormatada}`;
};

const formatRelativeUpdate = (lastUpdate: Date | undefined) => {
  if (!lastUpdate) return "Sem atualizações";
  const diff = Date.now() - lastUpdate.getTime();

  if (diff < 1500) return "Atualizado agora";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `Atualizado há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Atualizado há ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Atualizado há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Atualizado há ${days}d`;
};

export default function RecentRegistrationsMonitorPage() {
  const { reportData, loading, error, refreshData, lastUpdate } = useRealtimeReports({
    refreshIntervalMs: 10000
  });
  const [relativeUpdate, setRelativeUpdate] = useState<string>("Atualizando...");

  useEffect(() => {
    const updateRelativeTime = () => {
      setRelativeUpdate(formatRelativeUpdate(lastUpdate));
    };

    updateRelativeTime();
    const timer = setInterval(updateRelativeTime, 1000);
    return () => clearInterval(timer);
  }, [lastUpdate]);

  const latestRealtimeRecords = useMemo(() => {
    if (!reportData?.records) return [] as AttendanceRecord[];

    return reportData.records
      .filter((record) => Boolean(record.timestamp))
      .slice()
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 20);
  }, [reportData]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="flex flex-col gap-4 border-b border-slate-900 bg-slate-950/95 px-6 py-6 shadow-2xl shadow-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-slate-300">
            <Activity className="h-5 w-5 text-emerald-400" />
            <span className="text-sm uppercase tracking-[0.3em] text-emerald-300/80">
              Tempo real
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Registros Recentes
          </h1>
          <p className="text-sm text-slate-400">
            Painel dedicado para exibir as últimas presenças em um monitor externo. Atualização automática a cada 10 segundos.
          </p>
          <p className="text-xs font-medium text-emerald-400/80">{relativeUpdate}</p>
        </div>
        <div className="flex flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
            className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-2 text-sm">{loading ? "Atualizando..." : "Atualizar agora"}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao painel principal
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-200">
              Não foi possível carregar os registros recentes. Tente novamente em instantes.
            </div>
          )}

          {latestRealtimeRecords.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center text-lg text-slate-400">
              Nenhum registro encontrado ainda. Assim que novas presenças forem marcadas, elas aparecerão aqui automaticamente.
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-1 gap-6 pb-6">
              {latestRealtimeRecords.map((record) => {
                const status = record.status || "Presente";
                const statusConfig = {
                  Presente: {
                    icon: "✅",
                    badgeClass:
                      "border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-sm font-semibold text-emerald-300",
                    label: "Presente"
                  },
                  Justificado: {
                    icon: "📝",
                    badgeClass:
                      "border border-amber-500/40 bg-amber-500/10 px-4 py-1 text-sm font-semibold text-amber-300",
                    label: "Justificado"
                  },
                  Ausente: {
                    icon: "❌",
                    badgeClass:
                      "border border-red-500/40 bg-red-500/10 px-4 py-1 text-sm font-semibold text-red-300",
                    label: "Ausente"
                  }
                }[status as "Presente" | "Justificado" | "Ausente"] ?? {
                  icon: "✅",
                  badgeClass:
                    "border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-sm font-semibold text-emerald-300",
                  label: status
                };

                const key = record.id || `${record.cpf}-${record.timestamp}`;

                return (
                  <div
                    key={key}
                    className="relative isolate flex flex-col gap-4 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-8 shadow-[0_20px_45px_-20px_rgba(16,185,129,0.35)] backdrop-blur"
                  >
                    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_rgba(15,23,42,0.4))]" />
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/70">
                          Última presença registrada
                        </p>
                        <h2 className="text-3xl font-semibold text-white sm:text-4xl">
                          {record.fullName || "Nome não informado"}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 text-base text-slate-300">
                          <span className="font-medium text-slate-100">
                            {record.region || "Região não informada"}
                          </span>
                          {record.churchPosition && (
                            <span className="text-sm text-slate-400">
                              {record.churchPosition}
                            </span>
                          )}
                          {record.shift && (
                            <span className="text-sm text-slate-400">
                              Turno: {record.shift}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 text-right">
                        <span className="text-5xl">{statusConfig.icon}</span>
                        <span className={statusConfig.badgeClass}>{statusConfig.label}</span>
                        <span className="text-sm text-slate-400">
                          {formatManausDateTime(record.timestamp)}
                        </span>
                      </div>
                    </div>
                    {record.pastorName && (
                      <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
                        Pastor responsável: <span className="font-semibold">{record.pastorName}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
