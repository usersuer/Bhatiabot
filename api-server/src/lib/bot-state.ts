import fs from "fs";
import path from "path";
import { logger } from "./logger";

const STATE_FILE = path.resolve(process.cwd(), "bot-state.json");

interface Warning {
  reason: string;
  timestamp: string;
  moderatorId: string;
  moderatorTag: string;
}

interface UserXP {
  xp: number;
  level: number;
  lastDaily: string | null;
}

interface BotState {
  muted: boolean;
  tickerFilter: string[];
  warnings: Record<string, Warning[]>;
  xp: Record<string, UserXP>;
}

const DEFAULT_STATE: BotState = {
  muted: false,
  tickerFilter: [],
  warnings: {},
  xp: {},
};

function loadState(): BotState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw) as Partial<BotState>;
      return {
        muted: typeof parsed.muted === "boolean" ? parsed.muted : false,
        tickerFilter: Array.isArray(parsed.tickerFilter) ? parsed.tickerFilter : [],
        warnings: parsed.warnings && typeof parsed.warnings === "object" ? parsed.warnings : {},
        xp: parsed.xp && typeof parsed.xp === "object" ? parsed.xp : {},
      };
    }
  } catch (err) {
    logger.warn({ err }, "Could not load bot state, using defaults");
  }
  return { ...DEFAULT_STATE };
}

function saveState(state: BotState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err }, "Failed to save bot state");
  }
}

let state = loadState();

export function isMuted(): boolean {
  return state.muted;
}

export function setMuted(value: boolean): void {
  state.muted = value;
  saveState(state);
}

export function getTickerFilter(): string[] {
  return [...state.tickerFilter];
}

export function addTickerFilter(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  if (state.tickerFilter.includes(upper)) return false;
  state.tickerFilter.push(upper);
  saveState(state);
  return true;
}

export function removeTickerFilter(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  const idx = state.tickerFilter.indexOf(upper);
  if (idx === -1) return false;
  state.tickerFilter.splice(idx, 1);
  saveState(state);
  return true;
}

export function clearTickerFilter(): void {
  state.tickerFilter = [];
  saveState(state);
}

export function isTickerAllowed(ticker: string): boolean {
  if (state.tickerFilter.length === 0) return true;
  return state.tickerFilter.includes(ticker.toUpperCase());
}

export function addWarning(userId: string, reason: string, moderatorId: string, moderatorTag: string): Warning[] {
  if (!state.warnings[userId]) state.warnings[userId] = [];
  const warning: Warning = { reason, timestamp: new Date().toISOString(), moderatorId, moderatorTag };
  state.warnings[userId].push(warning);
  saveState(state);
  return state.warnings[userId];
}

export function getWarnings(userId: string): Warning[] {
  return state.warnings[userId] ?? [];
}

export function clearWarnings(userId: string): void {
  delete state.warnings[userId];
  saveState(state);
}

export function getXP(userId: string): UserXP {
  return state.xp[userId] ?? { xp: 0, level: 1, lastDaily: null };
}

export function addXP(userId: string, amount: number): UserXP {
  const current = getXP(userId);
  current.xp += amount;
  const newLevel = Math.floor(0.1 * Math.sqrt(current.xp)) + 1;
  current.level = newLevel;
  state.xp[userId] = current;
  saveState(state);
  return current;
}

export function claimDaily(userId: string): { claimed: boolean; xp: UserXP; alreadyClaimed: boolean } {
  const entry = getXP(userId);
  const now = new Date();
  if (entry.lastDaily) {
    const last = new Date(entry.lastDaily);
    const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) return { claimed: false, xp: entry, alreadyClaimed: true };
  }
  entry.xp += 100;
  entry.level = Math.floor(0.1 * Math.sqrt(entry.xp)) + 1;
  entry.lastDaily = now.toISOString();
  state.xp[userId] = entry;
  saveState(state);
  return { claimed: true, xp: entry, alreadyClaimed: false };
}

export function getLeaderboard(): Array<{ userId: string; xp: number; level: number }> {
  return Object.entries(state.xp)
    .map(([userId, data]) => ({ userId, xp: data.xp, level: data.level }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);
}
