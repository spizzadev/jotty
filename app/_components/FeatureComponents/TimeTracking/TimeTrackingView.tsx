"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Checklist, ProjectTimeEntry, SanitisedUser } from "@/app/_types";
import {
  getTimeEntries,
  getAllTimeEntries,
  getEntriesForTasks,
  getBillingSettings,
  saveBillingSettings,
  updateTimeEntry,
  updateCategoryEntry,
  BillingSettings,
} from "@/app/_server/actions/time-entries";
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
  const searchParams = useSearchParams();
  const taskParam = searchParams?.get("task") ?? null;
  const categoryParam = searchParams?.get("category") ?? null;

  const selectedTask = taskParam
    ? (initialTasks.find((t) => (t.uuid || t.id) === taskParam) ?? null)
    : null;

  const [entries, setEntries] = useState<ProjectTimeEntry[]>([]);
  const [totalMin, setTotalMin] = useState(0);
  const [billing, setBilling] = useState<BillingSettings | undefined>(
    undefined,
  );
  const [runningEntry, setRunningEntry] = useState<
    ProjectTimeEntry | undefined
  >(undefined);
  const [loading, setLoading] = useState(false);
  const [filteredEntries, setFilteredEntries] = useState<ProjectTimeEntry[]>(
    [],
  );

  const filteredMin = filteredEntries.reduce(
    (sum, e) => sum + (e.durationMin ?? 0),
    0,
  );
  const filteredAmount =
    billing?.hourlyRate && filteredMin > 0
      ? (filteredMin / 60) * billing.hourlyRate
      : undefined;

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setEntries([]);
    setTotalMin(0);
    setRunningEntry(undefined);
    setBilling(undefined);
    setFilteredEntries([]);

    if (taskParam) {
      const [entriesResult, billingResult] = await Promise.all([
        getTimeEntries(taskParam),
        getBillingSettings(taskParam),
      ]);
      if (entriesResult.success && entriesResult.data) {
        setEntries(entriesResult.data.entries);
        setTotalMin(entriesResult.data.totalMin);
        setRunningEntry(entriesResult.data.runningEntry);
      }
      if (billingResult.success) {
        setBilling(billingResult.data);
      }
    } else if (categoryParam) {
      const taskIds = initialTasks
        .filter((t) => t.category === categoryParam)
        .map((t) => t.uuid || t.id);
      const billingKey = `_cat_${categoryParam}`;
      const [result, billingResult] = await Promise.all([
        getEntriesForTasks(taskIds, categoryParam),
        getBillingSettings(billingKey),
      ]);
      if (result.success && result.data) {
        setEntries(result.data.entries);
        setTotalMin(result.data.totalMin);
        setRunningEntry(result.data.runningEntry);
      }
      if (billingResult.success) {
        setBilling(billingResult.data);
      }
    } else {
      // Global view
      const result = await getAllTimeEntries();
      if (result.success && result.data) {
        setEntries(result.data.entries);
        setTotalMin(result.data.totalMin);
        setRunningEntry(result.data.runningEntry);
      }
    }

    setLoading(false);
  }, [taskParam, categoryParam]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

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
    setEntries((prev) => [entry, ...prev]);
    setTotalMin((prev) => prev + (entry.durationMin ?? 0));
  };

  const handleDelete = (entryId: string) => {
    const deleted = entries.find((e) => e.id === entryId);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (deleted?.durationMin) {
      setTotalMin((prev) => Math.max(0, prev - deleted.durationMin!));
    }
  };

  const handleUpdate = async (updated: ProjectTimeEntry) => {
    const updates = {
      description: updated.description,
      start: updated.start,
      end: updated.end,
    };
    const result = updated.taskId
      ? await updateTimeEntry(updated.taskId, updated.id, updates)
      : await updateCategoryEntry(updated.category ?? "", updated.id, updates);
    if (result.success && result.data) {
      const prev = entries.find((e) => e.id === updated.id);
      setEntries((es) =>
        es.map((e) => (e.id === updated.id ? result.data! : e)),
      );
      setTotalMin(
        (t) => t - (prev?.durationMin ?? 0) + (result.data!.durationMin ?? 0),
      );
    }
  };

  const handleBillingSave = async (settings: BillingSettings) => {
    const key = taskParam ?? (categoryParam ? `_cat_${categoryParam}` : null);
    if (!key) return;
    const result = await saveBillingSettings(key, settings);
    if (result.success) {
      setBilling(settings);
    }
  };

  // Heading
  const heading = taskParam
    ? (selectedTask?.title ?? "Task")
    : categoryParam
      ? categoryParam
      : "All Entries";

  // Is global view (no selection)
  const isGlobal = !taskParam && !categoryParam;

  // Show timer when a specific task or category is selected
  const showTimer = !isGlobal;

  // For EntryTable: show project column only in global or category view
  const showProjectCol = !taskParam;

  return (
    <div className="w-full px-4 py-6 h-full overflow-y-auto jotty-scrollable-content">
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">{heading}</h1>

        {(taskParam || categoryParam) && (
          <BillingSettingsPanel
            initialSettings={billing}
            onSave={handleBillingSave}
          />
        )}

        {showTimer && (
          <>
            <TimerControl
              taskId={taskParam ?? undefined}
              category={categoryParam ?? undefined}
              runningEntry={runningEntry}
              onStart={handleStart}
              onStop={handleStop}
            />
            <ManualEntryForm
              taskId={taskParam ?? undefined}
              category={categoryParam ?? undefined}
              onAdd={handleManualAdd}
            />
          </>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Loading...
          </p>
        ) : (
          <>
            <EntryTable
              entries={entries}
              exportTitle={heading}
              hourlyRate={billing?.hourlyRate}
              currency={billing?.currency}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onFilteredChange={setFilteredEntries}
              tasks={showProjectCol ? initialTasks : undefined}
            />
            <SummaryRow
              totalMin={filteredMin}
              totalAmount={filteredAmount}
              currency={billing?.currency}
            />
          </>
        )}
      </div>
    </div>
  );
};
