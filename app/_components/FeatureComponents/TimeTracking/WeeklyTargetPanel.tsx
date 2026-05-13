"use client";

import { useState, useEffect, useRef } from "react";
import { ProjectTimeEntry } from "@/app/_types";
import { PreferredDateFormat } from "@/app/_types";
import { BillingSettings } from "@/app/_server/actions/time-entries";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { useAppMode } from "@/app/_providers/AppModeProvider";

interface TrackingSettingsPanelProps {
  billing: BillingSettings | undefined;
  entries: ProjectTimeEntry[];
  onSave: (settings: BillingSettings) => Promise<void>;
}

const CURRENCIES = ["EUR", "CHF", "USD", "GBP"];

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
  const parts = text.trim().split(/[./\-]/);
  if (parts.length !== 3) return null;
  let y: number, mo: number, d: number;
  if (fmt === "mm/dd/yyyy") [mo, d, y] = parts.map(Number);
  else if (fmt === "yyyy/mm/dd") [y, mo, d] = parts.map(Number);
  else [d, mo, y] = parts.map(Number);
  if ([y, mo, d].some(isNaN)) return null;
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function findActiveWeek(
  entries: ProjectTimeEntry[],
  targetHours: number,
  startDateStr: string,
  vacationHoursPerYear: number,
): { weekStart: Date; weekDoneMin: number; effectiveWeeklyMin: number } {
  const startDate = new Date(startDateStr + "T00:00:00");
  const currentWeekStart = getISOWeekStart(new Date());

  // FIFO fill-up: all hours since startDate advance the pointer regardless of when logged
  const totalDoneMin = entries
    .filter((e) => e.durationMin && new Date(e.start) >= startDate)
    .reduce((s, e) => s + e.durationMin!, 0);

  // Effective weekly target after spreading vacation across all weeks
  const effectiveWeeklyMin = Math.max(
    Math.round(((targetHours * 52 - vacationHoursPerYear) / 52) * 60),
    1,
  );

  const weeksCompleted = Math.floor(totalDoneMin / effectiveWeeklyMin);
  const weekDoneMin = totalDoneMin - weeksCompleted * effectiveWeeklyMin;

  const startWeek = getISOWeekStart(startDate);
  let weekStart = new Date(startWeek.getTime() + weeksCompleted * 7 * 24 * 60 * 60 * 1000);
  if (weekStart > currentWeekStart) weekStart = currentWeekStart;

  return { weekStart, weekDoneMin, effectiveWeeklyMin };
}

function computeProgress(
  entries: ProjectTimeEntry[],
  targetHours: number,
  startDateStr: string,
  vacationHoursPerYear: number,
) {
  const startDate = new Date(startDateStr + "T00:00:00");
  const now = new Date();
  if (isNaN(startDate.getTime()) || now < startDate) return null;

  const { weekStart: thisWeekStart, weekDoneMin: thisWeekMin, effectiveWeeklyMin } = findActiveWeek(entries, targetHours, startDateStr, vacationHoursPerYear);

  // Hard Jan 1 boundary so Dec 29-31 entries stay in last year
  const yearStart = new Date(now.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const periodStart = startDate > yearStart ? startDate : yearStart;

  const totalDoneMin = entries
    .filter((e) => e.durationMin && new Date(e.start) >= periodStart)
    .reduce((s, e) => s + e.durationMin!, 0);

  const daysElapsed = (now.getTime() - periodStart.getTime()) / 86400000;
  const vacationDeductionMin = Math.round((daysElapsed / 365) * vacationHoursPerYear * 60);
  const thisYearExpected = Math.max(0, Math.round((daysElapsed / 7) * targetHours * 60) - vacationDeductionMin);

  let carryOverMin = 0;
  if (startDate < yearStart) {
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    lastYearStart.setHours(0, 0, 0, 0);
    const lyEffStart = startDate > lastYearStart ? startDate : lastYearStart;
    const lyDone = entries
      .filter((e) => e.durationMin && new Date(e.start) >= lyEffStart && new Date(e.start) < yearStart)
      .reduce((s, e) => s + e.durationMin!, 0);
    const lyDays = (yearStart.getTime() - lyEffStart.getTime()) / 86400000;
    const lyVacationDeduction = Math.round((lyDays / 365) * vacationHoursPerYear * 60);
    const lyExpected = Math.max(0, Math.round((lyDays / 7) * targetHours * 60) - lyVacationDeduction);
    carryOverMin = lyExpected - lyDone;
  }

  const totalExpectedMin = thisYearExpected + carryOverMin;

  return {
    kw: weekLabel(thisWeekStart),
    thisWeekMin,
    thisWeekTargetMin: effectiveWeeklyMin,
    thisWeekPct: Math.min(100, Math.round((thisWeekMin / effectiveWeeklyMin) * 100)),
    totalDoneMin,
    totalExpectedMin,
    deltaMin: totalDoneMin - totalExpectedMin,
    overallYear: now.getFullYear(),
    carryOverMin,
  };
}

export const TrackingSettingsPanel = ({ billing, entries, onSave }: TrackingSettingsPanelProps) => {
  const { user } = useAppMode();
  const fmt: PreferredDateFormat = (user?.preferredDateFormat as PreferredDateFormat) ?? "dd/mm/yyyy";
  const placeholder = fmt === "mm/dd/yyyy" ? "MM/DD/YYYY" : fmt === "yyyy/mm/dd" ? "YYYY/MM/DD" : "DD/MM/YYYY";

  const [expanded, setExpanded] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(billing?.hourlyRate?.toString() ?? "");
  const [currency, setCurrency] = useState(billing?.currency ?? "EUR");
  const [targetHours, setTargetHours] = useState(billing?.weeklyTargetHours?.toString() ?? "");
  const [vacationHours, setVacationHours] = useState(billing?.vacationHoursPerYear?.toString() ?? "");
  const [dateText, setDateText] = useState(() => formatDateOnly(billing?.weeklyTargetStartDate ?? "", fmt));
  const [isoDate, setIsoDate] = useState(billing?.weeklyTargetStartDate ?? "");
  const [saving, setSaving] = useState(false);
  const lastIsoRef = useRef(billing?.weeklyTargetStartDate ?? "");

  useEffect(() => {
    setHourlyRate(billing?.hourlyRate?.toString() ?? "");
    setCurrency(billing?.currency ?? "EUR");
    setTargetHours(billing?.weeklyTargetHours?.toString() ?? "");
    setVacationHours(billing?.vacationHoursPerYear?.toString() ?? "");
    const newIso = billing?.weeklyTargetStartDate ?? "";
    setIsoDate(newIso);
    lastIsoRef.current = newIso;
    setDateText(formatDateOnly(newIso, fmt));
  }, [billing?.hourlyRate, billing?.currency, billing?.weeklyTargetHours, billing?.weeklyTargetStartDate, billing?.vacationHoursPerYear]);

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
    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate < 0) return;
    const hours = parseFloat(targetHours);
    const vacation = parseFloat(vacationHours) || 0;
    const hasTarget = hours > 0 && !!isoDate;
    setSaving(true);
    await onSave({
      hourlyRate: rate,
      currency,
      ...(hasTarget ? { weeklyTargetHours: hours, weeklyTargetStartDate: isoDate, vacationHoursPerYear: vacation } : {}),
    });
    setSaving(false);
    setExpanded(false);
  };

  const isConfigured = !!(billing?.weeklyTargetHours && billing?.weeklyTargetStartDate);
  const progress = isConfigured
    ? computeProgress(entries, billing!.weeklyTargetHours!, billing!.weeklyTargetStartDate!, billing?.vacationHoursPerYear ?? 0)
    : null;

  const summaryLine = [
    billing?.hourlyRate ? `${billing.hourlyRate} ${billing.currency ?? "EUR"}/h` : null,
    billing?.weeklyTargetHours ? `${billing.weeklyTargetHours}h/week` : null,
    billing?.vacationHoursPerYear ? `${billing.vacationHoursPerYear}h vacation` : null,
  ].filter(Boolean).join(" · ") || "Not configured";

  const inputClass =
    "rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full";

  return (
    <div className="flex flex-col gap-2">
      {/* Always-visible stats — shown when target is configured */}
      {isConfigured && progress && (
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
            <p className="text-xs text-muted-foreground">{progress.overallYear}</p>
            <p
              className={`text-base font-semibold leading-tight ${
                progress.deltaMin >= 0 ? "text-green-500" : "text-destructive"
              }`}
            >
              {progress.deltaMin >= 0 ? `+${formatH(progress.deltaMin)}` : `${formatH(Math.abs(progress.deltaMin))} behind`}
            </p>
            <div className="border-t border-border/30 pt-1 space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {formatH(progress.totalDoneMin)} done
              </p>
              <p className="text-xs text-muted-foreground">
                {formatH(progress.totalExpectedMin - progress.carryOverMin)} exp. {progress.overallYear}
              </p>
              {progress.carryOverMin !== 0 && (
                <p className="text-xs text-muted-foreground/60">
                  {progress.carryOverMin > 0 ? "+" : "−"}{formatH(Math.abs(progress.carryOverMin))} from {progress.overallYear - 1}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collapsible settings card */}
      <div className="rounded-lg border border-border bg-card">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg gap-3"
        >
          <span className="text-muted-foreground shrink-0">Tracking Settings</span>
          <span className="text-xs text-muted-foreground truncate">{summaryLine}</span>
          <span className="text-xs text-muted-foreground shrink-0">{expanded ? "▲" : "▼"}</span>
        </button>

        {expanded && (
          <div className="border-t border-border px-4 pt-3 pb-4 space-y-2">
            {/* Billing row */}
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <label className="text-xs text-muted-foreground">Hourly Rate</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="85"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <label className="text-xs text-muted-foreground">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={inputClass}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Weekly target row */}
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
              <div className="flex flex-col gap-1 w-20 shrink-0">
                <label className="text-xs text-muted-foreground">Vacation (h/y)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={vacationHours}
                  onChange={(e) => setVacationHours(e.target.value)}
                  placeholder="0"
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
                disabled={saving || hourlyRate === ""}
                size="sm"
                variant="default"
                className="shrink-0"
              >
                {saving ? "…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Backward-compat alias (only used in TimeTrackingView which is updated)
export const WeeklyTargetPanel = TrackingSettingsPanel;
