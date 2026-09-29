import express from "express";
import http from "node:http";
import path from "node:path";
import { createApp } from "../apps/api/app";

const variant =
  process.env.BUILD_VARIANT === "baseline" ? "baseline" : "optimized";
const servers: http.Server[] = [];
const api = createApp();
servers.push(api.listen(4313, "127.0.0.1"));
for (const [name, port] of [
  ["host", 4310],
  ["catalog", 4311],
  ["cart", 4312],
] as const) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Timing-Allow-Origin", "*");
    next();
  });
  if (name === "host")
    app.use("/api", (req, res) => {
      const proxy = http.request(
        {
          hostname: "127.0.0.1",
          port: 4313,
          path: req.originalUrl,
          method: req.method,
          headers: { ...req.headers, host: "127.0.0.1:4313" },
        },
        (response) => {
          res.writeHead(response.statusCode || 502, response.headers);
          response.pipe(res);
        },
      );
      proxy.setTimeout(4500, () => proxy.destroy(new Error("timeout")));
      proxy.on("error", () => {
        if (!res.headersSent)
          res
            .status(503)
            .json({
              code: "API_UNAVAILABLE",
              error:
                "The demo service is unavailable. Your bag is saved; try again shortly.",
            });
      });
      req.pipe(proxy);
    });
  app.use(express.static(path.resolve("dist", variant, name)));
  servers.push(app.listen(port, "127.0.0.1"));
}
for (const server of servers)
  server.on("error", (error) => {
    console.error(error.message);
    shutdown(1);
  });
function shutdown(code = 0) {
  for (const server of servers) server.close();
  setTimeout(() => process.exit(code), 150).unref();
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
console.log(
  `Fieldwork Supply (${variant}): http://127.0.0.1:4310 | catalog :4311 | cart :4312 | API :4313. Synthetic local demo.`,
);
