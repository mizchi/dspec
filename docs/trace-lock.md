# Reviewed Spec-to-Code Trace Lock

`Rule.id` is the stable requirement id. A rule's `implementedBy` and `checks`
are the explicit links to implementation and verification evidence. The trace
lock freezes that declared graph after human review:

```pkl
new d.Rule {
  id = "PASSWORD-MIN-LENGTH"
  // text, clauses, terms, and review state
  implementedBy {
    d.codeRef("src/password.ts", "validatePassword")
  }
  checks {
    d.nodeCheck("test/password.test.ts#rejects short passwords")
  }
}
```

Create or intentionally refresh the baseline after reviewing a specification
or linkage change:

```sh
dspec trace reconcile specs/password.pkl
# writes specs/password.trace.lock.json
```

Run the normal CI or pre-merge gate with:

```sh
dspec trace check --gate specs/password.pkl
```

`check` is informational without `--gate`, so it is useful while authoring.
`--diff` scopes reported link/content drift to paths changed from `HEAD`
(including staged and untracked paths), while missing declared sources still
remain errors:

```sh
dspec trace check --gate --diff specs/password.pkl
```

## What the lock records

The lock is deterministic JSON with no timestamp. For every rule it records:

- a hash of the rule's semantic contract (id, natural-language text, clauses,
  terms, priority, and deprecation state);
- hashes for declared implementation references;
- hashes for explicit test references and check targets; and
- a separate coverage state: `uncovered`, `impl-only`, `test-only`, or
  `verified`.

A check target is verification evidence, so a rule with an implementation and
a `nodeCheck`, `lean` check, Alloy check, or other declared target is
`verified` even if the same test is not repeated as an `implementedBy` entry.

The gate distinguishes content drift (`rule-content`, `reference-content`) from
relationship drift (`rule-linked`, `rule-unlinked`, `reference-linked`,
`reference-unlinked`). Coverage is reported separately: it is not silently
treated as a proof that production code implements the natural-language rule.

## Current source-binding boundary

This first adapter hashes the text of a named declaration/test anchor when it
can locate one, otherwise the whole referenced file. `hashScope` in the lock
makes that choice visible. It deliberately does **not** claim TypeScript AST
symbol resolution, call-graph reachability, test execution, or semantic
refinement. Those are separate guarantees supplied by dspec's existing
checkers and evidence tooling.

The narrow, deterministic textual binding makes the lock usable across the
languages already referenced by dspec (Pkl, JavaScript/TypeScript, Lean,
Alloy, and generated artifacts). A future language-specific AST adapter can
replace only the source-binding step while keeping the same reviewed rule and
link contract.

For this repository, `pkf run trace:verify` gates the self-model's
[`examples/dspec.trace.lock.json`](../examples/dspec.trace.lock.json).
