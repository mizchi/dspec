# App Profile Evaluation sample-webapp-2026-extended-scenarios

- modelPath: `examples/sample-webapp-2026.pkl`
- appRoot: `fixtures/sample-webapp-2026`
- status: `pass`
- passed: `13/13`

| Scenario | Kind | Guard | Expected | Actual | Status | Suggestion Kind | Mutation | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | baseline-no-drift | false-positive | pass | pass | pass |  |  |  |
| release-gate-missing-vrt | remove-release-gate | false-negative | fail | fail | pass | implementation-missing | {"removedGate":"vrt","step":"ci"} | missing observed release gate: ci -> vrt |
| release-gate-add-security | add-observed-release-gate | false-negative | fail | fail | pass | spec-missing | {"addedGate":"security","workflow":"ci"} | unmodeled observed fact: release.gate security at observed.domain.release.gates[1] |
| route-missing-dashboard | remove-route | false-negative | fail | fail | pass | implementation-missing | {"removedRoute":"/api/dashboard"} | missing observed route: /api/dashboard |
| route-add-admin | add-observed-route | false-negative | fail | fail | pass | spec-missing | {"addedRoute":"/api/admin"} | unmodeled observed route: /api/admin |
| schema-missing-dashboard-snapshot | remove-contract-schema | false-negative | fail | fail | pass | implementation-missing | {"removedSchema":"dashboardSnapshotSchema"} | missing observed data dataset: dashboard-snapshot<br>missing observed data flow: api-to-dashboard-data |
| schema-add-audit-log | add-observed-contract-schema | false-negative | fail | fail | pass | spec-missing | {"addedSchema":"auditLogSchema"} | unmodeled observed contract schema: auditLogSchema |
| workflow-missing-weekly-review | remove-workflow | false-negative | fail | fail | pass | implementation-missing | {"removedWorkflow":"weekly-review"} | missing observed release step: weekly-review<br>missing observed release gate: weekly-review -> unit<br>missing observed release gate: weekly-review -> e2e |
| workflow-add-nightly | add-observed-workflow | false-negative | fail | fail | pass | spec-missing | {"addedWorkflow":"nightly"} | unmodeled observed fact: release.step nightly at observed.domain.release.steps[1] |
| store-missing-flaker-duckdb | remove-data-store | false-negative | fail | fail | pass | implementation-missing | {"removedStore":"flaker-duckdb"} | missing observed data store: flaker-duckdb |
| store-add-audit-log | add-observed-data-store | false-negative | fail | fail | pass | spec-missing | {"addedStore":"audit-log"} | unmodeled observed fact: data.store audit-log at observed.domain.data.stores[1] |
| dependency-missing-dashboard-api | remove-runtime-dependency | false-negative | fail | fail | pass | implementation-missing | {"removedDependency":"dashboard-to-api"} | missing observed runtime dependency: dashboard-to-api |
| dependency-add-worker-api | add-observed-runtime-dependency | false-negative | fail | fail | pass | spec-missing | {"addedDependency":"worker-to-api"} | unmodeled observed fact: runtime.dependency worker-to-api at observed.domain.runtime.dependencies[1] |
