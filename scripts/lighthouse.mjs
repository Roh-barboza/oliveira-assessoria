import { mkdir, writeFile } from "node:fs/promises";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/lr-desktop-config.js";
import { launch } from "chrome-launcher";
const dir = process.env.EVIDENCE_DIR || "test-results/lighthouse";
const url = process.env.BASE_URL || "http://127.0.0.1:4175";
await mkdir(dir, { recursive: true });
let server;
if (!process.env.BASE_URL) ({ server } = await import("./serve.mjs"));
const summary = [];
try {
  for (const mode of ["mobile", "desktop"])
    for (let run = 1; run <= 3; run++) {
      const chrome = await launch({
        chromePath: process.env.CHROME_PATH || "/usr/bin/chromium",
        chromeFlags: [
          "--headless",
          "--no-sandbox",
          ...(process.env.IGNORE_CERT_ERRORS === "1"
            ? ["--ignore-certificate-errors"]
            : []),
        ],
      });
      try {
        const result = await lighthouse(
          url,
          {
            port: chrome.port,
            output: "json",
            logLevel: "error",
            onlyCategories: [
              "performance",
              "accessibility",
              "best-practices",
              "seo",
            ],
          },
          mode === "desktop" ? desktopConfig : undefined,
        );
        await writeFile(`${dir}/${mode}-${run}.json`, result.report);
        const row = {
          mode,
          run,
          url,
          fetchTime: result.lhr.fetchTime,
          lighthouseVersion: result.lhr.lighthouseVersion,
          scores: Object.fromEntries(
            Object.entries(result.lhr.categories).map(([key, value]) => [
              key,
              Math.round(value.score * 100),
            ]),
          ),
          metrics: Object.fromEntries(
            [
              "first-contentful-paint",
              "largest-contentful-paint",
              "total-blocking-time",
              "cumulative-layout-shift",
              "speed-index",
            ].map((k) => [k, result.lhr.audits[k].numericValue]),
          ),
          settings: result.lhr.configSettings,
          warnings: result.lhr.runWarnings,
        };
        summary.push(row);
        console.log(mode, run, row.scores, row.metrics);
      } finally {
        await chrome.kill();
      }
    }
  await writeFile(`${dir}/summary.json`, JSON.stringify(summary, null, 2));
} finally {
  server?.close();
}
