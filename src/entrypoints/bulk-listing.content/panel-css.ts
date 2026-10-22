export const PANEL_CSS = `
:host {
  all: initial;
  --bg: #ffffff;
  --fg: #1b1f24;
  --muted: #5f6b7a;
  --border: #d9dee5;
  --ok: #1a7f37;
  --warn: #9a6700;
  --error: #cf222e;
  --accent: #0f5bd8;
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #17191d;
    --fg: #e6e9ee;
    --muted: #9aa4b2;
    --border: #2f343c;
    --ok: #4ac26b;
    --warn: #d4a72c;
    --error: #ff7b72;
    --accent: #6ea8fe;
  }
}
.panel {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483000;
  width: 320px;
  max-height: 70vh;
  overflow: auto;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  color: var(--fg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
header { display: flex; align-items: center; justify-content: space-between; }
p { margin: 8px 0; }
ul { margin: 6px 0 0; padding-left: 18px; max-height: 160px; overflow: auto; }
summary { cursor: pointer; margin: 8px 0 0; }
nav { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); display: grid; gap: 6px; }
a { color: var(--accent); }
button, a.button {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 6px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--accent);
  font: inherit;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button.icon { width: auto; margin: 0; padding: 0 6px; border: 0; color: var(--muted); }
.muted { color: var(--muted); }
.ok { color: var(--ok); }
.warn { color: var(--warn); }
.error { color: var(--error); }
`;
