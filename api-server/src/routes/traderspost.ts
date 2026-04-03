import { Router, type IRouter, type Request, type Response } from "express";
import { sendDiscordAlert } from "../lib/discord";
import { isMuted, isTickerAllowed } from "../lib/bot-state";

const router: IRouter = Router();

const ACTION_COLORS: Record<string, number> = {
  buy: 0x00c853,
  sell: 0xff1744,
  exit: 0xff9100,
  cancel: 0x9e9e9e,
};

function getColor(action: string): number {
  return ACTION_COLORS[action?.toLowerCase()] ?? 0x5865f2;
}

function formatPrice(price: unknown): string {
  if (typeof price === "number") return `$${price.toFixed(2)}`;
  if (typeof price === "string" && !isNaN(Number(price)))
    return `$${Number(price).toFixed(2)}`;
  return String(price ?? "N/A");
}

router.post("/traderspost/webhook", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  req.log.info({ body }, "Received TradersPost webhook");

  const ticker = String(body.ticker ?? body.symbol ?? "Unknown");
  const action = String(body.action ?? body.side ?? "signal");
  const price = body.price ?? body.close ?? body.last ?? null;
  const quantity = body.quantity ?? body.contracts ?? body.shares ?? null;
  const sentiment = body.sentiment ?? null;
  const message = body.message ?? body.text ?? null;

  if (isMuted()) {
    req.log.info("Alert suppressed — bot is muted");
    return res.json({ ok: true, message: "Bot is muted. Alert not sent." });
  }

  if (!isTickerAllowed(ticker)) {
    req.log.info({ ticker }, "Alert suppressed — ticker not in allowlist");
    return res.json({ ok: true, message: `Ticker ${ticker} is not in the allowlist. Alert not sent.` });
  }

  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (price !== null) fields.push({ name: "Price", value: formatPrice(price), inline: true });
  if (quantity !== null) fields.push({ name: "Quantity", value: String(quantity), inline: true });
  if (sentiment !== null) fields.push({ name: "Sentiment", value: String(sentiment), inline: true });
  if (message !== null) fields.push({ name: "Message", value: String(message), inline: false });

  const actionLabel = action.toUpperCase();
  const title = `${actionLabel} Signal — ${ticker}`;
  const description = `A **${actionLabel}** signal was received for **${ticker}**${price !== null ? ` at ${formatPrice(price)}` : ""}.`;

  await sendDiscordAlert(
    { title, description, color: getColor(action), fields },
    ticker,
    true,
  );

  res.json({ ok: true, message: "Alert sent to Discord." });
});

router.get("/traderspost/webhook", (_req: Request, res: Response) => {
  res.json({ ok: true, message: "TradersPost webhook endpoint is live." });
});

export default router;
