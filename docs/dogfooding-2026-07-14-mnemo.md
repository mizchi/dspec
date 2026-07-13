# External Dogfooding: mnemo 2026-07-14

## Scope

This pass evaluates `dspec import-real-app` against a second repository rather
than dspec's self model or the original sample web app.

- source: `https://github.com/mizchi/mnemo`
- source commit: `5cbf27107339dbbf92546065f3df5b6dec9dddce`
- holdout: `fixtures/holdout-mnemo-app`
- typed gold set: `fixtures/import-real-app-eval-mnemo.pkl`
- deterministic report:
  `fixtures/reports/evaluate-real-app-import-mnemo.json`

The holdout preserves importer-relevant declarations from the real checkout.
Deployed resource ids and access ids are replaced with placeholders. File
digests and transformations are recorded in the holdout provenance file.

## Source Of Truth

The repository files are treated as implementation observations, not proof of
deployed state or intended correctness. The typed gold facts are the reviewed
expectation for what the importer must be able to observe from those files.

The evaluated claims are finite presence claims:

- the CI workflow is discoverable
- Wrangler and Pulumi declarations are discoverable as separate sources
- production, staging, and E2E are distinct environments
- declared Worker, D1, Vectorize, R2, AI, Images, Access, and Pulumi resources
  receive stable ids
- the production cron schedule is discoverable
- vendored `.mooncakes` files are not attributed to the application
- a missing conventional contracts file is represented as `null`, not as an
  observed implementation path

## Baseline Witness

Before the external dogfood changes, the importer observed the `CI` workflow
but missed every infrastructure fact. It also emitted
`packages/contracts/src/index.ts` even though that file does not exist in
mnemo.

Measured through the new fact vocabulary, the baseline was:

- expected facts: 32
- observed facts: 2
- matched facts: 1
- missing facts: 31
- unexpected facts: 1
- precision: 0.5
- recall: 0.03125

Running the first implementation against the live checkout exposed two further
counterexamples that the curated fixture alone had not covered:

1. `mnemo-server/.mooncakes/.../wrangler.jsonc` was incorrectly imported as an
   application-owned Worker.
2. `mnemo-server/wrangler.e2e.jsonc` was incorrectly classified as production,
   causing resource-id collisions with the production config.

Both witnesses were added to the holdout before the importer was repaired.

## Machine Result

Run:

```sh
dspec evaluate-real-app-import --json fixtures/import-real-app-eval-mnemo.pkl
```

Current result:

- expected facts: 32
- observed facts: 32
- matched facts: 32
- missing facts: 0
- unexpected facts: 0
- precision: 1
- recall: 1

The same importer was then run directly against the live mnemo checkout. It
found three owned IaC sources, three environments, 24 resources, and one cron
schedule, with no duplicate resource ids. The extra live resources are valid
declarations omitted from the reduced holdout, not fixture-specific parser
requirements.

## Decision Ledger

- source: mnemo repository files at the recorded commit
- implementation observation: CI was visible; infrastructure was almost
  entirely invisible; the conventional contracts path produced a false fact
- model question: can provider declarations be normalized without claiming
  that they are deployed or correct?
- machine result: the reviewed holdout reaches precision 1 and recall 1
- domain decision: record IaC declarations as observed support sites; keep
  environment, provider, source path, and declaration kind explicit
- lock: typed gold facts, vendored-config noise, E2E environment holdout, and a
  deterministic evaluation report

## Remaining Limits

This result proves importer agreement with a finite reviewed corpus. It does
not prove that Pulumi conditionals were executed, that resources were deployed,
that Cloudflare bindings are reachable, or that access policies are correct.
Pulumi resources are declaration observations with `environment = null` unless
an adapter can derive an environment without executing the program.

The next adapters were exercised against a separate holdout after this mnemo
pass. Terraform/OpenTofu `planned_values` and application-owned Kubernetes
manifests now use the same infrastructure normal form. The normalized resources
project into cloud, data, release, and runtime facts, while unknown encryption,
deletion, criticality, timeout, retry, and idempotency guarantees stay false or
unset.
