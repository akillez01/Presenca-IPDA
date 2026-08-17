"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SedeEstadualRecord } from "@/app/admin/sede-estadual/page";
import { Cake, Gift, Sparkles, User } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

interface Props {
  records: SedeEstadualRecord[];
}

export function SedeEstadualBirthdays({ records }: Props) {
  const currentMonth = useMemo(
    () => new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    []
  );

  const todaysBirthdays = useMemo(() => {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;

    return records.filter((record) => {
      const match = (record.formData.birthDate || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return false;
      const day = Number(match[1]);
      const month = Number(match[2]);
      return day === todayDay && month === todayMonth;
    });
  }, [records]);

  if (todaysBirthdays.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-100 flex-shrink-0">
              <Cake className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Aniversários Hoje — Sede Estadual</CardTitle>
              <CardDescription className="text-sm truncate">{currentMonth}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Gift className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">Nenhum aniversariante hoje</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-lg bg-purple-100 flex-shrink-0">
              <Cake className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg">Aniversários Hoje — Sede Estadual</CardTitle>
              <CardDescription className="text-sm truncate">{currentMonth}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-200 flex-shrink-0">
            {todaysBirthdays.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {todaysBirthdays.map((record) => (
            <div
              key={record.id}
              className="p-3 rounded-lg border-l-4 border-l-yellow-500 border border-yellow-200 bg-yellow-50 shadow-sm flex gap-3 items-start"
            >
              <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 border-2 border-purple-200 overflow-hidden flex items-center justify-center">
                {record.formData.photoDataUrl ? (
                  <Image
                    src={record.formData.photoDataUrl}
                    alt={record.fullName}
                    width={56}
                    height={56}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-7 h-7 text-purple-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate text-sm">{record.fullName}</p>
                <p className="text-xs text-gray-500">{record.formData.birthDate}</p>
                <div className="mt-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-yellow-500" />
                  <Badge className="bg-yellow-500 hover:bg-yellow-600 whitespace-nowrap text-xs">
                    🎉 Aniversariante!
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
