"use client";

import { useState } from "react";
import { ProjectTimeEntry } from "@/app/_types";
import { addManualEntry } from "@/app/_server/actions/time-entries";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";

interface ManualEntryFormProps {
  taskId: string;
  onAdd: (entry: ProjectTimeEntry) => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const ManualEntryForm = ({ taskId, onAdd }: ManualEntryFormProps) => {
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const h = parseInt(hours || "0", 10);
    const m = parseInt(minutes || "0", 10);
    const durationMin = h * 60 + m;

    if (durationMin <= 0) {
      setError("Please enter a duration greater than 0");
      return;
    }
    if (!date) {
      setError("Please enter a date");
      return;
    }

    setError(null);
    setSaving(true);
    const result = await addManualEntry(taskId, description.trim(), date, durationMin);
    setSaving(false);

    if (result.success && result.data) {
      onAdd(result.data);
      setDescription("");
      setHours("");
      setMinutes("");
      setDate(todayStr());
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
              <label className="text-xs text-muted-foreground">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Duration</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0h"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground shrink-0">h</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0m"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground shrink-0">m</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Description (optional)</label>
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
