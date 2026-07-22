# External Import Holdouts 2026-07-16

## Scope

`fixtures/external-holdout-real-app-import.pkl` is an importer evaluation
corpus, kept outside `examples/` and the first-party sample application. It
contains three independent shapes:

- `mnemo` at commit `5cbf27107339dbbf92546065f3df5b6dec9dddce`: Cloudflare
  Worker configuration plus Pulumi declarations.
- `terraform-kubernetes`: the supported Terraform/OpenTofu plan and
  Kubernetes-manifest common subset.
- `cloudflare-starterkit` at commit
  `44f2a826f35fc0a5ae39bb59e4f38fd97c91c83d`: a separate Worker starter kit
  with production/staging Wrangler bindings and Pulumi declarations.

Each fixture is a reduced, sanitized checkout. Its imported facts are
implementation observations. `expectedFacts` remain a reviewed authored gold
set; the corpus report deliberately emits these under `authoredIntent` and the
importer's output under `observedImplementation`.

## Result

```sh
dspec evaluate-external-holdouts --markdown fixtures/external-holdout-real-app-import.pkl
```

The fixed result is 3/3 passing holdouts, 59 expected/observed/matched facts,
precision 1, and recall 1. The corpus records four explicit exclusions and no
manual mappings. Its 95-minute authoring figure is a retrospective estimate,
not an instrumented elapsed-time measurement; future captures should replace
it with a measured value.

## Change Replay

The corpus replays mnemo commit `93408840`, which added its staging
environment. Both fixture roots retain the relevant Wrangler declaration
shape with deployed identifiers replaced. The importer detects one added
environment and seven added resources: 8 facts total, with no spurious
removals. This is a source-change regression witness, not a claim that the
staging deployment completed.

## Limits

The corpus intentionally excludes Pulumi conditional execution, Terraform
apply state, Cloudflare binding reachability, and runtime policy effects. A
miss or false positive must be added as a new typed expected fact, a mutation
fixture, or a documented exclusion before changing parser behavior.
