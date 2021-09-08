import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance as nodePerformance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

import {createRunDirectory,sourceIdentity} from "./benchmark-output";
import {projectRoot} from "./runtime-config";
function assets(
  dir: string,
): { file: string; bytes: number; gzipBytes: number }[] {
  return readdirSync(dir).flatMap((file) => {
    const full = path.join(dir, file);
    if (statSync(full).isDirectory()) return assets(full);
    if (!/\.(js|html)$/.test(full)) return [];
    const data = readFileSync(full);
    return [
      { file: full, bytes: data.length, gzipBytes: gzipSync(data).length },
    ];
  });
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
}
async function ready(child: ChildProcess) {
  for (let tries = 0; tries < 80; tries++) {
    if (child.exitCode !== null)
      throw new Error(
        `Demo server exited with ${child.exitCode}; check the ports.`,
      );
    try {
      const response = await fetch("http://127.0.0.1:4310/api/health");
      if (response.ok) return;
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Demo server failed to become ready.");
}
async function main() {
  const outputDirectory=createRunDirectory(process.argv.slice(2));
  const source=sourceIdentity();
  const output=path.join(outputDirectory,"performance.json");
  for (const port of [4310, 4311, 4312, 4313]) {
    try {
      await fetch(`http://127.0.0.1:${port}`, {
        signal: AbortSignal.timeout(300),
      });
      throw new Error(
        `Port ${port} is occupied. Stop the local demo before benchmarking.`,
      );
    } catch (error) {
      if ((error as Error).message.includes("occupied")) throw error;
    }
  }
  const builds: Record<string, unknown> = {};
  for (const variant of ["baseline", "optimized"]) {
    const start = nodePerformance.now();
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/webpack-cli/bin/cli.js",
        "--config",
        "webpack.config.cjs",
        "--mode",
        "production",
        ...(variant === "baseline" ? ["--env", "baseline=1"] : []),
      ],
      { encoding: "utf8", cwd:projectRoot },
    );
    writeFileSync(
      path.join(outputDirectory,`build-${variant}.txt`),
      result.stdout + result.stderr,
    );
    if (result.status !== 0)
      throw new Error(`${variant} build failed: ${result.stderr}`);
    const files = assets(path.join(projectRoot,`dist/${variant}`));
    builds[variant] = {
      wallMs: Math.round(nodePerformance.now() - start),
      assetBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
      assets: files,
    };
  }
  const browser = await chromium.launch();
  const observations: unknown[] = [];
  try {
    for (const variant of ["baseline", "optimized"]) {
      const server = spawn(
        process.execPath,
        ["--import", "tsx", "scripts/serve.ts"],
        {
          cwd:projectRoot,
          env: { ...process.env, BUILD_VARIANT: variant },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let serverLog = "";
      server.stdout?.on("data", (chunk) => {
        serverLog += chunk.toString();
      });
      server.stderr?.on("data", (chunk) => {
        serverLog += chunk.toString();
      });
      try {
        await ready(server);
        for (let sample = 1; sample <= 3; sample++) {
          const context = await browser.newContext({
            viewport: { width: 1440, height: 1050 },
          });
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.addInitScript(() => {
            (window as unknown as { __lcp: number }).__lcp = 0;
            new PerformanceObserver((list) => {
              const last = list.getEntries().at(-1);
              if (last)
                (window as unknown as { __lcp: number }).__lcp = last.startTime;
            }).observe({ type: "largest-contentful-paint", buffered: true });
          });
          const start = nodePerformance.now();
          await page.goto("http://127.0.0.1:4310");
          await page
            .getByRole("button", { name: "Add Everyday notebook" })
            .waitFor();
          const catalogReadyMs = nodePerformance.now() - start;
          await page.waitForLoadState("networkidle");
          const startup = await page.evaluate(() => ({
            fcpMs:
              performance.getEntriesByName("first-contentful-paint")[0]
                ?.startTime ?? null,
            lcpMs: (window as unknown as { __lcp: number }).__lcp,
            resources: performance.getEntriesByType("resource").map((entry) => {
              const resource = entry as PerformanceResourceTiming;
              return {
                url: resource.name,
                transferBytes: resource.transferSize,
                encodedBytes: resource.encodedBodySize,
                durationMs: resource.duration,
              };
            }),
          }));
          const bagStart = nodePerformance.now();
          await page.getByRole("button", { name: "Bag (0)" }).click();
          await page
            .getByText("Your next everyday favorite is waiting.")
            .waitFor();
          const bagReadyMs = nodePerformance.now() - bagStart;
          await page.waitForLoadState("networkidle");
          const allResources = await page.evaluate(() =>
            performance.getEntriesByType("resource").map((entry) => {
              const resource = entry as PerformanceResourceTiming;
              return {
                url: resource.name,
                transferBytes: resource.transferSize,
                encodedBytes: resource.encodedBodySize,
                durationMs: resource.duration,
              };
            }),
          );
          observations.push({
            variant,
            sample,
            catalogReadyMs,
            bagReadyMs,
            startup,
            allResources,
            pageErrors: errors,
          });
          if (errors.length)
            throw new Error(
              `Healthy ${variant} page errors: ${errors.join("; ")}`,
            );
          await context.close();
        }
      } finally {
        await stop(server);
        writeFileSync(path.join(outputDirectory,`serve-${variant}.txt`), serverLog);
      }
    }
    const report = {
      source,
      measuredAt: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpu: os.cpus()[0]?.model,
        chromium: browser.version(),
        viewport: "1440x1050",
        network:
          "Unthrottled loopback HTTP; no-store; fresh browser context per sample",
        sampleCountPerVariant: 3,
      },
      builds,
      observations,
    };
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(
      `Wrote ${output}. ${observations.length} page observations; both variants completed without page errors.`,
    );
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
