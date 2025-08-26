"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import * as React from "react"

interface DateRangePickerProps {
  onDateRangeChange: (startDate: Date | null, endDate: Date | null) => void;
  disabled?: boolean;
}

export function DateRangePicker({ onDateRangeChange, disabled = false }: DateRangePickerProps) {
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [isStartPickerOpen, setIsStartPickerOpen] = React.useState(false);
  const [isEndPickerOpen, setIsEndPickerOpen] = React.useState(false);

  const handleStartDateSelect = (date: Date | undefined) => {
    setStartDate(date);
    setIsStartPickerOpen(false);
    if (date && endDate && date <= endDate) {
      onDateRangeChange(date, endDate);
    } else if (date && !endDate) {
      // Se só a data inicial foi selecionada, definir a final como hoje
      const today = new Date();
      setEndDate(today);
      onDateRangeChange(date, today);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    setEndDate(date);
    setIsEndPickerOpen(false);
    if (startDate && date && startDate <= date) {
      onDateRangeChange(startDate, date);
    }
  };

  const clearDates = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    onDateRangeChange(null, null);
  };

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    setStartDate(start);
    setEndDate(end);
    onDateRangeChange(start, end);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="flex gap-2">
        <Popover open={isStartPickerOpen} onOpenChange={setIsStartPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[150px] justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={handleStartDateSelect}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        <Popover open={isEndPickerOpen} onOpenChange={setIsEndPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[150px] justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={handleEndDateSelect}
              initialFocus
              locale={ptBR}
              disabled={(date) => startDate ? date < startDate : false}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickRange(7)}
          disabled={disabled}
        >
          7 dias
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickRange(30)}
          disabled={disabled}
        >
          30 dias
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={clearDates}
          disabled={disabled}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}
