"use client";

import { useVimMode } from "@/app/_providers/VimModeProvider";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import { Modes } from "@/app/_types/enums";
import { cn } from "@/app/_utils/global-utils";

export const VimStatusBar = () => {
  const { isVimActive, pendingKey, editorMode } = useVimMode();
  const { mode } = useAppMode();

  if (!isVimActive) return null;

  const modeLabel =
    editorMode === "insert"
      ? "INSERT"
      : editorMode === "visual"
        ? "VISUAL"
        : "NORMAL";

  const modeBreadcrumb =
    mode === Modes.NOTES
      ? "notes"
      : mode === Modes.CHECKLISTS
        ? "checklists"
        : "tracking";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 px-3 py-1 bg-background border-t border-border text-xs font-mono select-none pointer-events-none">
      <span
        className={cn(
          "px-2 py-0.5 rounded font-bold tracking-widest",
          editorMode === "insert"
            ? "bg-green-600 text-white"
            : editorMode === "visual"
              ? "bg-purple-600 text-white"
              : "bg-primary text-primary-foreground"
        )}
      >
        {modeLabel}
      </span>

      {pendingKey && (
        <span className="text-muted-foreground">
          {pendingKey}
          <span className="animate-pulse">…</span>
        </span>
      )}

      <span className="ml-auto text-muted-foreground">{modeBreadcrumb}</span>
    </div>
  );
};
