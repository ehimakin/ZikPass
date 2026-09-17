// Installed by local-visual-editor
import { createEditorHandlers } from "../../../devtools/visual-editor/route";
import config from "../../../visual-editor.config.json";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, POST, DELETE, PUT } = createEditorHandlers(config);
