import app from "./app";
import { logger } from "./lib/logger";
import { startAttachmentUploadCleanup } from "./lib/object-storage";
import { assertTenantProtectionIsReady } from "./lib/tenant-database";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer(): Promise<void> {
  await assertTenantProtectionIsReady();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startAttachmentUploadCleanup();
  });
}

startServer().catch((err: unknown) => {
  logger.error({ err }, "API startup checks failed");
  process.exit(1);
});
