"use client";

import { useState, useEffect, useRef } from "react";
import { ProjectTimeEntry } from "@/app/_types";
import { PreferredDateFormat } from "@/app/_types";
import { BillingSettings } from "@/app/_server/actions/time-entries";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { useAppMode } from "@/app/_providers/AppModeProvider";

interface WeeklyTargetPanelProps {
  billing: BillingSettings | undefined;
  entries: ProjectTimeEntry[];
  onSave: (target: { weeklyTargetHours: number; weeklyTargetStartDate: string }) => Promise<void>;
}

function formatH(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
    year: d.getUTCFullYear(),
  };
}

function weekLabel(date: Date): string {
  const { week, year } = getISOWeek(date);
  const currentYear = new Date().getFullYear();
  return year === currentYear ? `KW ${week}` : `KW ${week} ${year}`;
}

function formatDateOnly(iso: string, fmt: PreferredDateFormat): string {
  if (!iso) return "";
  const [y, mo, d] = iso.split("-");
  if (!y || !mo || !d) return "";
  if (fmt === "mm/dd/yyyy") return `${mo}/${d}/${y}`;
  if (fmt === "yyyy/mm/dd") return `${y}/${mo}/${d}`;
  return `${d}/${mo}/${y}`;
}

function parseDateOnly(text: string, fmt: PreferredDateFormat): string | null {
  const parts = text.trim().split(/[.\/\-]/);
  if (parts.length !== 3) return null;
  let y: number, mo: number, d: number;
  if (fmt === "mm/dd/yyyy") [mo, d, y] = parts.map(Number);
  else if (fmt === "yyyy/mm/dd") [y, mo, d] = parts.map(Number);
  else [d, mo, y] = parts.map(Number);
  if ([y, mo, d].some(isNaN)) return null;
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function computeProgress(entries: ProjectTimeEntry[], targetHours: number, startDateStr: string) {
  const startDate = new Date(startDateStr + "T00:00:00");
  const now = new Date();
  if (isNaN(startDate.getTime()) || now < startDate) return null;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.floor((now.getTime() - startDate.getTime()) / msPerWeek);
  const currentWeekStart = new Date(startDate.getTime() + weeksElapsed * msPerWeek);
  const currentWeekEnd = new Date(currentWeekStart.getTime() + msPerWeek);

  const thisWeekMin = entries
    .filter((e) => e.durationMin && new Date(e.start) >= currentWeekStart && new Date(e.start) < currentWeekEnd)
    .reduce((s, e) => s + e.durationMin!, 0);

  const totalDoneMin = entries
    .filter((e) => e.durationMin && new Date(e.start) >= startDate)
    .reduce((s, e) => s + e.durationMin!, 0);

  const daysElapsed = Math.min(7, Math.floor((now.getTime() - currentWeekStart.getTime()) / 86400000) + 1);
  const thisWeekExpectedMin = Math.round((daysElapsed / 7) * targetHours * 60);
  const totalExpectedMin = weeksElapsed * targetHours * 60 + thisWeekExpectedMin;

  return {
    kw: weekLabel(currentWeekStart),
    thisWeekMin,
    thisWeekTargetMin: targetHours * 60,
    thisWeekPct: Math.min(100, Math.round((thisWeekMin / (targetHours * 60)) * 100)),
    totalDoneMin,
    totalExpectedMin,
    deltaMin: totalDoneMin - totalExpectedMin,
  };
}

export const WeeklyTargetPanel = ({ billing, entries, onSave }: WeeklyTargetPanelProps) => {
  const { user } = useAppMode();
  const fmt: PreferredDateFormat = (user?.preferredDateFormat as PreferredDateFormat) ?? "dd/mm/yyyy";
  const placeholder = fmt === "mm/dd/yyyy" ? "MM/DD/YYYY" : fmt === "yyyy/mm/dd" ? "YYYY/MM/DD" : "DD/MM/YYYY";

  const [expanded, setExpanded] = useState(false);
  const [targetHours, setTargetHours] = useState(billing?.weeklyTargetHours?.toString() ?? "");
  const [dateText, setDateText] = useState(() => formatDateOnly(billing?.weeklyTargetStartDate ?? "", fmt));
  const [isoDate, setIsoDate] = useState(billing?.weeklyTargetStartDate ?? "");
  const [saving, setSaving] = useState(false);
  const lastIsoRef = useRef(billing?.weeklyTargetStartDate ?? "");

  useEffect(() => {
    setTargetHours(billing?.weeklyTargetHours?.toString() ?? "");
    const newIso = billing?.weeklyTargetStartDate ?? "";
    setIsoDate(newIso);
    lastIsoRef.current = newIso;
    setDateText(formatDateOnly(newIso, fmt));
  }, [billing?.weeklyTargetHours, billing?.weeklyTargetStartDate]);

  const handleDateChange = (text: string) => {
    setDateText(text);
    const parsed = parseDateOnly(text, fmt);
    if (parsed) {
      setIsoDate(parsed);
      lastIsoRef.current = parsed;
    }
  };

  const handleDateBlur = () => {
    if (!parseDateOnly(dateText, fmt)) {
      setDateText(formatDateOnly(lastIsoRef.current, fmt));
    }
  };

  const handleSave = async () => {
    const hours = parseFloat(targetHours);
    if (isNaN(hours) || hours <= 0 || !isoDate) return;
    setSaving(true);
    await onSave({ weeklyTargetHours: hours, weeklyTargetStartDate: isoDate });
    setSaving(false);
    setExpanded(false);
  };

  const isConfigured = !!(billing?.weeklyTargetHours && billing?.weeklyTargetStartDate);
  const progress = isConfigured
    ? computeProgress(entries, billing!.weeklyTargetHours!, billing!.weeklyTargetStartDate!)
    : null;

  const inputClass =
    "rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full";

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg gap-3"
      >
        <span className="text-muted-foreground shrink-0">Weekly Target</span>
        {isConfigured && progress ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <span className="shrink-0 font-medium text-foreground">{progress.kw}</span>
            <div className="flex items-center gap-1 min-w-0">
              <div className="w-12 bg-muted rounded-full h-1 shrink-0">
                <div
                  className="bg-primary h-1 rounded-full"
                  style={{ width: `${progress.thisWeekPct}%` }}
                />
              </div>
              <span className="truncate">
                {formatH(progress.thisWeekMin)}/{formatH(progress.thisWeekTargetMin)}
              </span>
            </div>
            <span
              className={`shrink-0 font-medium ${progress.deltaMin >= 0 ? "text-green-500" : "text-destructive"}`}
            >
              {progress.deltaMin >= 0 ? "+" : "−"}{formatH(Math.abs(progress.deltaMin))}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        <span className="text-xs text-muted-foreground shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pt-3 pb-4 space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1 w-20 shrink-0">
              <label className="text-xs text-muted-foreground">h / week</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={targetHours}
                onChange={(e) => setTargetHours(e.target.value)}
                placeholder="7"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs text-muted-foreground">Since ({placeholder})</label>
              <input
                type="text"
                value={dateText}
                onChange={(e) => handleDateChange(e.target.value)}
                onBlur={handleDateBlur}
                placeholder={placeholder}
                className={inputClass}
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !targetHours || !isoDate}
              size="sm"
              variant="default"
              className="shrink-0"
            >
              {saving ? "…" : "Save"}
            </Button>
          </div>

          {progress && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-muted/40 px-3 py-2.5 space-y-1.5">
                <p className="text-xs text-muted-foreground">{progress.kw}</p>
                <p className="text-base font-semibold leading-tight">
                  {formatH(progress.thisWeekMin)}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    / {formatH(progress.thisWeekTargetMin)}
                  </span>
                </p>
                <div className="w-full bg-muted rounded-full h-1">
                  <div
                    className="bg-primary h-1 rounded-full transition-all"
                    style={{ width: `${progress.thisWeekPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{progress.thisWeekPct}%</p>
              </div>

              <div className="rounded-md bg-muted/40 px-3 py-2.5 space-y-1.5">
                <p className="text-xs text-muted-foreground">Overall</p>
                <p
                  className={`text-base font-semibold leading-tight ${
                    progress.deltaMin >= 0 ? "text-green-500" : "text-destructive"
                  }`}
                >
                  {progress.deltaMin >= 0 ? "+" : "−"}{formatH(Math.abs(progress.deltaMin))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatH(progress.totalDoneMin)} done
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatH(progress.totalExpectedMin)} expected
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
