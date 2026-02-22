"use server";

import path from "path";
import { v4 as uuidv4 } from "uuid";
import { ProjectTimeEntry } from "@/app/_types";
import { TIME_ENTRIES_DIR } from "@/app/_consts/files";
import { getCurrentUser } from "@/app/_server/actions/users";
import {
  readJsonFile,
  writeJsonFile,
  ensureDir,
} from "@/app/_server/actions/file";

const BILLING_FILE = "_billing.json";

const getEntriesFilePath = (username: string, taskId: string) =>
  path.join(TIME_ENTRIES_DIR(username), `${taskId}.json`);

const getBillingFilePath = (username: string) =>
  path.join(TIME_ENTRIES_DIR(username), BILLING_FILE);

export interface BillingSettings {
  hourlyRate: number;
  currency: string;
}

export interface TimeEntrySummary {
  entries: ProjectTimeEntry[];
  totalMin: number;
  totalAmount?: number;
  runningEntry?: ProjectTimeEntry;
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user?.username) throw new Error("Not authenticated");
  return user;
}

async function readEntries(
  username: string,
  taskId: string,
): Promise<ProjectTimeEntry[]> {
  const filePath = getEntriesFilePath(username, taskId);
  const data = await readJsonFile(filePath);
  return Array.isArray(data) ? data : [];
}

async function writeEntries(
  username: string,
  taskId: string,
  entries: ProjectTimeEntry[],
): Promise<void> {
  const userDir = TIME_ENTRIES_DIR(username);
  await ensureDir(path.join(process.cwd(), userDir));
  await writeJsonFile(entries, getEntriesFilePath(username, taskId));
}

export const getTimeEntries = async (
  taskId: string,
): Promise<{ success: boolean; data?: TimeEntrySummary; error?: string }> => {
  try {
    const user = await requireUser();
    const billingData =
      (await readJsonFile(getBillingFilePath(user.username))) || {};
    const billing: BillingSettings | undefined = billingData[taskId];

    const entries = await readEntries(user.username, taskId);
    const runningEntry = entries.find((e) => !e.end);
    const completedEntries = entries.filter((e) => e.durationMin !== undefined);
    const totalMin = completedEntries.reduce(
      (sum, e) => sum + (e.durationMin ?? 0),
      0,
    );
    const totalAmount = billing
      ? (totalMin / 60) * billing.hourlyRate
      : undefined;

    return {
      success: true,
      data: { entries, totalMin, totalAmount, runningEntry },
    };
  } catch (error) {
    console.error("Error fetching time entries:", error);
    return { success: false, error: "Failed to fetch time entries" };
  }
};

export const startTimeEntry = async (
  taskId: string,
  description: string,
): Promise<{ success: boolean; data?: ProjectTimeEntry; error?: string }> => {
  try {
    const user = await requireUser();
    const entries = await readEntries(user.username, taskId);

    const running = entries.find((e) => !e.end);
    if (running) {
      return {
        success: false,
        error: "A timer is already running for this task",
      };
    }

    const newEntry: ProjectTimeEntry = {
      id: uuidv4(),
      taskId,
      description,
      start: new Date().toISOString(),
    };

    await writeEntries(user.username, taskId, [...entries, newEntry]);
    return { success: true, data: newEntry };
  } catch (error) {
    console.error("Error starting time entry:", error);
    return { success: false, error: "Failed to start timer" };
  }
};

export const stopTimeEntry = async (
  taskId: string,
  entryId: string,
): Promise<{ success: boolean; data?: ProjectTimeEntry; error?: string }> => {
  try {
    const user = await requireUser();
    const entries = await readEntries(user.username, taskId);
    const idx = entries.findIndex((e) => e.id === entryId);

    if (idx === -1) return { success: false, error: "Entry not found" };

    const entry = entries[idx];
    if (entry.end) return { success: false, error: "Timer already stopped" };

    const endTime = new Date().toISOString();
    const durationMin = Math.round(
      (new Date(endTime).getTime() - new Date(entry.start).getTime()) / 60000,
    );

    const updated: ProjectTimeEntry = { ...entry, end: endTime, durationMin };
    const newEntries = [
      ...entries.slice(0, idx),
      updated,
      ...entries.slice(idx + 1),
    ];
    await writeEntries(user.username, taskId, newEntries);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error stopping time entry:", error);
    return { success: false, error: "Failed to stop timer" };
  }
};

export const updateTimeEntry = async (
  taskId: string,
  entryId: string,
  description: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = await requireUser();
    const entries = await readEntries(user.username, taskId);
    const idx = entries.findIndex((e) => e.id === entryId);

    if (idx === -1) return { success: false, error: "Entry not found" };

    const updated: ProjectTimeEntry = { ...entries[idx], description };
    const newEntries = [
      ...entries.slice(0, idx),
      updated,
      ...entries.slice(idx + 1),
    ];
    await writeEntries(user.username, taskId, newEntries);
    return { success: true };
  } catch (error) {
    console.error("Error updating time entry:", error);
    return { success: false, error: "Failed to update entry" };
  }
};

export const deleteTimeEntry = async (
  taskId: string,
  entryId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = await requireUser();
    const entries = await readEntries(user.username, taskId);
    const newEntries = entries.filter((e) => e.id !== entryId);
    await writeEntries(user.username, taskId, newEntries);
    return { success: true };
  } catch (error) {
    console.error("Error deleting time entry:", error);
    return { success: false, error: "Failed to delete entry" };
  }
};

export const addManualEntry = async (
  taskId: string,
  description: string,
  dateStr: string,
  durationMin: number,
): Promise<{ success: boolean; data?: ProjectTimeEntry; error?: string }> => {
  try {
    const user = await requireUser();
    if (durationMin <= 0)
      return { success: false, error: "Duration must be greater than 0" };

    const start = new Date(`${dateStr}T12:00:00Z`).toISOString();
    const end = new Date(
      new Date(start).getTime() + durationMin * 60000,
    ).toISOString();

    const newEntry: ProjectTimeEntry = {
      id: uuidv4(),
      taskId,
      description,
      start,
      end,
      durationMin,
    };

    const entries = await readEntries(user.username, taskId);
    await writeEntries(user.username, taskId, [...entries, newEntry]);
    return { success: true, data: newEntry };
  } catch (error) {
    console.error("Error adding manual entry:", error);
    return { success: false, error: "Failed to add entry" };
  }
};

export const getBillingSettings = async (
  taskId: string,
): Promise<{ success: boolean; data?: BillingSettings; error?: string }> => {
  try {
    const user = await requireUser();
    const billingData =
      (await readJsonFile(getBillingFilePath(user.username))) || {};
    return { success: true, data: billingData[taskId] };
  } catch (error) {
    return { success: false, error: "Failed to get billing settings" };
  }
};

export const saveBillingSettings = async (
  taskId: string,
  settings: BillingSettings,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = await requireUser();
    const userDir = TIME_ENTRIES_DIR(user.username);
    await ensureDir(path.join(process.cwd(), userDir));

    const billingData =
      (await readJsonFile(getBillingFilePath(user.username))) || {};
    billingData[taskId] = settings;
    await writeJsonFile(billingData, getBillingFilePath(user.username));
    return { success: true };
  } catch (error) {
    console.error("Error saving billing settings:", error);
    return { success: false, error: "Failed to save billing settings" };
  }
};
