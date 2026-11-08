// Vim-keys editor for the challenge authoring page. Bundled with esbuild into vendor/arcade-editor.js.
// Stock Vim emulation (CodeMirror 6 + @replit/codemirror-vim); exposes window.ArcadeEditor.
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState, Transaction } from "@codemirror/state";
import { vim, getCM, Vim } from "@replit/codemirror-vim";

const theme = EditorView.theme({
  "&": { color: "var(--text)", backgroundColor: "var(--surface)", border: "1px solid var(--accent)", borderRadius: "15px", fontSize: "13px", overflow: "hidden" },
  "&.cm-focused": { outline: "2px solid var(--accent)" },
  ".cm-scroller": { fontFamily: "var(--font)", lineHeight: "1.6", maxHeight: "320px" },
  ".cm-content": { padding: "10px 4px", minHeight: "110px", caretColor: "var(--accent)" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--accent-ink)", border: "none", opacity: ".7" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-fat-cursor": { background: "var(--accent) !important", color: "var(--on-accent) !important" },
  "&:not(.cm-focused) .cm-fat-cursor": { background: "transparent !important", outline: "1px solid var(--accent)", color: "inherit !important" },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { background: "var(--accent) !important", opacity: ".35" },
  ".cm-vim-panel": { background: "var(--code)", color: "var(--text)", fontFamily: "var(--font)", padding: "4px 10px", borderTop: "1px solid var(--border)" },
  ".cm-vim-panel input": { background: "transparent", color: "var(--text)", border: "none", outline: "none", fontFamily: "inherit", width: "80%" },
});

const MODS = { Shift: 1, Control: 1, Alt: 1, Meta: 1, CapsLock: 1, AltGraph: 1 };

window.ArcadeEditor = {
  create(parent, hooks) {
    hooks = hooks || {};
    let quiet = false;
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "",
        extensions: [
          vim({ status: false }), lineNumbers(), theme, EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": "Vim editor for the challenge", spellcheck: "false" }),
          EditorView.updateListener.of(() => { if (!quiet && hooks.onUpdate) { hooks.onUpdate(); } }),
        ],
      }),
    });
    const cm = getCM(view);
    cm.on("vim-mode-change", () => { if (!quiet && hooks.onUpdate) { hooks.onUpdate(); } });
    view.contentDOM.addEventListener("keydown", (e) => {
      if (MODS[e.key]) { return; }
      if (hooks.onKey) { hooks.onKey(e); }
      setTimeout(() => { if (hooks.onUpdate) { hooks.onUpdate(); } }, 0);
    }, true);

    const api = {
      mode() {
        const v = cm.state.vim;
        return !v ? "normal" : v.insertMode ? "insert" : v.visualMode ? "visual" : "normal";
      },
      text() { return view.state.doc.toString(); },
      cursor() { const c = cm.getCursor(); return [c.line + 1, c.ch]; },
      setText(text, cursor) {
        quiet = true;
        try {
          if (cm.state.vim && cm.state.vim.insertMode) { Vim.exitInsertMode(cm); }
          if (cm.state.vim && cm.state.vim.visualMode) { Vim.exitVisualMode(cm); }
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
            annotations: Transaction.addToHistory.of(false),
          });
          const row = Math.max(1, Math.min(view.state.doc.lines, (cursor && cursor[0]) || 1));
          const len = view.state.doc.line(row).length;
          cm.setCursor(row - 1, Math.max(0, Math.min(Math.max(0, len - 1), (cursor && cursor[1]) || 0)));
        } finally { quiet = false; }
      },
      focus() { view.focus(); },
      destroy() { view.destroy(); },
    };
    return api;
  },
};
