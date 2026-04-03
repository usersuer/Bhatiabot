import app from "./app";
import { logger } from "./lib/logger";
import { startDiscordBot } from "./lib/discord";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Keep-alive: ping ourselves every 4 minutes so the server never sleeps
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) {
    const keepAliveUrl = `https://${devDomain}/`;
    setInterval(async () => {
      try {
        await fetch(keepAliveUrl);
        logger.info("Keep-alive ping sent");
      } catch (err) {
        logger.warn({ err }, "Keep-alive ping failed");
      }
    }, 4 * 60 * 1000);
    logger.info({ keepAliveUrl }, "Keep-alive pinger started");
  }
});

startDiscordBot().catch((err) => {
  logger.error({ err }, "Failed to start Discord bot");
  process.exit(1);
});
