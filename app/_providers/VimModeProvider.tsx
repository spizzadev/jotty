"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useSettings } from "@/app/_utils/settings-store";
import { useShortcut } from "@/app/_providers/ShortcutsProvider";
import { useRouter } from "next/navigation";
import { useAppMode } from "@/app/_providers/AppModeProvider";
import { Modes } from "@/app/_types/enums";

export type VimEditorMode = "normal" | "insert" | "visual";
export type VimFocusArea = "sidebar" | "main";

interface VimModeContextType {
  focusedIndex: number;
  focusedItemId: string | null;
  pendingKey: string | null;
  isVimActive: boolean;
  editorMode: VimEditorMode;
  focusedArea: VimFocusArea;
  setEditorMode: (mode: VimEditorMode) => void;
}

const VimModeContext = createContext<VimModeContextType | undefined>(undefined);

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

export const VimModeProvider = ({ children }: { children: ReactNode }) => {
  const { vimMode } = useSettings();
  const { openCreateNoteModal, openCreateChecklistModal, openSearch } =
    useShortcut();
  const router = useRouter();
  const { mode } = useAppMode();

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<VimEditorMode>("normal");
  const [focusedArea, setFocusedArea] = useState<VimFocusArea>("sidebar");

  const pendingKeyRef = useRef<string | null>(null);
  const focusedIndexRef = useRef(-1);
  const focusedItemIdRef = useRef<string | null>(null);
  const focusedAreaRef = useRef<VimFocusArea>("sidebar");
  const pendingKeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionTimeRef = useRef(0);

  useEffect(() => {
    pendingKeyRef.current = pendingKey;
  }, [pendingKey]);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  useEffect(() => {
    focusedAreaRef.current = focusedArea;
  }, [focusedArea]);

  const getItems = useCallback((): Element[] => {
    return Array.from(document.querySelectorAll("[data-vim-item]"));
  }, []);

  const clearFocus = useCallback(() => {
    document.querySelectorAll("[data-vim-focused]").forEach((el) => {
      el.removeAttribute("data-vim-focused");
    });
    setFocusedIndex(-1);
    focusedIndexRef.current = -1;
    setFocusedItemId(null);
    focusedItemIdRef.current = null;
  }, []);

  const setFocus = useCallback(
    (index: number) => {
      const items = getItems();
      if (items.length === 0) return;
      const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

      document.querySelectorAll("[data-vim-focused]").forEach((el) => {
        el.removeAttribute("data-vim-focused");
      });

      const target = items[clampedIndex];
      if (target) {
        target.setAttribute("data-vim-focused", "true");
        (target as HTMLElement).scrollIntoView({ block: "nearest" });
        const id = target.getAttribute("data-vim-item-id") ?? null;
        setFocusedItemId(id);
        focusedItemIdRef.current = id;
      }

      setFocusedIndex(clampedIndex);
      focusedIndexRef.current = clampedIndex;
    },
    [getItems],
  );

  // Re-apply focus highlight by item ID — called after DOM mutations so that
  // focus follows the item to its new DOM position (e.g. after pin/reorder).
  const syncFocusByItemId = useCallback(() => {
    const id = focusedItemIdRef.current;
    if (!id) return;

    const items = getItems();

    // Clear all stale highlights
    document.querySelectorAll("[data-vim-focused]").forEach((el) => {
      el.removeAttribute("data-vim-focused");
    });

    const idx = items.findIndex(
      (el) => el.getAttribute("data-vim-item-id") === id,
    );

    if (idx >= 0) {
      items[idx].setAttribute("data-vim-focused", "true");
      focusedIndexRef.current = idx;
      setFocusedIndex(idx);
    } else {
      // Item was deleted or is no longer visible — clear focus
      setFocusedItemId(null);
      focusedItemIdRef.current = null;
      setFocusedIndex(-1);
      focusedIndexRef.current = -1;
    }
  }, [getItems]);

  // Watch for DOM mutations (router.refresh, pin, delete, category collapse) and
  // re-sync the focus highlight to the correct element.
  useEffect(() => {
    if (!vimMode) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(syncFocusByItemId, 120);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [vimMode, syncFocusByItemId]);

  const switchToMain = useCallback(() => {
    clearFocus();
    setFocusedArea("main");
    focusedAreaRef.current = "main";
    window.dispatchEvent(new CustomEvent("vim:focus-main"));
  }, [clearFocus]);

  const switchToSidebar = useCallback(() => {
    setFocusedArea("sidebar");
    focusedAreaRef.current = "sidebar";
    window.dispatchEvent(new CustomEvent("vim:focus-sidebar"));
    // Blur any focused input so sidebar can receive keys
    if (document.activeElement && isInputTarget(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
  }, []);

  const navigateToFocused = useCallback(() => {
    const items = getItems();
    const idx = focusedIndexRef.current;
    if (idx < 0 || idx >= items.length) return;
    const item = items[idx] as HTMLElement;
    const href = item.getAttribute("data-vim-href");
    if (href) router.push(href);
  }, [getItems, router]);

  const dispatchVimEvent = useCallback(
    (eventName: string) => {
      const items = getItems();
      const idx = focusedIndexRef.current;
      if (idx < 0 || idx >= items.length) return;
      const item = items[idx] as HTMLElement;
      item.dispatchEvent(new CustomEvent(eventName, { bubbles: true }));
    },
    [getItems],
  );

  const triggerCategoryAction = useCallback(() => {
    const items = getItems();
    const idx = focusedIndexRef.current;
    if (idx < 0 || idx >= items.length) return;
    const item = items[idx] as HTMLElement;
    const category = item.getAttribute("data-vim-category");
    if (category) {
      document.dispatchEvent(
        new CustomEvent("vim:toggle-category", { detail: { category } }),
      );
    }
  }, [getItems]);

  // Prevent auto-focus on inputs when in vim mode
  useEffect(() => {
    if (!vimMode) return;

    const handleUserInteraction = () => {
      lastInteractionTimeRef.current = Date.now();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (!isInputTarget(target)) return;

      const timeSinceInteraction = Date.now() - lastInteractionTimeRef.current;
      if (timeSinceInteraction > 400) {
        // Auto-focus without recent user interaction — blur it
        target.blur();
      }
    };

    // Update on mouse, touch, AND keydown so that modal auto-focus after
    // pressing `n` (create note) etc. is still allowed
    window.addEventListener("mousedown", handleUserInteraction, true);
    window.addEventListener("touchstart", handleUserInteraction, true);
    window.addEventListener("keydown", handleUserInteraction, true);
    window.addEventListener("focusin", handleFocusIn, true);

    return () => {
      window.removeEventListener("mousedown", handleUserInteraction, true);
      window.removeEventListener("touchstart", handleUserInteraction, true);
      window.removeEventListener("keydown", handleUserInteraction, true);
      window.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [vimMode]);

  // Listen for editor escape (Esc pressed in normal mode inside editor)
  useEffect(() => {
    const handleEscapeEditor = () => {
      switchToSidebar();
    };
    window.addEventListener("vim:escape-editor", handleEscapeEditor);
    return () =>
      window.removeEventListener("vim:escape-editor", handleEscapeEditor);
  }, [switchToSidebar]);

  // Main keydown handler
  useEffect(() => {
    if (!vimMode) {
      clearFocus();
      if (pendingKeyTimerRef.current) clearTimeout(pendingKeyTimerRef.current);
      setPendingKey(null);
      pendingKeyRef.current = null;
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Always allow Tab for area switching (even in inputs)
      if (
        event.key === "Tab" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        if (focusedAreaRef.current === "sidebar") {
          switchToMain();
        } else {
          switchToSidebar();
        }
        return;
      }

      // Skip when typing in inputs (unless we're in sidebar area but editor has focus —
      // that's handled by vim:escape-editor)
      if (isInputTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key;

      // Keys that work in both areas
      if (key === "1") {
        event.preventDefault();
        router.push("/?mode=notes");
        return;
      }
      if (key === "2") {
        event.preventDefault();
        router.push("/?mode=checklists");
        return;
      }
      if (key === "3") {
        event.preventDefault();
        router.push("/?mode=time-tracking");
        return;
      }
      if (key === "/") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (key === "n") {
        event.preventDefault();
        if (mode === Modes.NOTES) openCreateNoteModal();
        else openCreateChecklistModal();
        return;
      }

      // Sidebar-only navigation
      if (focusedAreaRef.current !== "sidebar") return;

      const items = getItems();
      const currentIndex = focusedIndexRef.current;
      const currentPendingKey = pendingKeyRef.current;

      // Two-key: dd
      if (currentPendingKey === "d" && key === "d") {
        event.preventDefault();
        if (pendingKeyTimerRef.current)
          clearTimeout(pendingKeyTimerRef.current);
        setPendingKey(null);
        pendingKeyRef.current = null;
        dispatchVimEvent("vim:delete-item");
        return;
      }

      // Two-key: gg
      if (currentPendingKey === "g" && key === "g") {
        event.preventDefault();
        if (pendingKeyTimerRef.current)
          clearTimeout(pendingKeyTimerRef.current);
        setPendingKey(null);
        pendingKeyRef.current = null;
        setFocus(0);
        return;
      }

      if (currentPendingKey && key !== currentPendingKey) {
        if (pendingKeyTimerRef.current)
          clearTimeout(pendingKeyTimerRef.current);
        setPendingKey(null);
        pendingKeyRef.current = null;
      }

      switch (key) {
        case "j":
          event.preventDefault();
          setFocus(currentIndex < 0 ? 0 : currentIndex + 1);
          break;

        case "k":
          event.preventDefault();
          setFocus(currentIndex < 0 ? items.length - 1 : currentIndex - 1);
          break;

        case "G":
          event.preventDefault();
          setFocus(items.length - 1);
          break;

        case "g":
          event.preventDefault();
          setPendingKey("g");
          pendingKeyRef.current = "g";
          if (pendingKeyTimerRef.current)
            clearTimeout(pendingKeyTimerRef.current);
          pendingKeyTimerRef.current = setTimeout(() => {
            setPendingKey(null);
            pendingKeyRef.current = null;
          }, 1000);
          break;

        case "Enter":
        case "l":
          event.preventDefault();
          if (currentIndex >= 0) {
            navigateToFocused();
            // After navigating to a note/checklist, switch to main area
            switchToMain();
          }
          break;

        case "h":
          event.preventDefault();
          triggerCategoryAction();
          break;

        case "e":
          event.preventDefault();
          dispatchVimEvent("vim:edit-item");
          break;

        case "p":
          event.preventDefault();
          dispatchVimEvent("vim:pin-item");
          break;

        case "t":
          event.preventDefault();
          dispatchVimEvent("vim:time-item");
          break;

        case "d":
          event.preventDefault();
          setPendingKey("d");
          pendingKeyRef.current = "d";
          if (pendingKeyTimerRef.current)
            clearTimeout(pendingKeyTimerRef.current);
          pendingKeyTimerRef.current = setTimeout(() => {
            setPendingKey(null);
            pendingKeyRef.current = null;
          }, 1000);
          break;

        case "Escape":
          event.preventDefault();
          clearFocus();
          if (pendingKeyTimerRef.current)
            clearTimeout(pendingKeyTimerRef.current);
          setPendingKey(null);
          pendingKeyRef.current = null;
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    vimMode,
    mode,
    getItems,
    setFocus,
    clearFocus,
    navigateToFocused,
    dispatchVimEvent,
    triggerCategoryAction,
    switchToMain,
    switchToSidebar,
    openCreateNoteModal,
    openCreateChecklistModal,
    openSearch,
    router,
  ]);

  // Listen for editor mode changes from VimExtension
  useEffect(() => {
    const handleEditorModeChange = (event: Event) => {
      const e = event as CustomEvent<{ mode: VimEditorMode }>;
      setEditorMode(e.detail.mode);
    };
    window.addEventListener("vim:editor-mode-change", handleEditorModeChange);
    return () =>
      window.removeEventListener(
        "vim:editor-mode-change",
        handleEditorModeChange,
      );
  }, []);

  // Reset to sidebar area when vim mode is toggled off
  useEffect(() => {
    if (!vimMode) {
      setFocusedArea("sidebar");
      focusedAreaRef.current = "sidebar";
      setEditorMode("normal");
    }
  }, [vimMode]);

  return (
    <VimModeContext.Provider
      value={{
        focusedIndex,
        focusedItemId,
        pendingKey,
        isVimActive: vimMode,
        editorMode,
        focusedArea,
        setEditorMode,
      }}
    >
      {children}
    </VimModeContext.Provider>
  );
};

export const useVimMode = () => {
  const context = useContext(VimModeContext);
  if (!context) {
    throw new Error("useVimMode must be used within VimModeProvider");
  }
  return context;
};
