import type { Pool, PoolClient } from "pg";

import type { PostgresOperationContext } from "./operation-context.js";

export async function acquirePoolClient(
  pool: Pool,
  operation: PostgresOperationContext,
): Promise<PoolClient> {
  operation.assertActive();
  const pendingConnect = pool.connect();
  pendingConnect.catch(() => {
    // Avoid unhandled rejection when this connect completes after cancellation.
  });

  try {
    return await operation.race(pendingConnect);
  } catch (error) {
    pendingConnect
      .then((client) => {
        client.release(true);
      })
      .catch(() => {
        // Connect failed or pool ended; nothing to release.
      });
    throw error;
  }
}
