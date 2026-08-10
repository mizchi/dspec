export const TOP_LEVEL_COMMANDS = [
    { name: "init", usage: "dspec init [--json] [--force] [--output <model.pkl>] [--lock <lock.json>] [model.pkl]" },
    { name: "verify", usage: "dspec verify [--json] [--lock <lock.json>] [--require-lock] <model.pkl>" },
    { name: "lock", usage: "dspec lock [--json] [--force] [--output <lock.json>] <model.pkl>" },
    { name: "trace", usage: "dspec trace <reconcile|check> ..." },
    { name: "translation", usage: "dspec translation <reconcile|check> ..." },
    { name: "scaffold", usage: "dspec scaffold rule [--json] [--force] [--output <rule.pkl>] [--kind <kind>] [--term <id>] [--implementation <path#symbol>] [--test <path#anchor>] <model.pkl> <rule-id>" },
    { name: "explain", usage: "dspec explain [--json|--markdown] [--lock <lock.json>] [--require-lock] <model.pkl>" },
    { name: "check", usage: "dspec check [--json] <model.pkl>" },
    { name: "drift", usage: "dspec drift [--json] <model.pkl>" },
    { name: "coverage", usage: "dspec coverage [--json] <model.pkl>" },
    { name: "conformance", usage: "dspec conformance [--json|--markdown] <model.pkl>" },
    { name: "query", usage: "dspec query [--json|--markdown] [--locale <locale>] [--answer <answer.json>] <model.pkl> <rule|term|evidence|impact|clause> <id> [selector]" },
    { name: "domain-coverage", usage: "dspec domain-coverage [--json] <model.pkl>" },
    { name: "traceability", usage: "dspec traceability [--json|--markdown] [--gate] [--execute-formal-tools|--require-executed-formal-tools] <model.pkl>" },
    { name: "formal-mutation", usage: "dspec formal-mutation [--json] [--require-formal-tools] <alloy-model.pkl>" },
    { name: "impact", usage: "dspec impact [--json] <before.pkl> <after.pkl>" },
    { name: "spec-change", usage: "dspec spec-change <compat|scaffold|review> ..." },
    { name: "evidence", usage: "dspec evidence <create|verify|refresh> ..." },
    { name: "domain", usage: "dspec domain <ir|generate|relationships> ..." },
    { name: "graph", usage: "dspec graph <export|embed|build|query-dsl|query> ..." },
    { name: "intent", usage: "dspec intent <verify|exercise|generate-tests|test|schema> ..." },
    { name: "daily-drift", usage: "dspec daily-drift <collect|approve> ..." },
    { name: "generate", usage: "dspec generate [--dry-run] [--json] [--generated-at <iso>] [--root <dir>] <model.pkl>" },
    { name: "generated", usage: "dspec generated <check|unlock> ..." },
    { name: "emit", usage: "dspec emit <markdown|json|quickcheck|alloy|quint|lean|source-map|generated-manifest|runtime-collector|runtime-collector-fixture> [--locale <locale>] <model.pkl>" },
    { name: "verify-generated", usage: "dspec verify-generated [--json] [--require-formal-tools] <model.pkl>" },
    { name: "devshell-smoke", usage: "dspec devshell-smoke [--json] [--strict] [--require-store-path]" },
    { name: "normalize-counterexamples", usage: "dspec normalize-counterexamples [--json] [--locale <locale>] <model.pkl>" },
    { name: "import-db-schema", usage: "dspec import-db-schema [--json] <schema.sql>" },
    { name: "check-sql-queries", usage: "dspec check-sql-queries [--json] <model.pkl> <queries.sql>" },
    { name: "import-real-app", usage: "dspec import-real-app [--json|--pkl] <app-root>" },
    { name: "evaluate-real-app-import", usage: "dspec evaluate-real-app-import [--json] <evaluation.pkl>" },
    { name: "evaluate-external-holdouts", usage: "dspec evaluate-external-holdouts [--json|--markdown] <corpus.pkl>" },
    { name: "reconcile-real-app", usage: "dspec reconcile-real-app [--json] <model.pkl> <observed.json>" },
    { name: "reverse-coverage", usage: "dspec reverse-coverage [--json] <model.pkl> <observed.json>" },
    { name: "check-app-profile", usage: "dspec check-app-profile [--json|--markdown] [--fix [--dry-run]] <profile.pkl...>" },
    { name: "check-app-profile-suite", usage: "dspec check-app-profile-suite [--json|--markdown] <suite.pkl>" },
    { name: "scaffold-app-profile", usage: "dspec scaffold-app-profile [--json] [--diff <profile.pkl>|--apply <profile.pkl> [--dry-run]] [--observed-facts <path>] [--gate <gate>] <model.pkl> <app-root>" },
    { name: "evaluate-app-profile", usage: "dspec evaluate-app-profile [--json|--markdown] <profile.pkl>" },
    { name: "evaluate-app-profile-suite", usage: "dspec evaluate-app-profile-suite [--json|--markdown] <suite.pkl>" },
    { name: "coverage-app-profile-scenarios", usage: "dspec coverage-app-profile-scenarios [--json|--markdown] <profile.pkl>" },
    { name: "score-app-profile-mutations", usage: "dspec score-app-profile-mutations [--json|--markdown] <profile.pkl>" },
    { name: "replay-app-profile-changes", usage: "dspec replay-app-profile-changes [--json|--markdown] <corpus.pkl>" },
    { name: "coverage-spec-reading-eval-suite", usage: "dspec coverage-spec-reading-eval-suite [--json|--markdown] <suite.pkl>" },
    { name: "metamorphic-spec-reading-eval", usage: "dspec metamorphic-spec-reading-eval [--json|--markdown] [--locale <locale>] <eval.pkl>" },
    { name: "spec-reading-eval", usage: "dspec spec-reading-eval [--json|--markdown|--prompt] [--locale <locale>] [--score <answers.json>|--runner <runner.pkl>] [--write-run <report.json>] [--refresh-digests [--apply]] <eval.pkl>" },
    { name: "spec-reading-eval-suite", usage: "dspec spec-reading-eval-suite [--json|--markdown] <suite.pkl>" },
    { name: "import-runtime-evidence", usage: "dspec import-runtime-evidence [--json] <evidence.json>" },
    { name: "collect-runtime-evidence", usage: "dspec collect-runtime-evidence [--pkl] <collector.json>" },
    { name: "verify-runtime-evidence", usage: "dspec verify-runtime-evidence [--json] <collector.json>" },
    { name: "render", usage: "dspec render [--locale <locale>] <model.pkl>" },
];
export function topLevelCommandRegistry() {
    return TOP_LEVEL_COMMANDS.map(({ name, usage }) => ({ name, usage }));
}
export function topLevelCommand(name) {
    return TOP_LEVEL_COMMANDS.find((command) => command.name === name);
}
export function usage() {
    return `usage:\n${TOP_LEVEL_COMMANDS.map((command) => `  ${command.usage}`).join("\n")}\n`;
}
export function topLevelCommandHelp(command) {
    return `usage:\n  ${command.usage}\n`;
}
