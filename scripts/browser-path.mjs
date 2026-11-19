import { existsSync } from "node:fs";
import { chromium } from "playwright";

// Prefer the explicit override, preserve the known Linux runner, and otherwise
// use the Playwright-managed Chromium (Windows/macOS/Linux supported).
export function browserExecutablePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === "linux" && existsSync("/usr/bin/chromium"))
    return "/usr/bin/chromium";
  return chromium.executablePath();
}
