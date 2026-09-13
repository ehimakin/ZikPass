# Local visual editor (Next.js App Router)

A copyable development tool for React 19 / Next.js 15 TypeScript projects. No browser extension or additional runtime service. Requires the host project's TypeScript dependency. Run commands from the project root.

## One-command install

Copy this repository into `local-visual-editor/` inside your project, then from the project root run:

```sh
node local-visual-editor/install.mjs
```

The installer copies the portable runtime into `devtools/visual-editor`, discovers `.tsx` files in `components` (or `src/components`), wires the API and layout, and maps static text. It preserves an existing allowlist. You can then remove the copied `local-visual-editor` staging folder. Restart your development server. No extension or hosted service is required. Review the generated diff; dynamic data stays unmapped. Next.js App Router with a TypeScript layout is currently supported; other frameworks need adapters.

## Manual install in another project

1. Copy this entire `devtools/visual-editor` folder into the project.
2. Create `visual-editor.config.json` with the exact component files you want editable:
   ```json
   {"files":["components/customer/home-screen.tsx"]}
   ```
3. Create `app/api/local-editor/route.ts`:
   ```ts
   import { createEditorHandlers } from "@/devtools/visual-editor/route";
   import config from "@/visual-editor.config.json";
   export const runtime = "nodejs";
   export const dynamic = "force-dynamic";
   export const { GET, POST, DELETE } = createEditorHandlers(config.files);
   ```
4. Import `LocalVisualEditor` from `@/devtools/visual-editor/local-visual-editor` in `app/layout.tsx`. Place `{process.env.NODE_ENV === "development" && <LocalVisualEditor />}` after `{children}` inside the body. Projects without an `@/` root alias should use relative paths in these two adapters.
5. Run `node devtools/visual-editor/setup.mjs`, then your usual development server. Restart an already-running server after installation.

Add more component paths to the config and rerun setup whenever needed. Setup is repeatable and preserves existing source edits. Review its diff before committing.

## Use

Open the site at localhost. Click **Edit page**, then outlined text. Edit text or font size, text/background colour, or corner radius in the panel. **Save to source** or **⌘S / Ctrl+S** while editing writes the component file. Next.js refreshes the page. Exit editing discards unsaved previews; Undo restores the last saved source if it has not subsequently changed.

This panel is the editing surface: arbitrary changes made in Chrome's Elements inspector are not captured. Browser Save outside editor mode still saves an HTML copy.

## Scope and safeguards

Only explicitly allowed component files and marked static text are editable. Dynamic values, API data, arbitrary CSS, layout restructuring, and complex computed styles require source editing. Nested emphasis and line breaks are retained. Shared component edits affect every use of that component. Repeated instances share the same source entry.

The API returns 404 outside development or on non-loopback hosts. Writes require same-origin JSON, a session token, a size limit, and a current source hash. Saves are serialized within one server process; undo refuses to overwrite subsequent edits. Symlinks and paths outside the allowlist are rejected. The writer and TypeScript parser load only after the development/host guard. This is a trusted local developer tool, not a remote CMS or security boundary against malicious same-origin code. Concurrent external filesystem edits can still race a write; use git to review/recover work. Undo is in server memory and resets when the process restarts.

Only development builds emit the setup markers and editor panel. Saved text/style changes intentionally appear in production.

## Test and remove

The portable `source.test.ts` and `store.test.ts` use Vitest. If your test configuration only includes `tests/`, import both from a test wrapper there.

Remove the layout import/render, API adapter, config and this folder to uninstall. `data-local-edit` attributes can remain harmlessly (undefined in production), or be removed from components. Saved content remains ordinary JSX; the tool is not required to render it.
