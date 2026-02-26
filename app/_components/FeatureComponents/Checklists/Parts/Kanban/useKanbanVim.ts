"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { KanbanStatus, Item } from "@/app/_types";
import { useSettings } from "@/app/_utils/settings-store";
import { useVimMode } from "@/app/_providers/VimModeProvider";

const isInputTarget = (target: EventTarget | null): boolean => {
  if (!target) return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    el.isContentEditable
  );
};

interface UseKanbanVimOptions {
  statuses: KanbanStatus[];
  getItemsByStatus: (status: string) => Item[];
  handleItemStatusUpdate: (itemId: string, newStatus: string) => Promise<void>;
}

interface KanbanVimState {
  focusedColIndex: number;
  focusedItemIndex: number;
  focusedItemId: string | null;
}

export const useKanbanVim = ({
  statuses,
  getItemsByStatus,
  handleItemStatusUpdate,
}: UseKanbanVimOptions): KanbanVimState => {
  const { vimMode } = useSettings();
  const { focusedArea } = useVimMode();

  const [focusedColIndex, setFocusedColIndex] = useState(-1);
  const [focusedItemIndex, setFocusedItemIndex] = useState(-1);

  const focusedColRef = useRef(-1);
  const focusedItemRef = useRef(-1);

  const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order);

  const isActive = vimMode && focusedArea === "main";

  useEffect(() => {
    focusedColRef.current = focusedColIndex;
  }, [focusedColIndex]);

  useEffect(() => {
    focusedItemRef.current = focusedItemIndex;
  }, [focusedItemIndex]);

  const clearFocus = useCallback(() => {
    setFocusedColIndex(-1);
    setFocusedItemIndex(-1);
    focusedColRef.current = -1;
    focusedItemRef.current = -1;
  }, []);

  // Activate when area switches to main, deactivate when switching away
  useEffect(() => {
    if (!vimMode) {
      clearFocus();
      return;
    }
    if (focusedArea === "main") {
      // Start focus on first column, first item
      setFocusedColIndex(0);
      setFocusedItemIndex(0);
      focusedColRef.current = 0;
      focusedItemRef.current = 0;
    } else {
      clearFocus();
    }
  }, [vimMode, focusedArea, clearFocus]);

  // Listen for vim:focus-sidebar to clear kanban focus
  useEffect(() => {
    const handleFocusSidebar = () => clearFocus();
    window.addEventListener("vim:focus-sidebar", handleFocusSidebar);
    return () =>
      window.removeEventListener("vim:focus-sidebar", handleFocusSidebar);
  }, [clearFocus]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInputTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const colIdx = focusedColRef.current;
      const itemIdx = focusedItemRef.current;
      const key = event.key;

      const currentStatus = sortedStatuses[colIdx >= 0 ? colIdx : 0];
      if (!currentStatus) return;
      const items = getItemsByStatus(currentStatus.id);

      switch (key) {
        case "j": {
          event.preventDefault();
          if (colIdx < 0) {
            setFocusedColIndex(0);
            focusedColRef.current = 0;
          }
          const newItemIdx =
            itemIdx < 0 ? 0 : Math.min(itemIdx + 1, items.length - 1);
          setFocusedItemIndex(newItemIdx);
          focusedItemRef.current = newItemIdx;
          break;
        }

        case "k": {
          event.preventDefault();
          if (colIdx < 0) {
            setFocusedColIndex(0);
            focusedColRef.current = 0;
          }
          const newItemIdx =
            itemIdx < 0 ? items.length - 1 : Math.max(itemIdx - 1, 0);
          setFocusedItemIndex(newItemIdx);
          focusedItemRef.current = newItemIdx;
          break;
        }

        case "l": {
          event.preventDefault();
          const nextCol = Math.min(
            colIdx < 0 ? 1 : colIdx + 1,
            sortedStatuses.length - 1
          );
          setFocusedColIndex(nextCol);
          setFocusedItemIndex(0);
          focusedColRef.current = nextCol;
          focusedItemRef.current = 0;
          break;
        }

        case "h": {
          event.preventDefault();
          const prevCol = Math.max(colIdx <= 0 ? 0 : colIdx - 1, 0);
          setFocusedColIndex(prevCol);
          setFocusedItemIndex(0);
          focusedColRef.current = prevCol;
          focusedItemRef.current = 0;
          break;
        }

        case "L": {
          // Shift+L: move card to next column
          event.preventDefault();
          if (colIdx < 0 || itemIdx < 0 || itemIdx >= items.length) break;
          const nextStatus =
            sortedStatuses[Math.min(colIdx + 1, sortedStatuses.length - 1)];
          if (nextStatus && nextStatus.id !== currentStatus.id) {
            handleItemStatusUpdate(items[itemIdx].id, nextStatus.id);
          }
          break;
        }

        case "H": {
          // Shift+H: move card to previous column
          event.preventDefault();
          if (colIdx < 0 || itemIdx < 0 || itemIdx >= items.length) break;
          const prevStatus = sortedStatuses[Math.max(colIdx - 1, 0)];
          if (prevStatus && prevStatus.id !== currentStatus.id) {
            handleItemStatusUpdate(items[itemIdx].id, prevStatus.id);
          }
          break;
        }

        case "Escape": {
          event.preventDefault();
          clearFocus();
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, sortedStatuses, getItemsByStatus, handleItemStatusUpdate, clearFocus]);

  const focusedItemId =
    focusedColIndex >= 0 && focusedItemIndex >= 0
      ? (() => {
          const status = sortedStatuses[focusedColIndex];
          if (!status) return null;
          const items = getItemsByStatus(status.id);
          return items[focusedItemIndex]?.id ?? null;
        })()
      : null;

  return { focusedColIndex, focusedItemIndex, focusedItemId };
};
