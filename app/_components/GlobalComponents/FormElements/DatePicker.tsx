"use client";

import { useState, useRef, useEffect, memo } from "react";
import { DayPicker } from "react-day-picker";
import { Calendar03Icon } from "hugeicons-react";
import { cn } from "@/app/_utils/global-utils";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const _formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const _toDateValue = (dateStr: string): Date | undefined => {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d;
};

const DatePickerComponent = ({
  value,
  onChange,
  onBlur,
  className,
  placeholder = "Select date",
  disabled,
}: DatePickerProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const _handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    if (open) document.addEventListener("mousedown", _handleClickOutside);
    return () => document.removeEventListener("mousedown", _handleClickOutside);
  }, [open, onBlur]);

  function _handleSelect(day: Date | undefined) {
    if (!day) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    onChange(iso);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 text-sm bg-background border border-input rounded-jotty focus:outline-none focus:border-ring transition-colors text-left",
          !value && "text-muted-foreground",
          className,
        )}
      >
        <span className="truncate">{value ? _formatDateDisplay(value) : placeholder}</span>
        <Calendar03Icon className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 right-0 bg-popover border border-border rounded-jotty shadow-lg p-3 animate-in fade-in-0 zoom-in-95">
          <DayPicker
            mode="single"
            selected={_toDateValue(value)}
            onSelect={_handleSelect}
            defaultMonth={_toDateValue(value)}
            classNames={{
              root: "text-sm",
              months: "flex flex-col",
              month_caption: "flex justify-center items-center h-8",
              caption_label: "text-sm font-medium text-foreground",
              nav: "flex items-center gap-1",
              button_previous: "absolute left-1 top-3 h-7 w-7 flex items-center justify-center rounded-jotty border border-border hover:bg-muted text-foreground transition-colors",
              button_next: "absolute right-1 top-3 h-7 w-7 flex items-center justify-center rounded-jotty border border-border hover:bg-muted text-foreground transition-colors",
              weekdays: "flex",
              weekday: "w-8 text-center text-xs font-medium text-muted-foreground py-1",
              week: "flex",
              day: "w-8 h-8 text-center text-sm",
              day_button: "w-full h-full flex items-center justify-center rounded-jotty transition-colors hover:bg-muted text-foreground cursor-pointer",
              selected: "rounded-jotty",
              today: "font-bold text-primary",
              outside: "text-muted-foreground/40",
              disabled: "text-muted-foreground/30 cursor-not-allowed",
            }}
          />
        </div>
      )}
    </div>
  );
};

export const DatePicker = memo(DatePickerComponent);

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
}

const DateTimePickerComponent = ({
  value,
  onChange,
  onBlur,
  className,
  disabled,
}: DateTimePickerProps) => {
  const dateVal = value ? value.split("T")[0] || "" : "";
  const timeVal = (() => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  function _handleDateChange(newDate: string) {
    if (!newDate) {
      onChange("");
      return;
    }
    const time = timeVal || "00:00";
    onChange(`${newDate}T${time}`);
  }

  function _handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newTime = e.target.value;
    if (!dateVal) return;
    onChange(`${dateVal}T${newTime}`);
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="flex-1">
        <DatePicker
          value={dateVal}
          onChange={_handleDateChange}
          onBlur={onBlur}
          disabled={disabled}
        />
      </div>
      <input
        type="time"
        value={timeVal}
        onChange={_handleTimeChange}
        onBlur={onBlur}
        disabled={disabled || !dateVal}
        className="w-24 px-2 py-2 text-sm bg-background border border-input rounded-jotty focus:outline-none focus:border-ring transition-colors"
      />
    </div>
  );
};

export const DateTimePicker = memo(DateTimePickerComponent);
