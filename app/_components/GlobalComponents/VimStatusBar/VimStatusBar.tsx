"use client";

import { useVimMode } from "@/app/_providers/VimModeProvider";
import { cn } from "@/app/_utils/global-utils";

/** Small vim mode indicator badge rendered inline next to the profile. */
export const VimIndicator = () => {
  const { isVimActive, pendingKey, editorMode } = useVimMode();

  if (!isVimActive) return null;

  const label =
    editorMode === "insert" ? "I" : editorMode === "visual" ? "V" : "N";

  return (
    <div className="flex items-center gap-1 font-mono select-none">
      <span
        className={cn(
          "w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold",
          editorMode === "insert"
            ? "bg-green-600 text-white"
            : editorMode === "visual"
              ? "bg-purple-600 text-white"
              : "bg-primary/15 text-primary border border-primary/30",
        )}
        title={
          editorMode === "insert"
            ? "VIM INSERT"
            : editorMode === "visual"
              ? "VIM VISUAL"
              : "VIM NORMAL"
        }
      >
        {label}
      </span>
      {pendingKey && (
        <span className="text-[10px] text-muted-foreground leading-none">
          {pendingKey}
          <span className="animate-pulse">…</span>
        </span>
      )}
    </div>
  );
};
