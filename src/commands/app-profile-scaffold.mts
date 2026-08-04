import { DEFAULT_APP_PROFILE_GATES } from "../core/app-profile-report.mjs";

type ScaffoldArgs = {
  modelFile?: string;
  appRoot?: string;
  observedFacts?: string | null;
  gates?: string[];
  schemaImportPath?: string;
};

type ScaffoldContext = {
  appRootId: (root: string) => string;
  resolve: (path: string) => string;
  write: (path: string, content: string) => void;
};

function list<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function sortedUnique(values: any[]): any[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function stableObject(value: any): any {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function sameJsonValue(left: any, right: any): boolean {
  return JSON.stringify(stableObject(left)) === JSON.stringify(stableObject(right));
}

function reportStatus(errors: any[]): "pass" | "fail" {
  return errors.length > 0 ? "fail" : "pass";
}

export function scaffoldAppProfileDocument(
  { modelFile, appRoot, observedFacts = null, gates = [] }: ScaffoldArgs = {},
  context: Pick<ScaffoldContext, "appRootId">,
): any {
  const id = context.appRootId(appRoot as string);
  const selectedGates = gates.length > 0 ? gates : DEFAULT_APP_PROFILE_GATES;
  const fixturePath = observedFacts ?? `fixtures/reports/import-real-app-${id}.json`;
  return {
    id,
    modelPath: modelFile,
    appRoot,
    observedFacts: fixturePath,
    gates: selectedGates,
  };
}

export function scaffoldAppProfile(args: ScaffoldArgs = {}, context: Pick<ScaffoldContext, "appRootId">): string {
  const profile = scaffoldAppProfileDocument(args, context);
  const schemaImportPath = args.schemaImportPath ?? "./dspec/Schema.pkl";
  const pklString = (value: unknown) => JSON.stringify(String(value));
  const lines = [
    `import ${pklString(schemaImportPath)} as d`,
    "",
    "profile: d.AppProfile = new {",
    `  id = ${pklString(profile.id)}`,
    `  modelPath = ${pklString(profile.modelPath)}`,
    `  appRoot = ${pklString(profile.appRoot)}`,
    `  observedFacts = ${pklString(profile.observedFacts)}`,
    "  gates {",
  ];
  for (const gate of profile.gates) {
    lines.push(`    ${pklString(gate)}`);
  }
  lines.push("  }", "}");
  return `${lines.join("\n")}\n`;
}

function normalizeAppProfileForScaffoldDiff(profile: any): any {
  const gates = list(profile.gates);
  return {
    id: profile.id,
    modelPath: profile.modelPath,
    appRoot: profile.appRoot,
    observedFacts: profile.observedFacts ?? null,
    gates: sortedUnique(gates.length > 0 ? gates : [...DEFAULT_APP_PROFILE_GATES]),
  };
}

function normalizeScaffoldedAppProfileForDiff(profile: any): any {
  return {
    id: profile.id,
    modelPath: profile.modelPath,
    appRoot: profile.appRoot,
    observedFacts: profile.observedFacts ?? null,
    gates: sortedUnique(list(profile.gates)),
  };
}

export function scaffoldAppProfileDiffReport(currentProfile: any, scaffoldedProfile: any): any {
  const current = normalizeAppProfileForScaffoldDiff(currentProfile);
  const scaffolded = normalizeScaffoldedAppProfileForDiff(scaffoldedProfile);
  const changes = ["id", "modelPath", "appRoot", "observedFacts", "gates"].flatMap((field) =>
    sameJsonValue(current[field], scaffolded[field])
      ? []
      : [{ field, current: current[field], scaffolded: scaffolded[field] }]
  );
  const errors = changes.map((change) => `scaffold profile drift: ${change.field}`);
  return {
    profile: {
      id: current.id,
      modelPath: current.modelPath,
      appRoot: current.appRoot,
      observedFacts: current.observedFacts,
    },
    status: reportStatus(errors),
    changes,
    errors,
  };
}

export function scaffoldAppProfileApplyReport(
  applyFile: string,
  currentProfile: any,
  scaffoldedProfile: any,
  rendered: string,
  { dryRun = false }: { dryRun?: boolean } = {},
  context: Pick<ScaffoldContext, "resolve" | "write">,
): any {
  const diff = scaffoldAppProfileDiffReport(currentProfile, scaffoldedProfile);
  const hasChanges = diff.changes.length > 0;
  const applied = hasChanges && !dryRun;
  if (applied) {
    context.write(context.resolve(applyFile), rendered);
  }
  const errors = hasChanges && dryRun ? diff.errors : [];
  return {
    ...diff,
    status: reportStatus(errors),
    errors,
    path: applyFile,
    applied,
    wouldApply: hasChanges && dryRun,
  };
}

export function renderScaffoldAppProfileDiffReport(report: any): string {
  if (report.wouldApply) {
    return `${[...report.errors, `would apply: ${report.path}`].join("\n")}\n`;
  }
  if (report.applied) {
    return `ok: ${report.profile.id} scaffold app profile applied: ${report.path}\n`;
  }
  if (report.status === "pass") {
    return `ok: ${report.profile.id} scaffold app profile diff\n`;
  }
  return `${report.errors.join("\n")}\n`;
}
