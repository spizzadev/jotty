"use client";

import { useState, useEffect, useRef } from "react";
import { ProjectTimeEntry } from "@/app/_types";
import {
  startTimeEntry,
  stopTimeEntry,
  updateTimeEntry,
} from "@/app/_server/actions/time-entries";
import { Button } from "@/app/_components/GlobalComponents/Buttons/Button";

interface TimerControlProps {
  taskId: string;
  runningEntry: ProjectTimeEntry | undefined;
  onStart: (entry: ProjectTimeEntry) => void;
  onStop: (entry: ProjectTimeEntry) => void;
  onUpdate?: (entry: ProjectTimeEntry) => void;
}

function formatElapsed(startIso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(startIso).getTime());
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export const TimerControl = ({
  taskId,
  runningEntry,
  onStart,
  onStop,
  onUpdate,
}: TimerControlProps) => {
  const [description, setDescription] = useState("");
  const [elapsed, setElapsed] = useState("00:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [editDesc, setEditDesc] = useState("");
  const [editStart, setEditStart] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (runningEntry) {
      setElapsed(formatElapsed(runningEntry.start));
      setEditDesc(runningEntry.description ?? "");
      setEditStart(toDateTimeLocal(runningEntry.start));
      intervalRef.current = setInterval(() => {
        setElapsed(formatElapsed(runningEntry.start));
      }, 1000);
    } else {
      setElapsed("00:00");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runningEntry]);

  const handleStart = async () => {
    setError(null);
    setLoading(true);
    const result = await startTimeEntry(taskId, description.trim());
    setLoading(false);
    if (result.success && result.data) {
      onStart(result.data);
      setDescription("");
    } else {
      setError(result.error ?? "Failed to start timer");
    }
  };

  const handleStop = async () => {
    if (!runningEntry) return;
    setLoading(true);
    const result = await stopTimeEntry(runningEntry.taskId ?? taskId, runningEntry.id);
    setLoading(false);
    if (result.success && result.data) {
      onStop(result.data);
    } else {
      setError(result.error ?? "Failed to stop timer");
    }
  };

  const handleUpdateRunning = async () => {
    if (!runningEntry || !onUpdate) return;
    const currentDesc = editDesc;
    const currentStart = editStart;
    setSaving(true);
    const startIso = new Date(currentStart).toISOString();
    if (isNaN(new Date(currentStart).getTime())) {
      setError("Invalid start time");
      setSaving(false);
      return;
    }
    const result = await updateTimeEntry(runningEntry.taskId ?? taskId, runningEntry.id, {
      description: currentDesc,
      start: startIso,
    });
    setSaving(false);
    if (result.success && result.data) {
      setError(null);
      onUpdate(result.data);
    } else {
      setError(result.error ?? "Failed to save");
    }
  };

  const isDirty = runningEntry && (
    editDesc !== (runningEntry.description ?? "") ||
    editStart !== toDateTimeLocal(runningEntry.start)
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        {runningEntry ? (
          <>
            <Button
              onClick={handleStop}
              disabled={loading}
              variant="destructive"
              size="sm"
              className="min-w-[80px] shrink-0"
            >
              ■ Stop
            </Button>
            <span className="font-mono text-lg font-semibold tabular-nums text-primary shrink-0">
              {elapsed}
            </span>
            <input
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUpdateRunning()}
              onBlur={() => { if (isDirty) handleUpdateRunning(); }}
              placeholder="What are you working on?"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-0"
            />
            {onUpdate && isDirty && (
              <Button
                onClick={handleUpdateRunning}
                disabled={saving}
                size="sm"
                variant="outline"
                className="shrink-0"
              >
                {saving ? "…" : "✓"}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              onClick={handleStart}
              disabled={loading}
              variant="default"
              size="sm"
              className="min-w-[80px]"
            >
              ▶ Start
            </Button>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="What are you working on?"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </>
        )}
      </div>
      {runningEntry && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">Start:</span>
          <input
            type="datetime-local"
            value={editStart}
            onChange={(e) => setEditStart(e.target.value)}
            onBlur={() => { if (isDirty) handleUpdateRunning(); }}
            className="rounded border border-border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
