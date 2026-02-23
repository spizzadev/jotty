"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import { Checklist } from "@/app/_types";
import { cn } from "@/app/_utils/global-utils";
import { getTimeEntrySummary } from "@/app/_server/actions/time-entries";

export const TimeTrackingSidebar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checklists } = useAppMode();

  const tasks = (checklists as Checklist[]).filter((c) => c.type === "task");
  const activeCategory = searchParams?.get("category") ?? null;
  const activeTask = searchParams?.get("task") ?? null;

  const [summary, setSummary] = useState<{
    taskIds: string[];
    categories: string[];
  } | null>(null);

  useEffect(() => {
    getTimeEntrySummary().then((result) => {
      if (result.success && result.data) setSummary(result.data);
    });
  }, []);

  const navigate = (params: { category?: string; task?: string } = {}) => {
    const url = new URLSearchParams({ mode: "time-tracking" });
    if (params.category) url.set("category", params.category);
    if (params.task) url.set("task", params.task);
    router.push(`/?${url.toString()}`);
  };

  // Group tasks by category
  const grouped = tasks.reduce<Record<string, Checklist[]>>((acc, task) => {
    const cat = task.category || "Uncategorized";
    return { ...acc, [cat]: [...(acc[cat] ?? []), task] };
  }, {});

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

  const isGlobal = !activeCategory && !activeTask;

  const hasCategoryEntries = (category: string) =>
    summary?.categories.includes(category) ?? false;

  const hasTaskEntries = (taskId: string) =>
    summary?.taskIds.includes(taskId) ?? false;

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      {/* All Entries */}
      <button
        onClick={() => navigate()}
        className={cn(
          "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
          isGlobal
            ? "bg-primary/10 text-primary font-medium"
            : "text-foreground hover:bg-muted",
        )}
      >
        All Entries
      </button>

      {tasks.length > 0 && <div className="my-1 border-t border-border" />}

      {sortedCategories.map((category) => {
        const isCategoryActive = activeCategory === category && !activeTask;
        return (
          <div key={category} className="flex flex-col gap-0.5">
            {/* Category row */}
            <button
              onClick={() => navigate({ category })}
              className={cn(
                "w-full text-left px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                isCategoryActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <span className="flex items-center justify-between w-full">
                <span>{category}</span>
                {hasCategoryEntries(category) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                )}
              </span>
            </button>

            {/* Tasks under category */}
            {grouped[category].map((task) => {
              const taskId = task.uuid || task.id;
              const isTaskActive = activeTask === taskId;
              return (
                <button
                  key={taskId}
                  onClick={() => navigate({ task: taskId })}
                  className={cn(
                    "w-full text-left pl-6 pr-3 py-1 rounded-md text-sm transition-colors",
                    isTaskActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="flex items-center justify-between w-full">
                    <span>{task.title}</span>
                    {hasTaskEntries(taskId) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}

      {tasks.length === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          No task boards yet
        </p>
      )}
    </div>
  );
};
