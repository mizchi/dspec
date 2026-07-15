# sample-webapp-2026 spec

- model: `sample-webapp-2026`
- version: `0.1.0`
- locale: `en`

## Review Summary

- approvedRules: `4`
- automatedCheckTargets: `0`
- implementationRefs: `11`
- projections: `1`
- domainElements: `29`
- runtimeEvidenceRecords: `4`
- assuranceTargets: `reference=0, executed=0, mutation-tested=0, bounded=0, proved=0`

## Projections

### sample-webapp-markdown

- kind: `markdown`
- source: `self`
- matrix: `locales`
- output: `generated/examples/{locale}/sample-webapp-2026.md`
- freshness: `exact`

## Vocabulary

- `data.dashboard-snapshot` (entity): dashboard snapshot
- `data.incident` (entity): incident
- `data.service-detail` (entity): service detail
- `dependency.dashboard-to-api` (relation): dashboard runtime API dependency
- `flow.api-to-contracts` (relation): API to contracts
- `flow.api-to-dashboard-data` (relation): API to dashboard data
- `flow.ci-to-flaker-data` (relation): CI to flaker data
- `flow.dashboard-to-api` (relation): dashboard to API
- `flow.github-actions-to-flaker` (relation): GitHub Actions to flaker
- `flow.github-actions-to-vrt` (relation): GitHub Actions to VRT
- `flow.public-to-dashboard` (relation): public client to dashboard
- `node.api` (entity): Hono API
- `node.contracts` (entity): shared Zod contracts
- `node.dashboard` (entity): React dashboard
- `node.flaker` (entity): flaker runner
- `node.github-actions` (entity): GitHub Actions
- `node.public-client` (actor): public client
- `node.vrt` (entity): VRT runner
- `release.step.ci` (action): CI workflow
- `release.step.weekly-review` (action): weekly review workflow
- `service.api` (entity): API service
- `service.dashboard` (entity): dashboard service
- `slo.dashboard-availability` (quantity): dashboard availability
- `store.api-memory` (entity): API in-memory data
- `store.dashboard-cache` (entity): dashboard cache
- `store.flaker-duckdb` (entity): flaker DuckDB
- `store.github-actions-artifacts` (entity): GitHub Actions artifacts

## Rules

### SAMPLE-CLOUD-TOPOLOGY

Dashboard/API/contracts and CI runner connectivity follows explicit topology

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `flow.api-to-contracts`
- term: `flow.dashboard-to-api`
- term: `flow.github-actions-to-flaker`
- term: `flow.github-actions-to-vrt`
- term: `flow.public-to-dashboard`
- term: `node.api`
- term: `node.contracts`
- term: `node.dashboard`
- term: `node.flaker`
- term: `node.github-actions`
- term: `node.public-client`
- term: `node.vrt`
- must: `public-client -> dashboard -> api -> contracts`
- must: `github-actions -> flaker && github-actions -> vrt`
- implementation: code fixtures/sample-webapp-2026/apps/api/src/app.ts#app
- implementation: model fixtures/sample-webapp-2026/playwright.config.ts
- implementation: model fixtures/sample-webapp-2026/flaker.toml
- implementation: model fixtures/sample-webapp-2026/vrt.config.json

#### Review

- source: model.rules[0]
- coverage: rule
- automatedChecks: 0
- implementationRefs: 4
- selector: SAMPLE-CLOUD-TOPOLOGY.must[0]
- selector: SAMPLE-CLOUD-TOPOLOGY.must[1]

### SAMPLE-DATA-CONTRACT

Dashboard data shapes are grounded in the contracts package and API schema

- kind: invariant
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `data.dashboard-snapshot`
- term: `data.incident`
- term: `data.service-detail`
- term: `flow.api-to-dashboard-data`
- term: `flow.ci-to-flaker-data`
- term: `store.api-memory`
- term: `store.dashboard-cache`
- term: `store.flaker-duckdb`
- term: `store.github-actions-artifacts`
- must: `dashboardSnapshotSchema && serviceDetailSchema`
- implementation: code fixtures/sample-webapp-2026/packages/contracts/src/index.ts#dashboardSnapshotSchema
- implementation: code fixtures/sample-webapp-2026/packages/contracts/src/index.ts#serviceDetailSchema
- implementation: model fixtures/sample-webapp-2026/apps/api/src/app.ts

#### Review

- source: model.rules[1]
- coverage: rule
- automatedChecks: 0
- implementationRefs: 3
- selector: SAMPLE-DATA-CONTRACT.must[0]

### SAMPLE-RELEASE-SAFETY

API and dashboard releases are continuously checked by CI and weekly review

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `release.step.ci`
- term: `release.step.weekly-review`
- term: `service.api`
- term: `service.dashboard`
- must: `ci runs typecheck, unit, e2e, and vrt`
- must: `weekly-review aggregates quality signals`
- implementation: model fixtures/sample-webapp-2026/.github/workflows/ci.yml
- implementation: model fixtures/sample-webapp-2026/.github/workflows/weekly-review.yml

#### Review

- source: model.rules[2]
- coverage: rule
- automatedChecks: 0
- implementationRefs: 2
- selector: SAMPLE-RELEASE-SAFETY.must[0]
- selector: SAMPLE-RELEASE-SAFETY.must[1]

### SAMPLE-RUNTIME-SAFETY

The dashboard owns the API dependency and availability SLO as runtime model facts

- kind: obligation
- status: approved
- priority: 100
- requiredAssurances: reference
- term: `dependency.dashboard-to-api`
- term: `service.api`
- term: `service.dashboard`
- term: `slo.dashboard-availability`
- must: `dashboard dependency has timeout and retry contract`
- must: `dashboard availability has alert and telemetry evidence`
- implementation: model fixtures/sample-webapp-2026/apps/dashboard/src/App.tsx
- implementation: model fixtures/sample-webapp-2026/apps/api/src/app.ts

#### Review

- source: model.rules[3]
- coverage: rule
- automatedChecks: 0
- implementationRefs: 2
- selector: SAMPLE-RUNTIME-SAFETY.must[0]
- selector: SAMPLE-RUNTIME-SAFETY.must[1]

## Cloud Topology

### Cloud Zone ci

- exposure: `private`

### Cloud Zone private

- exposure: `private`

### Cloud Zone public

- exposure: `public`

### Cloud Node api

- kind: `service`
- zone: `private`
- tenantScoped: `false`

### Cloud Node contracts

- kind: `service`
- zone: `private`
- tenantScoped: `false`

### Cloud Node dashboard

- kind: `service`
- zone: `public`
- tenantScoped: `false`

### Cloud Node flaker

- kind: `service`
- zone: `ci`
- tenantScoped: `false`

### Cloud Node github-actions

- kind: `service`
- zone: `ci`
- tenantScoped: `false`

### Cloud Node public-client

- kind: `internet`
- zone: `public`
- tenantScoped: `false`

### Cloud Node vrt

- kind: `service`
- zone: `ci`
- tenantScoped: `false`

### Cloud Flow api-to-contracts

- from: `api`
- to: `contracts`
- action: `validate`
- tenantPropagated: `false`

### Cloud Flow dashboard-to-api

- from: `dashboard`
- to: `api`
- action: `request`
- tenantPropagated: `false`

### Cloud Flow github-actions-to-flaker

- from: `github-actions`
- to: `flaker`
- action: `run`
- tenantPropagated: `false`

### Cloud Flow github-actions-to-vrt

- from: `github-actions`
- to: `vrt`
- action: `snapshot`
- tenantPropagated: `false`

### Cloud Flow public-to-dashboard

- from: `public-client`
- to: `dashboard`
- action: `request`
- tenantPropagated: `false`

## Data Governance

### Data Policy operational-policy

- classification: `internal`
- maxRetentionDays: `90`

### Data Policy public-policy

- classification: `public`
- maxRetentionDays: `365`

### Data Set dashboard-snapshot

- classification: `public`
- retentionDays: `30`

### Data Set incident

- classification: `internal`
- retentionDays: `90`

### Data Set service-detail

- classification: `internal`
- retentionDays: `90`

### Data Store api-memory

- region: `local`
- encrypted: `true`
- deletionSupported: `true`

### Data Store dashboard-cache

- region: `local`
- encrypted: `true`
- deletionSupported: `true`

### Data Store flaker-duckdb

- region: `local`
- encrypted: `true`
- deletionSupported: `true`

### Data Store github-actions-artifacts

- region: `local`
- encrypted: `true`
- deletionSupported: `true`

### Data Flow api-to-dashboard-data

- dataset: `dashboard-snapshot`
- from: `api-memory`
- to: `dashboard-cache`
- purpose: `operator-dashboard`

### Data Flow ci-to-flaker-data

- dataset: `incident`
- from: `github-actions-artifacts`
- to: `flaker-duckdb`
- purpose: `quality-signal`
- legalBasis: `operational-need`

## Release Safety

### Release Service api

- critical: `true`

### Release Service dashboard

- critical: `true`

### Release Environment ci

- production: `false`

### Release Gate e2e

- kind: `test`

### Release Gate typecheck

- kind: `test`

### Release Gate unit

- kind: `test`

### Release Gate vrt

- kind: `test`

### Release Rollback api-manual-revert

- service: `api`
- tested: `true`

### Release Rollback manual-revert

- service: `dashboard`
- tested: `true`

### Release Step ci

- service: `dashboard`
- environment: `ci`
- strategy: `rolling`
- trafficPercent: `0`
- rollback: `manual-revert`
- gate: `e2e`
- gate: `typecheck`
- gate: `unit`
- gate: `vrt`

### Release Step weekly-review

- service: `api`
- environment: `ci`
- strategy: `rolling`
- trafficPercent: `0`
- rollback: `api-manual-revert`
- gate: `e2e`
- gate: `unit`

## Runtime Safety

### Runtime Service api

- critical: `true`

### Runtime Service dashboard

- critical: `true`

### Runtime Dependency dashboard-to-api

- service: `dashboard`
- target: `api`
- kind: `http`
- timeoutMs: `2000`
- retryable: `true`
- idempotent: `true`

### Runtime Signal dashboard-availability-signal

- service: `dashboard`
- kind: `metric`
- indicator: `availability`

### Runtime Runbook dashboard-runbook

- service: `dashboard`
- tested: `true`

### Runtime Alert dashboard-availability-page

- service: `dashboard`
- signal: `dashboard-availability-signal`
- severity: `page`
- runbook: `dashboard-runbook`

### Runtime SLO dashboard-availability

- service: `dashboard`
- indicator: `availability`
- targetPercent: `99`
- window: `30d`

### Runtime Telemetry dashboard-availability-30d

- service: `dashboard`
- signal: `dashboard-availability-signal`
- slo: `dashboard-availability`
- observedPercent: `100`
- source: `sample-webapp-2026:e2e`

### Runtime Alert Policy dashboard-availability-policy

- alert: `dashboard-availability-page`
- enabled: `true`
- source: `sample-webapp-2026:weekly-review`

### Runtime Runbook Execution dashboard-runbook-weekly

- runbook: `dashboard-runbook`
- status: `pass`
- executedAt: `2026-07-10`
- source: `sample-webapp-2026:weekly-review`

### Runtime Dependency Trace dashboard-to-api-e2e

- dependency: `dashboard-to-api`
- observedLatencyMs: `120`
- timedOut: `false`
- idempotencyKeyObserved: `true`
- source: `sample-webapp-2026:e2e`

## Decisions
