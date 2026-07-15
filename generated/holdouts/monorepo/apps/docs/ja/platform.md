# モノレポ Projection holdout

- model: `projection-holdout-monorepo`
- version: `0.1.0`
- locale: `ja`

## Review Summary

- approvedRules: `0`
- automatedCheckTargets: `0`
- implementationRefs: `0`
- projections: `2`
- domainElements: `0`
- runtimeEvidenceRecords: `0`
- assuranceTargets: `reference=0, executed=0, mutation-tested=0, bounded=0, proved=0`

## Projections

### monorepo-app-docs

- kind: `markdown`
- source: `self`
- matrix: `locales`
- output: `generated/holdouts/monorepo/apps/docs/{locale}/platform.md`
- freshness: `exact`

### monorepo-contract-docs

- kind: `markdown`
- source: `self`
- matrix: `locales`
- output: `generated/holdouts/monorepo/packages/contracts/docs/{locale}/contracts.md`
- freshness: `exact`

## Vocabulary


## Rules

## Decisions
