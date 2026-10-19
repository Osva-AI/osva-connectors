import { describe, expect, it, vi } from "vitest";

import { acquirePoolClient } from "../src/acquire-pool-client.js";
import { PostgresOperationContext } from "../src/operation-context.js";

describe("acquirePoolClient", () => {
  it("destroys a late connection when acquisition is cancelled", async () => {
    const controller = new AbortController();
    const operation = new PostgresOperationContext(5_000, controller.signal);
    let resolveConnect:
      ((client: { release: ReturnType<typeof vi.fn> }) => void) | undefined;
    const pendingConnect = new Promise<{ release: ReturnType<typeof vi.fn> }>(
      (resolve) => {
        resolveConnect = resolve;
      },
    );
    const pool = {
      connect: vi.fn(() => pendingConnect),
    };

    const acquirePromise = acquirePoolClient(pool as never, operation);
    controller.abort();
    await expect(acquirePromise).rejects.toMatchObject({ name: "AbortError" });

    const lateClient = { release: vi.fn() };
    resolveConnect?.(lateClient);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(lateClient.release).toHaveBeenCalledWith(true);
  });
});
