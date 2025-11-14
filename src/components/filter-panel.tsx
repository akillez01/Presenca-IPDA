"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AttendanceRecord } from "@/lib/types";
import { Calendar, RotateCcw } from "lucide-react";

export interface FilterState {
  dateFilter: string;    // Para filtrar por Data
}

export interface FilterPanelProps {
  records: AttendanceRecord[];
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  compact?: boolean;
}

export function FilterPanel({
  records,
  filters,
  onFiltersChange,
  compact = false
}: FilterPanelProps) {
  
  // Função para resetar os filtros simplificados
  const handleReset = () => {
    onFiltersChange({
      dateFilter: new Date().toISOString().split('T')[0] // Volta para hoje por padrão
    });
  };

  if (compact) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">            
            <div className="w-[200px]">
              <Input
                type="date"
                value={filters.dateFilter}
                onChange={(e) => onFiltersChange({ dateFilter: e.target.value })}
                className="text-sm"
                placeholder="Data"
              />
            </div>

            <Button variant="outline" size="sm" onClick={handleReset} className="shrink-0">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔍 Filtros Simplificados
        </CardTitle>
        <CardDescription>
          Filtre registros por Data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtro simplificado: Apenas Data */}
        <div className="max-w-md">
          <div className="space-y-2">
            <Label htmlFor="date-filter">📅 Data</Label>
            <Input
              id="date-filter"
              type="date"
              value={filters.dateFilter}
              onChange={(e) => onFiltersChange({ dateFilter: e.target.value })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              💡 Filtre registros por data específica
            </p>
          </div>

        </div>

        {/* Botões para resetar filtros */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button 
            variant="ghost" 
            onClick={() => onFiltersChange({ dateFilter: "" })} 
            className="flex items-center gap-2 text-blue-600"
          >
            <Calendar className="h-4 w-4" />
            Ver Todos os Dados
          </Button>
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}