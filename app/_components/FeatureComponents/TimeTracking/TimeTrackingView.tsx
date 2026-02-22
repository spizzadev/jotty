"use client";

import { useState, useEffect, useCallback } from "react";
import { Checklist, ProjectTimeEntry, SanitisedUser } from "@/app/_types";
import {
  getTimeEntries,
  getBillingSettings,
  saveBillingSettings,
  BillingSettings,
} from "@/app/_server/actions/time-entries";
import { TaskSelector } from "./TaskSelector";
import { TimerControl } from "./TimerControl";
import { ManualEntryForm } from "./ManualEntryForm";
import { EntryTable } from "./EntryTable";
import { SummaryRow } from "./SummaryRow";
import { BillingSettingsPanel } from "./BillingSettingsPanel";

interface TimeTrackingViewProps {
  initialTasks: Checklist[];
  user: SanitisedUser | null;
}

export const TimeTrackingView = ({ initialTasks }: TimeTrackingViewProps) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = initialTasks.find(
    (t) => (t.uuid || t.id) === selectedTaskId,
  );
  const [entries, setEntries] = useState<ProjectTimeEntry[]>([]);
  const [totalMin, setTotalMin] = useState(0);
  const [billing, setBilling] = useState<BillingSettings | undefined>(
    undefined,
  );
  const [runningEntry, setRunningEntry] = useState<
    ProjectTimeEntry | undefined
  >(undefined);
  const [loading, setLoading] = useState(false);
  const [filteredEntries, setFilteredEntries] = useState<ProjectTimeEntry[]>([]);

  const filteredMin = filteredEntries.reduce(
    (sum, e) => sum + (e.durationMin ?? 0),
    0,
  );
  const filteredAmount =
    billing?.hourlyRate && filteredMin > 0
      ? (filteredMin / 60) * billing.hourlyRate
      : undefined;

  const loadEntries = useCallback(async (taskId: string) => {
    setLoading(true);
    const result = await getTimeEntries(taskId);
    if (result.success && result.data) {
      setEntries(result.data.entries);
      setTotalMin(result.data.totalMin);
      setRunningEntry(result.data.runningEntry);
    }
    setLoading(false);
  }, []);

  const loadBilling = useCallback(async (taskId: string) => {
    const result = await getBillingSettings(taskId);
    if (result.success) {
      setBilling(result.data);
    }
  }, []);

  useEffect(() => {
    if (!selectedTaskId) return;
    loadEntries(selectedTaskId);
    loadBilling(selectedTaskId);
  }, [selectedTaskId, loadEntries, loadBilling]);

  const handleTaskSelect = (taskId: string) => {
    setSelectedTaskId(taskId);
    setEntries([]);
    setTotalMin(0);
    setFilteredEntries([]);
    setRunningEntry(undefined);
    setBilling(undefined);
  };

  const handleStart = (entry: ProjectTimeEntry) => {
    setRunningEntry(entry);
    setEntries((prev) => [...prev, entry]);
  };

  const handleStop = (stoppedEntry: ProjectTimeEntry) => {
    setRunningEntry(undefined);
    setEntries((prev) =>
      prev.map((e) => (e.id === stoppedEntry.id ? stoppedEntry : e)),
    );
    setTotalMin((prev) => prev + (stoppedEntry.durationMin ?? 0));
  };

  const handleManualAdd = (entry: ProjectTimeEntry) => {
    setEntries((prev) => [...prev, entry]);
    setTotalMin((prev) => prev + (entry.durationMin ?? 0));
  };

  const handleDelete = (entryId: string) => {
    const deleted = entries.find((e) => e.id === entryId);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (deleted?.durationMin) {
      setTotalMin((prev) => Math.max(0, prev - deleted.durationMin!));
    }
  };

  const handleBillingSave = async (settings: BillingSettings) => {
    if (!selectedTaskId) return;
    const result = await saveBillingSettings(selectedTaskId, settings);
    if (result.success) {
      setBilling(settings);
    }
  };

  return (
    <div className="w-full px-4 py-6 h-full overflow-y-auto jotty-scrollable-content">
      <div className="flex flex-col gap-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">Tracking</h1>

        <TaskSelector
          tasks={initialTasks}
          selectedTaskId={selectedTaskId}
          onSelect={handleTaskSelect}
        />

        {selectedTaskId && (
          <>
            <BillingSettingsPanel
              initialSettings={billing}
              onSave={handleBillingSave}
            />

            <TimerControl
              taskId={selectedTaskId}
              runningEntry={runningEntry}
              onStart={handleStart}
              onStop={handleStop}
            />

            <ManualEntryForm taskId={selectedTaskId} onAdd={handleManualAdd} />

            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Loading...
              </p>
            ) : (
              <>
                <EntryTable
                  taskId={selectedTaskId}
                  taskTitle={selectedTask?.title ?? "project"}
                  entries={entries}
                  hourlyRate={billing?.hourlyRate}
                  currency={billing?.currency}
                  onDelete={handleDelete}
                  onFilteredChange={setFilteredEntries}
                />

                <SummaryRow
                  totalMin={filteredMin}
                  totalAmount={filteredAmount}
                  currency={billing?.currency}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
