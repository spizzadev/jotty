import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { useSettings } from "@/app/_utils/settings-store";

type EditorVimMode = "normal" | "insert" | "visual";

const dispatchEditorModeEvent = (mode: EditorVimMode) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("vim:editor-mode-change", { detail: { mode } })
    );
  }
};

export const VimExtension = Extension.create({
  name: "vimExtension",

  addProseMirrorPlugins() {
    // Start in normal mode — user must press `i` to type
    let currentMode: EditorVimMode = "normal";

    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            focus: () => {
              const isActive = useSettings.getState().vimMode;
              if (!isActive) return false;
              // Stay in normal mode on focus — user presses `i` to enter insert
              currentMode = "normal";
              dispatchEditorModeEvent("normal");
              return false;
            },

            blur: () => {
              const isActive = useSettings.getState().vimMode;
              if (!isActive) return false;
              currentMode = "normal";
              dispatchEditorModeEvent("normal");
              return false;
            },

            keydown: (_view, event) => {
              const isActive = useSettings.getState().vimMode;
              if (!isActive) return false;

              if (currentMode === "normal") {
                if (event.key === "i" || event.key === "a") {
                  currentMode = "insert";
                  dispatchEditorModeEvent("insert");
                  return true;
                }
                if (event.key === "v") {
                  currentMode = "visual";
                  dispatchEditorModeEvent("visual");
                  return true;
                }
                if (event.key === "Escape") {
                  // Already in normal mode — escape back to sidebar
                  window.dispatchEvent(new CustomEvent("vim:escape-editor"));
                  return true;
                }
                // Block printable characters in normal mode
                if (
                  event.key.length === 1 &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.altKey
                ) {
                  return true;
                }
              } else {
                // insert or visual mode
                if (event.key === "Escape") {
                  currentMode = "normal";
                  dispatchEditorModeEvent("normal");
                  event.preventDefault();
                  return true;
                }
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});
