# Spec Reading Evaluation sample-webapp-reading-eval

- status: `pass`
- modelPath: `../examples/sample-webapp-2026.pkl`
- locale: `ja`
- score: `7/7`
- evidence score: `7/7`
- gold fix candidates: `0`

## Subagent Run

- answersFile: `fixtures/spec-reading-eval-answers.json`
- answerCount: `7`
- missingAnswers: `0`
- unexpectedAnswers: `0`

| Case | Expected | Actual | Label | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| cloud-topology | entailed | entailed | pass | gold: rule:SAMPLE-CLOUD-TOPOLOGY<br>clause:SAMPLE-CLOUD-TOPOLOGY#must[0]<br>answer: rule:SAMPLE-CLOUD-TOPOLOGY<br>overlap: rule:SAMPLE-CLOUD-TOPOLOGY | pass |
| runtime-slo | entailed | entailed | pass | gold: rule:SAMPLE-RUNTIME-SAFETY<br>term:slo.dashboard-availability<br>answer: rule:SAMPLE-RUNTIME-SAFETY<br>overlap: rule:SAMPLE-RUNTIME-SAFETY | pass |
| ci-weekly-review | entailed | entailed | pass | gold: rule:SAMPLE-RELEASE-SAFETY<br>clause:SAMPLE-RELEASE-SAFETY#must[1]<br>answer: rule:SAMPLE-RELEASE-SAFETY<br>overlap: rule:SAMPLE-RELEASE-SAFETY | pass |
| database-primary-store | contradicted | contradicted | pass | gold: rule:SAMPLE-DATA-CONTRACT<br>term:store.api-memory<br>answer: term:store.api-memory<br>overlap: term:store.api-memory | pass |
| payment-release-gate | contradicted | contradicted | pass | gold: rule:SAMPLE-RELEASE-SAFETY<br>term:release.step.ci<br>answer: rule:SAMPLE-RELEASE-SAFETY<br>overlap: rule:SAMPLE-RELEASE-SAFETY | pass |
| latency-budget | contradicted | contradicted | pass | gold: rule:SAMPLE-RUNTIME-SAFETY<br>term:dependency.dashboard-to-api<br>answer: rule:SAMPLE-RUNTIME-SAFETY<br>term:dependency.dashboard-to-api<br>overlap: rule:SAMPLE-RUNTIME-SAFETY<br>term:dependency.dashboard-to-api | pass |
| slo-owner | not-supported | not-supported | pass | gold: <br>answer: <br>overlap:  | pass |
