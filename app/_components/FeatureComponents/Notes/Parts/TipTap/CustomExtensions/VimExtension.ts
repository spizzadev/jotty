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
    let currentMode: EditorVimMode = "normal";

    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            focus: () => {
              const isActive = useSettings.getState().vimMode;
              if (!isActive) return false;
              // When editor is focused, enter insert mode automatically
              currentMode = "insert";
              dispatchEditorModeEvent("insert");
              return false;
            },

            blur: () => {
              const isActive = useSettings.getState().vimMode;
              if (!isActive) return false;
              // When editor loses focus, reset to normal
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
                  return false;
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
