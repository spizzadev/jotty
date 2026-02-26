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

interface VimModeContextType {
  focusedIndex: number;
  pendingKey: string | null;
  isVimActive: boolean;
  editorMode: VimEditorMode;
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
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<VimEditorMode>("normal");

  const pendingKeyRef = useRef<string | null>(null);
  const focusedIndexRef = useRef(-1);
  const pendingKeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pendingKeyRef.current = pendingKey;
  }, [pendingKey]);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  const getItems = useCallback((): Element[] => {
    return Array.from(document.querySelectorAll("[data-vim-item]"));
  }, []);

  const clearFocus = useCallback(() => {
    document.querySelectorAll("[data-vim-focused]").forEach((el) => {
      el.removeAttribute("data-vim-focused");
    });
    setFocusedIndex(-1);
    focusedIndexRef.current = -1;
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
      }

      setFocusedIndex(clampedIndex);
      focusedIndexRef.current = clampedIndex;
    },
    [getItems]
  );

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
    [getItems]
  );

  const triggerCategoryAction = useCallback(() => {
    const items = getItems();
    const idx = focusedIndexRef.current;
    if (idx < 0 || idx >= items.length) return;
    const item = items[idx] as HTMLElement;
    const category = item.getAttribute("data-vim-category");
    if (category) {
      document.dispatchEvent(
        new CustomEvent("vim:toggle-category", { detail: { category } })
      );
    }
  }, [getItems]);

  useEffect(() => {
    if (!vimMode) {
      clearFocus();
      if (pendingKeyTimerRef.current) clearTimeout(pendingKeyTimerRef.current);
      setPendingKey(null);
      pendingKeyRef.current = null;
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInputTarget(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key;
      const items = getItems();
      const currentIndex = focusedIndexRef.current;
      const currentPendingKey = pendingKeyRef.current;

      // Two-key sequence: dd
      if (currentPendingKey === "d" && key === "d") {
        event.preventDefault();
        if (pendingKeyTimerRef.current) clearTimeout(pendingKeyTimerRef.current);
        setPendingKey(null);
        pendingKeyRef.current = null;
        dispatchVimEvent("vim:delete-item");
        return;
      }

      // Two-key sequence: gg
      if (currentPendingKey === "g" && key === "g") {
        event.preventDefault();
        if (pendingKeyTimerRef.current) clearTimeout(pendingKeyTimerRef.current);
        setPendingKey(null);
        pendingKeyRef.current = null;
        setFocus(0);
        return;
      }

      // Clear pending key on unrelated key
      if (currentPendingKey && key !== currentPendingKey) {
        if (pendingKeyTimerRef.current) clearTimeout(pendingKeyTimerRef.current);
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
          if (pendingKeyTimerRef.current) clearTimeout(pendingKeyTimerRef.current);
          pendingKeyTimerRef.current = setTimeout(() => {
            setPendingKey(null);
            pendingKeyRef.current = null;
          }, 1000);
          break;

        case "Enter":
        case "l":
          event.preventDefault();
          if (currentIndex >= 0) navigateToFocused();
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

        case "d":
          event.preventDefault();
          setPendingKey("d");
          pendingKeyRef.current = "d";
          if (pendingKeyTimerRef.current) clearTimeout(pendingKeyTimerRef.current);
          pendingKeyTimerRef.current = setTimeout(() => {
            setPendingKey(null);
            pendingKeyRef.current = null;
          }, 1000);
          break;

        case "n":
          event.preventDefault();
          if (mode === Modes.NOTES) openCreateNoteModal();
          else openCreateChecklistModal();
          break;

        case "/":
          event.preventDefault();
          openSearch();
          break;

        case "t":
          event.preventDefault();
          dispatchVimEvent("vim:time-item");
          break;

        case "1":
          event.preventDefault();
          router.push("/?mode=notes");
          break;

        case "2":
          event.preventDefault();
          router.push("/?mode=checklists");
          break;

        case "3":
          event.preventDefault();
          router.push("/?mode=time-tracking");
          break;

        case "Escape":
          event.preventDefault();
          clearFocus();
          if (pendingKeyTimerRef.current) clearTimeout(pendingKeyTimerRef.current);
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
        handleEditorModeChange
      );
  }, []);

  return (
    <VimModeContext.Provider
      value={{
        focusedIndex,
        pendingKey,
        isVimActive: vimMode,
        editorMode,
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
