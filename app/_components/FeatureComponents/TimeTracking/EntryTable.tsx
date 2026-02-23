"use client";

import { useState, useEffect } from "react";
import { Checklist, ProjectTimeEntry } from "@/app/_types";
import {
  deleteTimeEntry,
  deleteCategoryEntry,
} from "@/app/_server/actions/time-entries";
import { exportEntriesToCsv } from "./exportCsv";

type FilterRange = "week" | "month" | "all";

interface EntryTableProps {
  entries: ProjectTimeEntry[];
  /** Used as the CSV export filename */
  exportTitle: string;
  hourlyRate?: number;
  currency?: string;
  onDelete: (entryId: string) => void;
  onFilteredChange?: (entries: ProjectTimeEntry[]) => void;
  /** When provided, shows a Project/Category column resolving taskId → title */
  tasks?: Checklist[];
}

function formatDuration(durationMin: number): string {
  const h = Math.floor(durationMin / 60);
  const m = durationMin % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}h`;
  return `${m}min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function isInRange(iso: string, range: FilterRange): boolean {
  if (range === "all") return true;
  const date = new Date(iso);
  const now = new Date();
  if (range === "week") {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return date >= weekStart;
  }
  if (range === "month") {
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }
  return true;
}

export const EntryTable = ({
  entries,
  exportTitle,
  hourlyRate,
  currency = "EUR",
  onDelete,
  onFilteredChange,
  tasks,
}: EntryTableProps) => {
  const [filter, setFilter] = useState<FilterRange>("week");

  const completedEntries = entries.filter(
    (e) => e.durationMin !== undefined && isInRange(e.start, filter),
  );

  useEffect(() => {
    onFilteredChange?.(completedEntries);
  }, [completedEntries.length, filter, entries]);

  const handleDelete = async (entry: ProjectTimeEntry) => {
    const result = entry.taskId
      ? await deleteTimeEntry(entry.taskId, entry.id)
      : await deleteCategoryEntry(entry.category ?? "", entry.id);
    if (result.success) {
      onDelete(entry.id);
    }
  };

  const showAmount = hourlyRate !== undefined && hourlyRate > 0;
  const showProjectCol = !!tasks;

  const resolveLabel = (entry: ProjectTimeEntry): string => {
    if (entry.category && !entry.taskId) return entry.category;
    if (entry.taskId && tasks) {
      const task = tasks.find(
        (t) => (t.uuid || t.id) === entry.taskId,
      );
      return task?.title ?? entry.taskId;
    }
    return "";
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Time Entries
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              exportEntriesToCsv(
                entries.filter((e) => e.durationMin !== undefined),
                exportTitle,
                hourlyRate,
                currency,
              )
            }
            disabled={
              entries.filter((e) => e.durationMin !== undefined).length === 0
            }
            className="px-2 py-0.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            title="Export CSV"
          >
            ↓ CSV
          </button>
          <div className="flex gap-1">
            {(["week", "month", "all"] as FilterRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setFilter(r)}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  filter === r
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "week"
                  ? "This Week"
                  : r === "month"
                    ? "This Month"
                    : "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {completedEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No completed entries in this period.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Date</th>
                {showProjectCol && (
                  <th className="px-3 py-2 text-left font-medium">Project</th>
                )}
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Duration</th>
                {showAmount && (
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                )}
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {completedEntries.map((entry) => {
                const amount = showAmount
                  ? (entry.durationMin! / 60) * hourlyRate!
                  : null;
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(entry.start)}
                    </td>
                    {showProjectCol && (
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-xs">
                        {resolveLabel(entry)}
                      </td>
                    )}
                    <td className="px-3 py-2">{entry.description}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatDuration(entry.durationMin!)}
                    </td>
                    {showAmount && (
                      <td className="px-3 py-2 text-right font-mono">
                        {amount!.toFixed(2)} {currency}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDelete(entry)}
                        className="text-muted-foreground hover:text-destructive transition-colors text-xs"
                        title="Delete entry"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
