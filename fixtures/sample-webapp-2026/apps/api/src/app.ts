import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  dashboardFilterSchema,
  dashboardSnapshotSchema,
  healthResponseSchema,
  serviceDetailSchema,
} from "../../../packages/contracts/src/index.ts";
import { buildDashboardSnapshot, getServiceDetail } from "./data/dashboard-data.ts";

const dashboardDistDir = resolve(import.meta.dirname, "../../dashboard/dist");
const dashboardBundleAvailable = existsSync(dashboardDistDir);

export const app = new Hono();

app.get("/api/health", (c) =>
  c.json(
    healthResponseSchema.parse({
      status: "ok",
      service: "sample-webapp-2026",
    }),
  ));

app.get("/api/dashboard", (c) => {
  const severity = dashboardFilterSchema.catch("all").parse(c.req.query("severity") ?? "all");
  const payload = buildDashboardSnapshot(severity);
  return c.json(dashboardSnapshotSchema.parse(payload));
});

app.get("/api/services/:serviceId", (c) => {
  const detail = getServiceDetail(c.req.param("serviceId"));
  if (!detail) {
    return c.json({ message: "Service not found" }, 404);
  }
  return c.json(serviceDetailSchema.parse(detail));
});

if (dashboardBundleAvailable) {
  app.use("/assets/*", serveStatic({ root: dashboardDistDir }));

  app.get("*", async (c) => {
    const html = await readFile(resolve(dashboardDistDir, "index.html"), "utf-8");
    return c.html(html);
  });
} else {
  app.get("*", (c) =>
    c.html(
      [
        "<!doctype html>",
        "<html><body style=\"font-family:sans-serif;padding:24px\">",
        "<h1>sample-webapp-2026</h1>",
        "<p>Dashboard assets are not built yet. Run <code>pnpm build</code> for the static bundle, or <code>pnpm dev</code> for the Vite dev server.</p>",
        "</body></html>",
      ].join(""),
    ));
}
