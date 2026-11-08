import postgres from 'postgres';
import type { SupportStore } from './store';
let client: ReturnType<typeof postgres> | undefined;
function database() {
  return client ??= postgres(process.env.ZIK_SUPPORT_DATABASE_URL!, { max: 2, idle_timeout: 20, connect_timeout: 10, prepare: false });
}
/** A locked JSON row preserves existing help-desk transactions across Vercel instances.
 * Schema is provisioned explicitly, never through the runtime database role.
 */
export async function databaseTransaction<T>(work: (data: SupportStore) => T | Promise<T>): Promise<T> {
  const sql = database();
  let result!: T;
  await sql.begin(async transaction => {
    const [row] = await transaction`SELECT data FROM zik_support_state WHERE id = 1 FOR UPDATE`;
    if (!row || row.data.version !== 1) throw new Error('Support database schema is not initialized.');
    const data = row.data as SupportStore;
    result = await work(data);
    await transaction`UPDATE zik_support_state SET data = ${transaction.json(JSON.parse(JSON.stringify(data)))} WHERE id = 1`;
  });
  return result;
}
