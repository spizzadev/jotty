"use client";

import { useState, useEffect } from "react";
import { ProjectTimeEntry } from "@/app/_types";
import { BillingSettings } from "@/app/_server/actions/time-entries";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";

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

function computeProgress(
  entries: ProjectTimeEntry[],
  targetHours: number,
  startDateStr: string,
) {
  const startDate = new Date(startDateStr + "T00:00:00");
  const now = new Date();
  if (isNaN(startDate.getTime()) || now < startDate) return null;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.floor((now.getTime() - startDate.getTime()) / msPerWeek);
  const currentWeekStart = new Date(startDate.getTime() + weeksElapsed * msPerWeek);
  const currentWeekEnd = new Date(currentWeekStart.getTime() + msPerWeek);

  const thisWeekMin = entries
    .filter(
      (e) =>
        e.durationMin &&
        new Date(e.start) >= currentWeekStart &&
        new Date(e.start) < currentWeekEnd,
    )
    .reduce((s, e) => s + e.durationMin!, 0);

  const totalDoneMin = entries
    .filter((e) => e.durationMin && new Date(e.start) >= startDate)
    .reduce((s, e) => s + e.durationMin!, 0);

  const daysInCurrentWeek = Math.min(
    7,
    Math.floor((now.getTime() - currentWeekStart.getTime()) / 86400000) + 1,
  );
  const thisWeekExpectedMin = Math.round((daysInCurrentWeek / 7) * targetHours * 60);
  const totalExpectedMin = weeksElapsed * targetHours * 60 + thisWeekExpectedMin;

  return {
    weekNumber: weeksElapsed + 1,
    thisWeekMin,
    thisWeekTargetMin: targetHours * 60,
    totalDoneMin,
    totalExpectedMin,
    deltaMin: totalDoneMin - totalExpectedMin,
  };
}

export const WeeklyTargetPanel = ({ billing, entries, onSave }: WeeklyTargetPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [targetHours, setTargetHours] = useState(
    billing?.weeklyTargetHours?.toString() ?? "",
  );
  const [startDate, setStartDate] = useState(billing?.weeklyTargetStartDate ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTargetHours(billing?.weeklyTargetHours?.toString() ?? "");
    setStartDate(billing?.weeklyTargetStartDate ?? "");
  }, [billing?.weeklyTargetHours, billing?.weeklyTargetStartDate]);

  const handleSave = async () => {
    const hours = parseFloat(targetHours);
    if (isNaN(hours) || hours <= 0 || !startDate) return;
    setSaving(true);
    await onSave({ weeklyTargetHours: hours, weeklyTargetStartDate: startDate });
    setSaving(false);
    setExpanded(false);
  };

  const isConfigured = billing?.weeklyTargetHours && billing?.weeklyTargetStartDate;
  const progress = isConfigured
    ? computeProgress(entries, billing!.weeklyTargetHours!, billing!.weeklyTargetStartDate!)
    : null;

  const collapsedLabel = isConfigured && progress
    ? `Week ${progress.weekNumber} · ${formatH(progress.thisWeekMin)} / ${formatH(progress.thisWeekTargetMin)} · ${progress.deltaMin >= 0 ? "+" : ""}${formatH(Math.abs(progress.deltaMin))} overall`
    : "Not configured";

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg"
      >
        <span className="text-muted-foreground">Weekly Target</span>
        <span className="text-xs text-muted-foreground truncate ml-2 max-w-[200px] text-right">
          {collapsedLabel} {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-muted-foreground">Hours / week</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={targetHours}
                onChange={(e) => setTargetHours(e.target.value)}
                placeholder="e.g. 7"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-muted-foreground">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !targetHours || !startDate}
              size="sm"
              variant="default"
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>

          {progress && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Week {progress.weekNumber} progress
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">This week</span>
                  <span className="font-medium">
                    {formatH(progress.thisWeekMin)} / {formatH(progress.thisWeekTargetMin)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((progress.thisWeekMin / progress.thisWeekTargetMin) * 100))}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-muted-foreground">Overall</span>
                  <span
                    className={`font-medium ${
                      progress.deltaMin >= 0 ? "text-green-500" : "text-destructive"
                    }`}
                  >
                    {progress.deltaMin >= 0 ? "+" : ""}
                    {formatH(Math.abs(progress.deltaMin))}{" "}
                    {progress.deltaMin >= 0 ? "ahead" : "behind"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatH(progress.totalDoneMin)} done</span>
                  <span>{formatH(progress.totalExpectedMin)} expected</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
