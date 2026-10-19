import type Cursor from "pg-cursor";
import type { PoolClient } from "pg";

async function rollbackAndRelease(client: PoolClient): Promise<void> {
  await client.query("ROLLBACK");
  client.release();
}

async function rollbackAndDestroy(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Connection may already be broken when destroying after cancellation.
  } finally {
    client.release(true);
  }
}

export async function closeCursorQuietly(
  cursor: Cursor | undefined,
): Promise<boolean> {
  if (cursor === undefined) {
    return true;
  }
  try {
    await cursor.close();
    return true;
  } catch {
    return false;
  }
}

export async function finalizeReadOnlySession(options: {
  client: PoolClient;
  cursor?: Cursor;
  destroy: boolean;
}): Promise<void> {
  if (options.destroy) {
    await rollbackAndDestroy(options.client);
    return;
  }

  const cursorClosed = await closeCursorQuietly(options.cursor);
  if (!cursorClosed) {
    await rollbackAndDestroy(options.client);
    return;
  }
  try {
    await rollbackAndRelease(options.client);
  } catch {
    await rollbackAndDestroy(options.client);
  }
}
