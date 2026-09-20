import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const file = path.join(process.env.ZIK_RUNTIME_DATA_DIR || path.join(process.cwd(), "data"), "affiliate-onboarding.json");
const rows = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
console.log(JSON.stringify(rows.filter(row => row.assistance || row.booking).map(row => ({ id: row.id, site: row.name, website: row.website, state: row.state, assistance: row.assistance, booking: row.booking, sessionRoute: row.pair ? `/affiliates/session?id=${row.id}` : undefined })), null, 2));
