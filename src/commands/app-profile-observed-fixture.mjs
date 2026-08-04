/**
 * Compare imported facts with their checked-in oracle. Filesystem effects are
 * injected so dry-run and fix behavior can be tested without a real worktree.
 */
export function appProfileObservedFixtureStep(profile, importedDocument, { dryRun = false, fix = false } = {}, context) {
    if (!profile.observedFacts) {
        return {
            id: "observed-fixture",
            status: "fail",
            errors: ["app profile missing observedFacts"],
        };
    }
    const actual = context.stableJson(importedDocument);
    const path = context.resolve(profile.observedFacts);
    const expected = context.exists(path) ? context.read(path) : "";
    const pass = expected === actual;
    const fixed = !pass && fix && !dryRun;
    const wouldFix = !pass && fix && dryRun;
    if (fixed) {
        context.write(path, actual);
    }
    return {
        id: "observed-fixture",
        status: pass || fixed ? "pass" : "fail",
        errors: pass || fixed ? [] : [`observed facts fixture is stale: ${profile.observedFacts}`],
        ...(fixed ? { fixed: true } : {}),
        ...(wouldFix ? { wouldFix: true } : {}),
        path: profile.observedFacts,
    };
}
