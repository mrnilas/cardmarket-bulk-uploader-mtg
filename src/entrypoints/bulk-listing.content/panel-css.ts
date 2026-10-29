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
button.small { width: auto; margin: 0; padding: 2px 8px; font-size: 12px; }
details.setup { margin: 8px 0 4px; padding: 0 10px 10px; border: 1px solid var(--border); border-radius: 8px; }
details.setup > summary { margin: 0; padding: 8px 0 0; font-weight: 600; }
.field { display: grid; gap: 4px; margin-top: 8px; font-weight: 600; }
input, select { font: inherit; color: var(--fg); }
input[type='file'] { font-weight: 400; max-width: 100%; }
input[type='number'], select {
  width: 100%;
  box-sizing: border-box;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
}
select option { background: var(--bg); }
fieldset.prices { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 8px 0 0; padding: 0; border: 0; }
fieldset.prices legend { padding: 0; margin-bottom: 4px; color: var(--muted); }
fieldset.prices label { display: grid; gap: 2px; font-size: 12px; color: var(--muted); }
.actions { display: flex; gap: 6px; }
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 12px;
}
.muted { color: var(--muted); }
.ok { color: var(--ok); }
.warn { color: var(--warn); }
.error { color: var(--error); }
`;
