export const DEFAULT_APP_PROFILE_GATES = [
    "check",
    "drift",
    "domain-coverage",
    "import-real-app",
    "observed-fixture",
    "reconcile-real-app",
    "reverse-coverage",
];
function list(value) {
    return Array.isArray(value) ? value : [];
}
export function appProfileGateSet(profile) {
    const gates = list(profile.gates);
    return new Set(gates.length > 0 ? gates : DEFAULT_APP_PROFILE_GATES);
}
export function appProfileStep(id, report, extra = {}) {
    const suggestions = list(report.suggestions);
    return {
        id,
        status: report.status,
        errors: list(report.errors),
        ...(suggestions.length > 0 ? { suggestions } : {}),
        ...extra,
    };
}
export function appProfileImportStep(app) {
    return {
        id: "import-real-app",
        status: "pass",
        errors: [],
        observed: { id: app.id },
        facts: {
            routes: list(app.routes).length,
            schemas: list(app.contracts?.schemas).length,
            workflows: list(app.workflows).length,
        },
    };
}
/**
 * Evaluate one application profile. The context is the deliberately narrow
 * integration boundary: model checking and real-app import remain replaceable
 * adapters rather than becoming dependencies of this report-shaping module.
 */
export function appProfileReport(profile, { dryRun = false, fix = false } = {}, context) {
    const gates = appProfileGateSet(profile);
    const model = context.loadModel(profile.modelPath);
    const app = context.importRealApp(profile.appRoot);
    const observedDocument = { app };
    const checks = [];
    if (gates.has("check")) {
        const report = context.checkReport(model);
        checks.push(appProfileStep("check", report, { summary: report.summary }));
    }
    if (gates.has("drift")) {
        const report = context.driftReport(model);
        checks.push(appProfileStep("drift", report, { references: report.references }));
    }
    if (gates.has("domain-coverage")) {
        const report = context.domainCoverageReport(model);
        checks.push(appProfileStep("domain-coverage", report, { covered: report.covered, total: report.total }));
    }
    if (gates.has("import-real-app")) {
        checks.push(appProfileImportStep(app));
    }
    if (gates.has("observed-fixture")) {
        checks.push(context.observedFixtureStep(profile, observedDocument, { dryRun, fix }));
    }
    if (gates.has("reconcile-real-app")) {
        const report = context.reconcileRealAppReport(model, observedDocument);
        checks.push(appProfileStep("reconcile-real-app", report, { covered: report.covered, total: report.total }));
    }
    if (gates.has("reverse-coverage")) {
        const report = context.reverseCoverageReport(model, observedDocument);
        checks.push(appProfileStep("reverse-coverage", report, { covered: report.covered, total: report.total }));
    }
    const errors = checks.flatMap((check) => list(check.errors).map((error) => `${check.id}: ${error}`));
    const fixed = checks.filter((check) => check.fixed && check.path).map((check) => check.path);
    const wouldFix = checks.filter((check) => check.wouldFix && check.path).map((check) => check.path);
    return {
        profile: {
            id: profile.id,
            modelPath: profile.modelPath,
            appRoot: profile.appRoot,
            observedFacts: profile.observedFacts ?? null,
        },
        status: context.reportStatus(errors),
        passed: checks.filter((check) => check.status === "pass").length,
        total: checks.length,
        ...(fixed.length > 0 ? { fixed } : {}),
        ...(wouldFix.length > 0 ? { wouldFix } : {}),
        checks,
        errors,
    };
}
export function appProfilesReport(reports, context) {
    const errors = reports.flatMap((report) => list(report.errors).map((error) => `${report.profile.id}: ${error}`));
    const fixed = context.sortedUnique(reports.flatMap((report) => list(report.fixed)));
    const wouldFix = context.sortedUnique(reports.flatMap((report) => list(report.wouldFix)));
    return {
        status: context.reportStatus(errors),
        passed: reports.filter((report) => report.status === "pass").length,
        total: reports.length,
        ...(fixed.length > 0 ? { fixed } : {}),
        ...(wouldFix.length > 0 ? { wouldFix } : {}),
        profiles: reports,
        errors,
    };
}
export function appProfilesCommandReport(files, options = {}, context) {
    return appProfilesReport(files.map((file) => appProfileReport(context.loadAppProfile(file), options, context)), context);
}
export function appProfileCommandReport(files, options = {}, context) {
    const reports = files.map((file) => appProfileReport(context.loadAppProfile(file), options, context));
    return reports.length === 1 ? reports[0] : appProfilesReport(reports, context);
}
export function appProfileSuiteReport(suite, options = {}, context) {
    const profiles = list(suite.profiles);
    return {
        suite: {
            id: suite.id,
            profiles,
        },
        ...appProfilesCommandReport(profiles, options, context),
    };
}
