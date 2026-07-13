import { z } from "zod";

export const dashboardFilterSchema = z.enum(["all", "critical", "warning", "watch"]);
export type DashboardFilter = z.infer<typeof dashboardFilterSchema>;

export const metricStatusSchema = z.enum(["good", "attention", "critical"]);
export type MetricStatus = z.infer<typeof metricStatusSchema>;

export const summaryMetricSchema = z.object({
  id: z.string(),
  title: z.string(),
  value: z.string(),
  delta: z.string(),
  caption: z.string(),
  status: metricStatusSchema,
});
export type SummaryMetric = z.infer<typeof summaryMetricSchema>;

export const deploymentPointSchema = z.object({
  label: z.string(),
  deployed: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
});
export type DeploymentPoint = z.infer<typeof deploymentPointSchema>;

export const incidentSeveritySchema = z.enum(["critical", "warning", "watch"]);
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;

export const incidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  severity: incidentSeveritySchema,
  owner: z.string(),
  openedAt: z.string(),
  status: z.enum(["open", "mitigating", "stable"]),
  note: z.string(),
});
export type Incident = z.infer<typeof incidentSchema>;

export const serviceCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
  status: metricStatusSchema,
  latencyMs: z.number().nonnegative(),
  errorRate: z.number().nonnegative(),
  saturation: z.number().min(0).max(1),
  changeBudget: z.number().int().nonnegative(),
});
export type ServiceCard = z.infer<typeof serviceCardSchema>;

export const recommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  action: z.string(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const dashboardSnapshotSchema = z.object({
  generatedAt: z.string(),
  severity: dashboardFilterSchema,
  summary: z.array(summaryMetricSchema),
  deploymentSeries: z.array(deploymentPointSchema),
  incidents: z.array(incidentSchema),
  services: z.array(serviceCardSchema),
  recommendations: z.array(recommendationSchema),
});
export type DashboardSnapshot = z.infer<typeof dashboardSnapshotSchema>;

export const serviceDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
  status: metricStatusSchema,
  latencyMs: z.number().nonnegative(),
  errorRate: z.number().nonnegative(),
  saturation: z.number().min(0).max(1),
  changeBudget: z.number().int().nonnegative(),
  runbook: z.string().url(),
  notes: z.array(z.string()),
  releases: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      startedAt: z.string(),
      status: z.enum(["running", "blocked", "complete"]),
    }),
  ),
});
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
