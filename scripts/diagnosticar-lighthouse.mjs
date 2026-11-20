import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const dir = resolve(process.env.EVIDENCE_DIR || "test-results/lighthouse");
const files = (await readdir(dir)).filter((name) =>
  /^(mobile|desktop)-\d+\.json$/.test(name),
);
if (files.length === 0) {
  console.error("Nenhum relatório Lighthouse encontrado em:", dir);
  process.exitCode = 1;
} else {
  const rows = [];
  const median = (numbers) => {
    if (!numbers.length) return null;
    const sorted = [...numbers].sort((a, b) => a - b);
    const m = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
  };
  const round = (value) =>
    Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  const safe = (value) => {
    if (!value || typeof value !== "string") return "(sem URL)";
    try {
      const u = new URL(value);
      return u.origin + u.pathname;
    } catch {
      return value.slice(0, 140);
    }
  };

  for (const file of files.sort()) {
    const raw = JSON.parse(await readFile(resolve(dir, file), "utf8"));
    const lhr = raw.lhr || raw;
    const audits = lhr.audits || {};
    const metric = (key) => round(audits[key]?.numericValue);
    const tasks = (audits["long-tasks"]?.details?.items || [])
      .map((task) => ({
        durationMs: round(task.duration),
        startTimeMs: round(task.startTime),
        url: safe(task.url),
      }))
      .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
      .slice(0, 8);
    const mainThread = (audits["mainthread-work-breakdown"]?.details?.items || [])
      .map((item) => ({ category: item.groupLabel || item.group || "Outros", durationMs: round(item.duration) }))
      .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
      .slice(0, 8);
    const scripts = (audits["bootup-time"]?.details?.items || [])
      .map((item) => ({
        url: safe(item.url),
        totalMs: round(item.total),
        scriptingMs: round(item.scripting),
      }))
      .sort((a, b) => (b.totalMs ?? 0) - (a.totalMs ?? 0))
      .slice(0, 8);
    rows.push({
      file,
      mode: file.split("-")[0],
      lighthouseVersion: lhr.lighthouseVersion,
      scores: Object.fromEntries(
        Object.entries(lhr.categories || {}).map(([key, value]) => [
          key,
          round((value.score ?? 0) * 100),
        ]),
      ),
      metrics: {
        fcpMs: metric("first-contentful-paint"),
        lcpMs: metric("largest-contentful-paint"),
        tbtMs: metric("total-blocking-time"),
        cls: metric("cumulative-layout-shift"),
        speedIndexMs: metric("speed-index"),
      },
      longTasks: tasks,
      mainThread,
      scripts,
      warnings: lhr.runWarnings || [],
    });
  }
  const grouped = Object.fromEntries(
    ["mobile", "desktop"].map((mode) => {
      const runs = rows.filter((r) => r.mode === mode);
      return [mode, {
        runs: runs.length,
        scores: runs.map((r) => r.scores.performance),
        medianPerformance: median(runs.map((r) => r.scores.performance).filter(Number.isFinite)),
        tbtMs: runs.map((r) => r.metrics.tbtMs),
        medianTbtMs: median(runs.map((r) => r.metrics.tbtMs).filter(Number.isFinite)),
        lcpMs: runs.map((r) => r.metrics.lcpMs),
        medianLcpMs: median(runs.map((r) => r.metrics.lcpMs).filter(Number.isFinite)),
        longestTasks: runs.flatMap((r) => r.longTasks)
          .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
          .slice(0, 6),
        topScriptCost: runs.flatMap((r) => r.scripts)
          .sort((a, b) => (b.totalMs ?? 0) - (a.totalMs ?? 0))
          .slice(0, 6),
        topMainThreadWork: runs.flatMap((r) => r.mainThread)
          .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
          .slice(0, 6),
      }];
    }),
  );
  const result = { summary: grouped, runs: rows };
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, "diagnostico.json"), JSON.stringify(result, null, 2));
  console.log("Lighthouse local - diagnóstico de desempenho (dados sem secrets)");
  console.log(JSON.stringify(grouped, null, 2));
  if (grouped.mobile.runs < 3) {
    console.log("Amostra mobile pequena: para comparar variabilidade, execute 3 coletas isoladas.");
  }
  console.log("Relatório detalhado local: test-results/lighthouse/diagnostico.json");
}
