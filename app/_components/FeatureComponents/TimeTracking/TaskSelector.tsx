"use client";

import { Checklist } from "@/app/_types";
import { cn } from "@/app/_utils/global-utils";

interface TaskSelectorProps {
  tasks: Checklist[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  className?: string;
}

export const TaskSelector = ({
  tasks,
  selectedTaskId,
  onSelect,
  className,
}: TaskSelectorProps) => {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Project / Task Board
      </label>
      <select
        value={selectedTaskId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="" disabled>
          Select a task board...
        </option>
        {tasks.map((task) => (
          <option key={task.uuid || task.id} value={task.uuid || task.id}>
            {task.title}
            {task.category && task.category !== "Uncategorized"
              ? ` (${task.category})`
              : ""}
          </option>
        ))}
      </select>
    </div>
  );
};
