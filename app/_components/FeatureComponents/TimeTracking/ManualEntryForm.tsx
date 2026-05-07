"use client";

import { useState } from "react";
import { ProjectTimeEntry } from "@/app/_types";
import { addManualEntry } from "@/app/_server/actions/time-entries";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";
import { LocalizedDateTimeInput } from "./LocalizedDateTimeInput";

interface ManualEntryFormProps {
  taskId: string;
  onAdd: (entry: ProjectTimeEntry) => void;
}

function toDateTimeLocal(d: Date): string {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function defaultStart(): string {
  const d = new Date();
  d.setHours(d.getHours() - 1, 0, 0, 0);
  return toDateTimeLocal(d);
}

function defaultEnd(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return toDateTimeLocal(d);
}

export const ManualEntryForm = ({
  taskId,
  onAdd,
}: ManualEntryFormProps) => {
  const [expanded, setExpanded] = useState(false);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const durationMin = Math.round(
      (endDate.getTime() - startDate.getTime()) / 60000,
    );

    if (durationMin <= 0) {
      setError("End time must be after start time");
      return;
    }

    const dateStr = start.slice(0, 10);

    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();

    setError(null);
    setSaving(true);
    const result = await addManualEntry(
      taskId,
      description.trim(),
      dateStr,
      durationMin,
      undefined,
      startIso,
      endIso,
    );
    setSaving(false);

    if (result.success && result.data) {
      onAdd(result.data);
      setDescription("");
      setStart(defaultStart());
      setEnd(defaultEnd());
      setExpanded(false);
    } else {
      setError(result.error ?? "Failed to add entry");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors rounded-lg"
      >
        <span className="text-base leading-none">+</span>
        Add Entry Manually
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 px-4 pb-4 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Start</label>
              <LocalizedDateTimeInput value={start} onChange={setStart} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">End</label>
              <LocalizedDateTimeInput value={end} onChange={setEnd} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="What did you work on?"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button
              onClick={handleAdd}
              disabled={saving}
              size="sm"
              variant="default"
            >
              {saving ? "Adding..." : "Add Entry"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
