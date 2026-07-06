"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeReports } from "@/hooks/use-reports";
import type { AttendanceRecord } from "@/lib/types";
import { Cake, Gift, Sparkles, User } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface BirthdayPerson {
  name: string;
  birthday: string; // formato YYYY-MM-DD
  daysUntilBirthday: number;
  isToday: boolean;
  monthDay: string; // formato DD/MM
  photoUrl?: string | null; // URL da foto
}

export function BirthdaysWidget() {
  const { reportData } = useRealtimeReports();
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayPerson[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string>("");

  useEffect(() => {
    const today = new Date();
    setCurrentMonth(today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));

    if (!reportData?.records) {
      setUpcomingBirthdays([]);
      return;
    }

    // Map para deduplicar por CPF (mesma pessoa pode ter vários registros de presença)
    const birthdayMap = new Map<string, BirthdayPerson>();

    reportData.records.forEach((record: AttendanceRecord) => {
      if (!record.birthday) return;

      try {
        // Parseando data no formato YYYY-MM-DD ou DD/MM/YYYY
        let month: number, day: number;

        if (record.birthday.includes("-")) {
          const [, m, d] = record.birthday.split("-");
          month = parseInt(m, 10);
          day = parseInt(d, 10);
        } else if (record.birthday.includes("/")) {
          const [d, m] = record.birthday.split("/");
          month = parseInt(m, 10);
          day = parseInt(d, 10);
        } else {
          return;
        }

        const currentDate = new Date();
        const currentMonthNum = currentDate.getMonth() + 1;
        const currentDay = currentDate.getDate();

        // Verificar se é neste mês
        if (month !== currentMonthNum) return;

        // Calcular dias até o aniversário
        const daysUntilBirthday = day - currentDay;

        // Incluir apenas aniversários de hoje
        if (daysUntilBirthday !== 0) return;

        // Deduplicar por CPF; se não houver CPF, usa nome+data como chave
        const dedupeKey = (record as any).cpf || `${record.fullName}|${record.birthday}`;

        if (!birthdayMap.has(dedupeKey)) {
          birthdayMap.set(dedupeKey, {
            name: record.fullName || "Desconhecido",
            birthday: record.birthday,
            daysUntilBirthday,
            isToday: true,
            monthDay: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
            photoUrl: record.photoUrl || null,
          });
        }
      } catch (error) {
        console.error(`Erro ao processar data de aniversário: ${record.birthday}`, error);
      }
    });

    // Filtrar apenas aniversariantes de HOJE (já garantido pelo Map)
    const todayBirthdays = Array.from(birthdayMap.values());

    // Ordenar por dias até aniversário (apenas para hoje)
    todayBirthdays.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);

    setUpcomingBirthdays(todayBirthdays);
  }, [reportData]);

  if (!upcomingBirthdays || upcomingBirthdays.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-lg transition-shadow duration-300 h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-lg bg-purple-100 flex-shrink-0">
                <Cake className="h-4 w-4 text-purple-600" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg">Aniversários Hoje</CardTitle>
                <CardDescription className="text-sm truncate">{currentMonth}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Gift className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              Nenhum aniversariante hoje
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-lg bg-purple-100 flex-shrink-0">
              <Cake className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Aniversários Hoje</CardTitle>
              <CardDescription className="text-sm truncate">{currentMonth}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-200 flex-shrink-0">
            {upcomingBirthdays.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="space-y-2 flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-200 scrollbar-track-transparent">
          {upcomingBirthdays.map((person, index) => (
            <div
              key={`${person.name}-${person.monthDay}`}
              className={`p-3 rounded-lg border-l-4 transition-all duration-300 animate-in fade-in slide-in-from-left overflow-hidden ${
                person.isToday
                  ? "bg-yellow-50 border-l-yellow-500 border border-yellow-200 shadow-md hover:shadow-lg"
                  : "bg-white border-l-purple-300 border border-purple-100 hover:border-purple-300 hover:shadow-md"
              }`}
              style={{
                animationDelay: `${index * 75}ms`,
              }}
            >
              <div className="flex gap-3 items-start">
                {/* Foto do Aniversariante */}
                <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-200 overflow-hidden flex items-center justify-center">
                  {person.photoUrl ? (
                    <Image
                      src={person.photoUrl}
                      alt={person.name}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Se a imagem não carregar, mostrar ícone
                        e.currentTarget.style.display = "none";
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          const fallback = parent.querySelector(".fallback-avatar");
                          if (fallback) {
                            fallback.classList.remove("hidden");
                          }
                        }
                      }}
                    />
                  ) : null}
                  <User className="fallback-avatar w-8 h-8 text-purple-400" />
                </div>

                {/* Informações */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <p className="font-medium text-gray-800 truncate text-sm">
                      {person.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {person.monthDay}
                    </p>
                  </div>
                  
                  {/* Badge de Status */}
                  <div className="mt-1">
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-yellow-500 animate-bounce" />
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 whitespace-nowrap text-xs animate-pulse">
                        🎉 Aniversariante! 🎉
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
