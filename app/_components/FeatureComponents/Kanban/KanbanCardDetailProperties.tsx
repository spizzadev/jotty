"use client";

import { Dropdown } from "@/app/_components/GlobalComponents/Dropdowns/Dropdown";
import { UserAvatar } from "@/app/_components/GlobalComponents/User/UserAvatar";
import { DatePicker, DateTimePicker } from "@/app/_components/GlobalComponents/FormElements/DatePicker";
import { Item, KanbanPriority } from "@/app/_types";
import { KanbanPriorityLevel } from "@/app/_types/enums";
import {
  getPriorityDotColor,
  getPriorityLabel,
} from "@/app/_utils/kanban/index";
import { UserIcon } from "hugeicons-react";
import { useTranslations } from "next-intl";
import { cn } from "@/app/_utils/global-utils";

interface KanbanCardDetailPropertiesProps {
  item: Item;
  priorityInput: KanbanPriority;
  scoreInput: string;
  assigneeInput: string;
  reminderInput: string;
  targetDateInput: string;
  estimatedTimeInput: string;
  availableUsers: { username: string; avatarUrl?: string }[];
  canEdit: boolean;
  isShared: boolean;
  toLocalDateTimeValue: (iso: string) => string;
  toLocalDateValue: (iso: string) => string;
  onPriorityChange: (p: KanbanPriority) => void;
  onScoreChange: (v: string) => void;
  onScoreSave: () => void;
  onAssigneeChange: (v: string) => void;
  onReminderChange: (v: string) => void;
  onReminderSave: () => void;
  onTargetDateChange: (v: string) => void;
  onEstimatedTimeChange: (v: string) => void;
  onEstimatedTimeSave: () => void;
  formatDateTimeString: (v: string) => string;
}

export const KanbanCardDetailProperties = ({
  item,
  priorityInput,
  scoreInput,
  assigneeInput,
  reminderInput,
  targetDateInput,
  estimatedTimeInput,
  availableUsers,
  canEdit,
  isShared,
  toLocalDateTimeValue,
  toLocalDateValue,
  onPriorityChange,
  onScoreChange,
  onScoreSave,
  onAssigneeChange,
  onReminderChange,
  onReminderSave,
  onTargetDateChange,
  onEstimatedTimeChange,
  onEstimatedTimeSave,
  formatDateTimeString,
}: KanbanCardDetailPropertiesProps) => {
  const t = useTranslations();

  const priorities: KanbanPriority[] = [
    KanbanPriorityLevel.CRITICAL,
    KanbanPriorityLevel.HIGH,
    KanbanPriorityLevel.MEDIUM,
    KanbanPriorityLevel.LOW,
    KanbanPriorityLevel.NONE,
  ];

  const assigneeOptions = [
    {
      id: "",
      name: (
        <span className="flex items-center gap-2 text-muted-foreground">
          <UserIcon className="h-4 w-4" />
          {t("kanban.unassigned")}
        </span>
      ),
    },
    ...availableUsers.map((user) => ({
      id: user.username,
      name: (
        <span className="flex items-center gap-2">
          <UserAvatar
            username={user.username}
            avatarUrl={user.avatarUrl}
            size="xs"
          />
          {user.username}
        </span>
      ),
    })),
  ];

  const metadata = [];
  if (item.createdBy) {
    metadata.push(
      t("common.createdByOn", {
        user: item.createdBy,
        date: formatDateTimeString(item.createdAt!),
      }),
    );
  }
  if (item.lastModifiedBy) {
    metadata.push(
      t("common.lastModifiedByOn", {
        user: item.lastModifiedBy,
        date: formatDateTimeString(item.lastModifiedAt!),
      }),
    );
  }
  if (item.history?.length) {
    metadata.push(t("common.statusChanges", { count: item.history.length }));
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t("kanban.priority")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {priorities.map((p) => (
                <button
                  key={p}
                  onClick={() => onPriorityChange(p)}
                  className={cn(
                    "text-[11px] px-2.5 py-1.5 rounded-jotty border transition-all flex items-center gap-1.5",
                    priorityInput === p
                      ? "border-primary/50 bg-primary/5 text-foreground font-semibold"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:bg-muted/50",
                  )}
                >
                  {p !== KanbanPriorityLevel.NONE && (
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getPriorityDotColor(p) }}
                    />
                  )}
                  {getPriorityLabel(p, t)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t("kanban.score")}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={scoreInput}
              onChange={(e) => onScoreChange(e.target.value)}
              onBlur={onScoreSave}
              onKeyDown={(e) => e.key === "Enter" && onScoreSave()}
              className="w-full px-3 py-2 text-sm bg-background border border-input rounded-jotty focus:outline-none focus:border-ring transition-colors"
              placeholder="0"
            />
          </div>

          {isShared && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                {t("kanban.assignee")}
              </label>
              <Dropdown
                value={assigneeInput}
                options={assigneeOptions}
                onChange={onAssigneeChange}
                placeholder={t("kanban.unassigned")}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t("kanban.reminder")}
            </label>
            <DateTimePicker
              value={reminderInput}
              onChange={onReminderChange}
              onBlur={onReminderSave}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t("kanban.targetDate")}
            </label>
            <DatePicker
              value={targetDateInput}
              onChange={onTargetDateChange}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t("kanban.estimatedTime")}
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={estimatedTimeInput}
              onChange={(e) => onEstimatedTimeChange(e.target.value)}
              onBlur={onEstimatedTimeSave}
              onKeyDown={(e) => e.key === "Enter" && onEstimatedTimeSave()}
              className="w-full px-3 py-2 text-sm bg-background border border-input rounded-jotty focus:outline-none focus:border-ring transition-colors"
              placeholder="0"
            />
            {item.estimatedTime && item.timeEntries && item.timeEntries.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {t("kanban.actualVsEstimated", {
                  actual: (item.timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0) / 3600).toFixed(1) + "h",
                  estimated: item.estimatedTime + "h",
                })}
              </p>
            )}
          </div>
        </>
      )}

      {metadata.length > 0 && (
        <div className={cn("pt-4", canEdit && "border-t border-border")}>
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {t("auditLogs.metadata")}
          </h5>
          <div className="space-y-1.5">
            {metadata.map((text, i) => (
              <p
                key={i}
                className="text-xs text-muted-foreground flex items-start gap-2"
              >
                <span className="text-muted-foreground/40">&bull;</span>
                <span>{text}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
