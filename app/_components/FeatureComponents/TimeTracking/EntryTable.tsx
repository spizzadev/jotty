"use client";

import { useState, useEffect } from "react";
import { Checklist, ProjectTimeEntry } from "@/app/_types";
import { deleteTimeEntry } from "@/app/_server/actions/time-entries";
import { exportEntriesToCsv } from "./exportCsv";
import { usePreferredDateTime } from "@/app/_hooks/usePreferredDateTime";
import { LocalizedDateTimeInput } from "./LocalizedDateTimeInput";

type FilterRange = "week" | "month" | "all";

interface EditState {
  start: string;
  end: string;
  description: string;
}

interface EntryTableProps {
  entries: ProjectTimeEntry[];
  exportTitle: string;
  hourlyRate?: number;
  currency?: string;
  onDelete: (entryId: string) => void;
  onUpdate?: (entry: ProjectTimeEntry) => void;
  onFilteredChange?: (entries: ProjectTimeEntry[]) => void;
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

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
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
  onUpdate,
  onFilteredChange,
  tasks,
}: EntryTableProps) => {
  const { formatDateString } = usePreferredDateTime();
  const [filter, setFilter] = useState<FilterRange>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    start: "",
    end: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const completedEntries = entries.filter(
    (e) => e.durationMin !== undefined && isInRange(e.start, filter),
  );

  useEffect(() => {
    onFilteredChange?.(completedEntries);
  }, [completedEntries.length, filter, entries]);

  const handleDelete = async (entry: ProjectTimeEntry) => {
    if (!entry.taskId) return;
    const result = await deleteTimeEntry(entry.taskId, entry.id);
    if (result.success) {
      onDelete(entry.id);
    }
  };

  const startEdit = (entry: ProjectTimeEntry) => {
    setEditingId(entry.id);
    setEditState({
      start: toDateTimeLocal(entry.start),
      end: entry.end ? toDateTimeLocal(entry.end) : "",
      description: entry.description,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (entry: ProjectTimeEntry) => {
    if (!onUpdate) return;
    setSaving(true);
    const start = new Date(editState.start).toISOString();
    const end = editState.end
      ? new Date(editState.end).toISOString()
      : undefined;
    const durationMin = end
      ? Math.round(
          (new Date(end).getTime() - new Date(start).getTime()) / 60000,
        )
      : entry.durationMin;

    const updated: ProjectTimeEntry = {
      ...entry,
      start,
      ...(end ? { end } : {}),
      ...(durationMin !== undefined ? { durationMin } : {}),
      description: editState.description,
    };

    await onUpdate(updated);
    setSaving(false);
    setEditingId(null);
  };

  const showAmount = hourlyRate !== undefined && hourlyRate > 0;
  const showProjectCol = !!tasks;
  const colCount = 3 + (showProjectCol ? 1 : 0) + (showAmount ? 1 : 0) + 1;

  const resolveLabel = (entry: ProjectTimeEntry): string => {
    if (entry.taskId && tasks) {
      const task = tasks.find((t) => (t.uuid || t.id) === entry.taskId);
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
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {completedEntries.map((entry) => {
                const isEditing = editingId === entry.id;
                const amount = showAmount
                  ? (entry.durationMin! / 60) * hourlyRate!
                  : null;

                if (isEditing) {
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-border bg-muted/10"
                    >
                      <td colSpan={colCount} className="px-3 py-2">
                        <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-muted-foreground">
                                Start
                              </label>
                              <LocalizedDateTimeInput
                                value={editState.start}
                                onChange={(v) =>
                                  setEditState((s) => ({ ...s, start: v }))
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-muted-foreground">
                                End
                              </label>
                              <LocalizedDateTimeInput
                                value={editState.end}
                                onChange={(v) =>
                                  setEditState((s) => ({ ...s, end: v }))
                                }
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-muted-foreground">
                              Description
                            </label>
                            <input
                              type="text"
                              value={editState.description}
                              onChange={(e) =>
                                setEditState((s) => ({
                                  ...s,
                                  description: e.target.value,
                                }))
                              }
                              className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={cancelEdit}
                              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(entry)}
                              disabled={saving}
                              className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={entry.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDateString(entry.start)}
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
                      <div className="flex items-center justify-end gap-2">
                        {onUpdate && (
                          <button
                            onClick={() => startEdit(entry)}
                            className="text-muted-foreground hover:text-foreground transition-colors text-xs"
                            title="Edit entry"
                          >
                            ✎
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(entry)}
                          className="text-muted-foreground hover:text-destructive transition-colors text-xs"
                          title="Delete entry"
                        >
                          ✕
                        </button>
                      </div>
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
