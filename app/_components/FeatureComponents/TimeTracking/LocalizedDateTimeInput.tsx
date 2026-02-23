"use client";

import { useState, useEffect, useRef } from "react";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import { cn } from "@/app/_utils/global-utils";
import { PreferredDateFormat, PreferredTimeFormat } from "@/app/_types";

interface LocalizedDateTimeInputProps {
  value: string; // datetime-local format: YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  className?: string;
}

function formatDateForInput(value: string, fmt: PreferredDateFormat): string {
  if (!value) return "";
  const [datePart] = value.split("T");
  if (!datePart) return "";
  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return "";
  if (fmt === "mm/dd/yyyy") return `${month}/${day}/${year}`;
  if (fmt === "yyyy/mm/dd") return `${year}/${month}/${day}`;
  return `${day}/${month}/${year}`; // dd/mm/yyyy default
}

function formatTimeForInput(value: string, fmt: PreferredTimeFormat): string {
  if (!value) return "";
  const timePart = value.includes("T") ? value.split("T")[1] : value;
  if (!timePart) return "";
  const [hStr, mStr] = timePart.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return "";
  if (fmt === "12-hours") {
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseDateInput(
  text: string,
  fmt: PreferredDateFormat,
): { year: number; month: number; day: number } | null {
  const trimmed = text.trim();
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;
  let year: number, month: number, day: number;
  if (fmt === "mm/dd/yyyy") {
    [month, day, year] = parts.map(Number);
  } else if (fmt === "yyyy/mm/dd") {
    [year, month, day] = parts.map(Number);
  } else {
    [day, month, year] = parts.map(Number);
  }
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseTimeInput(
  text: string,
  fmt: PreferredTimeFormat,
): { h: number; m: number } | null {
  const trimmed = text.trim();
  if (fmt === "12-hours") {
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (h < 1 || h > 12 || m < 0 || m > 59) return null;
    if (period === "AM") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
    return { h, m };
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function buildDateTimeLocal(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
): string {
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export const LocalizedDateTimeInput = ({
  value,
  onChange,
  className,
}: LocalizedDateTimeInputProps) => {
  const { user } = useAppMode();
  const dateFormat: PreferredDateFormat =
    (user?.preferredDateFormat as PreferredDateFormat) ?? "dd/mm/yyyy";
  const timeFormat: PreferredTimeFormat =
    (user?.preferredTimeFormat as PreferredTimeFormat) ?? "24-hours";

  const [dateText, setDateText] = useState(() =>
    formatDateForInput(value, dateFormat),
  );
  const [timeText, setTimeText] = useState(() =>
    formatTimeForInput(value, timeFormat),
  );
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setDateText(formatDateForInput(value, dateFormat));
      setTimeText(formatTimeForInput(value, timeFormat));
      lastEmittedRef.current = value;
    }
  }, [value, dateFormat, timeFormat]);

  const tryEmit = (dText: string, tText: string) => {
    const date = parseDateInput(dText, dateFormat);
    const time = parseTimeInput(tText, timeFormat);
    if (!date || !time) return;
    const iso = buildDateTimeLocal(
      date.year,
      date.month,
      date.day,
      time.h,
      time.m,
    );
    lastEmittedRef.current = iso;
    onChange(iso);
  };

  const handleDateBlur = () => {
    if (!parseDateInput(dateText, dateFormat)) {
      setDateText(formatDateForInput(lastEmittedRef.current, dateFormat));
    }
  };

  const handleTimeBlur = () => {
    if (!parseTimeInput(timeText, timeFormat)) {
      setTimeText(formatTimeForInput(lastEmittedRef.current, timeFormat));
    }
  };

  const datePlaceholder =
    dateFormat === "mm/dd/yyyy"
      ? "MM/DD/YYYY"
      : dateFormat === "yyyy/mm/dd"
        ? "YYYY/MM/DD"
        : "DD/MM/YYYY";
  const timePlaceholder = timeFormat === "24-hours" ? "HH:MM" : "H:MM AM/PM";

  const inputClass = cn(
    "rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary",
    className,
  );

  return (
    <div className="flex gap-1">
      <input
        type="text"
        value={dateText}
        placeholder={datePlaceholder}
        onChange={(e) => {
          setDateText(e.target.value);
          tryEmit(e.target.value, timeText);
        }}
        onBlur={handleDateBlur}
        className={cn(inputClass, "flex-1 min-w-0")}
      />
      <input
        type="text"
        value={timeText}
        placeholder={timePlaceholder}
        onChange={(e) => {
          setTimeText(e.target.value);
          tryEmit(dateText, e.target.value);
        }}
        onBlur={handleTimeBlur}
        className={cn(inputClass, "w-28")}
      />
    </div>
  );
};
