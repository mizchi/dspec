function list(value) {
  return Array.isArray(value) ? value : [];
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function infrastructureId(value) {
  return String(value ?? "resource")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "resource";
}

function stripJsoncComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === "/" && next === "/") {
      index += 2;
      while (index < source.length && source[index] !== "\n") index += 1;
      if (index < source.length) output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") output += "\n";
        index += 1;
      }
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

function stripJsonTrailingCommas(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === ",") {
      let lookahead = index + 1;
      while (/\s/.test(source[lookahead] ?? "")) lookahead += 1;
      if (source[lookahead] === "}" || source[lookahead] === "]") continue;
    }
    output += char;
  }
  return output;
}

export class RealAppCoreError extends Error {}

function parseJsonc(source, path) {
  try {
    return JSON.parse(stripJsonTrailingCommas(stripJsoncComments(source)));
  } catch (error) {
    throw new RealAppCoreError(`failed to parse JSONC ${path}: ${error.message}`);
  }
}

function cronId(cron) {
  return String(cron)
    .trim()
    .split(/\s+/)
    .map((part) => part === "*" ? "star" : infrastructureId(part))
    .join("-");
}

function wranglerBoundResources(config, environment, workerId, source) {
  const resources = [];
  const append = (entries, kind, provider, nameField) => {
    for (const entry of list(entries)) {
      if (!entry.binding) continue;
      resources.push({
        id: `${environment}/${infrastructureId(entry.binding)}`,
        kind,
        provider,
        environment,
        binding: entry.binding,
        name: entry[nameField] ?? null,
        owner: workerId,
        source,
      });
    }
  };
  append(config.d1_databases, "database", "cloudflare-d1", "database_name");
  append(config.vectorize, "vector-index", "cloudflare-vectorize", "index_name");
  append(config.r2_buckets, "bucket", "cloudflare-r2", "bucket_name");
  if (config.ai?.binding) {
    resources.push({ id: `${environment}/${infrastructureId(config.ai.binding)}`, kind: "ai", provider: "cloudflare-ai", environment, binding: config.ai.binding, name: null, owner: workerId, source });
  }
  if (config.images?.binding) {
    resources.push({ id: `${environment}/${infrastructureId(config.images.binding)}`, kind: "images", provider: "cloudflare-images", environment, binding: config.images.binding, name: null, owner: workerId, source });
  }
  return resources;
}

function wranglerDefaultEnvironment(path) {
  const filename = path.split("/").at(-1) ?? path;
  const qualifier = filename.match(/^wrangler\.([^.]+)\.jsonc$/)?.[1];
  return qualifier ? infrastructureId(qualifier) : "production";
}

function parseWranglerInfrastructure(source, path) {
  const document = parseJsonc(source, path);
  const environments = [];
  const resources = [];
  const schedules = [];
  const appendEnvironment = (id, config) => {
    const workerName = config.name ?? document.name ?? id;
    const workerId = `${id}/${infrastructureId(workerName)}`;
    environments.push({ id, provider: "cloudflare", source: path });
    resources.push({
      id: workerId,
      kind: "worker",
      provider: "cloudflare-workers",
      environment: id,
      binding: null,
      name: workerName,
      owner: null,
      source: path,
      main: config.main ?? document.main ?? null,
      observability: config.observability?.enabled ?? document.observability?.enabled ?? false,
    });
    resources.push(...wranglerBoundResources(config, id, workerId, path));
    for (const cron of list(config.triggers?.crons)) {
      schedules.push({ id: `${id}/${cronId(cron)}`, cron, target: workerId, source: path });
    }
  };
  appendEnvironment(wranglerDefaultEnvironment(path), document);
  for (const [id, config] of Object.entries(document.env ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
    appendEnvironment(id, config);
  }
  return { environments, resources, schedules };
}

function pulumiResourceKind(type) {
  return ({
    D1Database: "database",
    R2Bucket: "bucket",
    ZeroTrustAccessApplication: "access-application",
    ZeroTrustAccessServiceToken: "access-service-token",
  })[type] ?? infrastructureId(type);
}

function parsePulumiInfrastructure(source, path) {
  const resources = [];
  const declaration = /\bnew\s+(?:[A-Za-z_$][\w$]*\.)+([A-Za-z_$][\w$]*)\s*\(\s*["'`]([^"'`]+)["'`]\s*,/g;
  for (const match of source.matchAll(declaration)) {
    resources.push({
      id: `pulumi/${infrastructureId(match[2])}`,
      kind: pulumiResourceKind(match[1]),
      provider: "cloudflare",
      environment: null,
      binding: null,
      name: match[2],
      owner: null,
      source: path,
      declarationType: match[1],
    });
  }
  return { resources };
}

function terraformResourceKind(type) {
  if (/(?:^|_)(?:db|database|rds)(?:_|$)/.test(type)) return "database";
  if (/(?:s3_bucket|storage_bucket|object_storage)/.test(type)) return "bucket";
  if (/(?:sqs_queue|pubsub_topic|servicebus_queue|message_queue)/.test(type)) return "queue";
  if (/(?:lambda_function|cloudfunctions|cloud_run|container_app)/.test(type)) return "service";
  if (/(?:secret|key_vault)/.test(type)) return "secret";
  if (/(?:cache|redis|memcache)/.test(type)) return "cache";
  if (/(?:iam_|role|policy)/.test(type)) return "policy";
  return infrastructureId(type);
}

function terraformPlanModuleResources(module, resources = []) {
  for (const resource of list(module?.resources)) {
    if (resource.mode !== "data") resources.push(resource);
  }
  for (const child of list(module?.child_modules)) terraformPlanModuleResources(child, resources);
  return resources;
}

function terraformPlanEnvironment(document) {
  return infrastructureId(
    document.variables?.environment?.value
      ?? document.variables?.env?.value
      ?? document.variables?.workspace?.value
      ?? "terraform",
  );
}

function terraformProvider(providerName) {
  return String(providerName ?? "terraform").split("/").at(-1) || "terraform";
}

function terraformResourceName(resource) {
  const values = resource.values ?? {};
  return values.name ?? values.identifier ?? values.bucket ?? values.queue_name ?? resource.name ?? null;
}

function parseTerraformPlanInfrastructure(source, path) {
  let document;
  try {
    document = JSON.parse(source);
  } catch (error) {
    throw new RealAppCoreError(`failed to parse Terraform/OpenTofu plan ${path}: ${error.message}`);
  }
  const environment = terraformPlanEnvironment(document);
  const resources = terraformPlanModuleResources(document.planned_values?.root_module).map((resource) => ({
    id: `terraform/${resource.address}`,
    kind: terraformResourceKind(resource.type ?? "resource"),
    provider: terraformProvider(resource.provider_name),
    environment,
    binding: null,
    name: terraformResourceName(resource),
    owner: null,
    source: path,
    declarationType: resource.type ?? null,
  }));
  return { environments: [{ id: environment, provider: "terraform", source: path }], resources };
}

function yamlUnquote(value) {
  const trimmed = String(value ?? "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function yamlTopLevelScalar(document, key) {
  const match = document.match(new RegExp(`^${escapeRegex(key)}:\\s*([^#\\n]+?)\\s*$`, "m"));
  return match ? yamlUnquote(match[1]) : null;
}

function yamlTopLevelBlock(document, key) {
  const lines = document.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${escapeRegex(key)}:\\s*(?:#.*)?$`).test(line));
  if (start < 0) return "";
  const block = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() && !/^\s/.test(line)) break;
    block.push(line);
  }
  return block.join("\n");
}

function yamlBlockScalar(block, key, indent = 2) {
  const match = block.match(new RegExp(`^\\s{${indent}}${escapeRegex(key)}:\\s*([^#\\n]+?)\\s*$`, "m"));
  return match ? yamlUnquote(match[1]) : null;
}

function kubernetesResourceKind(kind) {
  return ({
    CronJob: "cron-job",
    DaemonSet: "service",
    Deployment: "service",
    Ingress: "ingress",
    Job: "job",
    PersistentVolumeClaim: "storage",
    Secret: "secret",
    Service: "service-endpoint",
    StatefulSet: "service",
    ConfigMap: "config",
  })[kind] ?? infrastructureId(kind);
}

function parseKubernetesInfrastructure(source, path) {
  const environments = [];
  const resources = [];
  const schedules = [];
  for (const document of source.split(/^---\s*$/m)) {
    const kind = yamlTopLevelScalar(document, "kind");
    if (!kind) continue;
    const metadata = yamlTopLevelBlock(document, "metadata");
    const name = yamlBlockScalar(metadata, "name");
    if (!name) continue;
    const namespace = yamlBlockScalar(metadata, "namespace") ?? "default";
    const environment = `kubernetes/${infrastructureId(namespace)}`;
    const id = `${environment}/${infrastructureId(kind)}/${infrastructureId(name)}`;
    environments.push({ id: environment, provider: "kubernetes", source: path });
    resources.push({
      id,
      kind: kubernetesResourceKind(kind),
      provider: "kubernetes",
      environment,
      binding: null,
      name,
      owner: null,
      source: path,
      declarationType: kind,
    });
    if (kind === "CronJob") {
      const schedule = yamlBlockScalar(yamlTopLevelBlock(document, "spec"), "schedule");
      if (schedule) schedules.push({ id: `${environment}/${infrastructureId(name)}`, cron: schedule, target: id, source: path });
    }
  }
  return { environments, resources, schedules };
}

function uniqueInfrastructureRecords(records, key = (record) => record.id) {
  const unique = new Map();
  for (const record of records) {
    const id = key(record);
    if (!unique.has(id)) unique.set(id, record);
  }
  return [...unique.values()].sort((left, right) => key(left).localeCompare(key(right)));
}

export function importInfrastructureDocuments(documents) {
  const sources = [];
  const environments = [];
  const resources = [];
  const schedules = [];
  for (const { path, source } of documents.slice().sort((left, right) => left.path.localeCompare(right.path))) {
    let parsed = null;
    if (/(^|\/)wrangler(?:\.[^/]+)?\.jsonc$/.test(path)) {
      sources.push({ kind: "wrangler", path, provider: "cloudflare" });
      parsed = parseWranglerInfrastructure(source, path);
    } else if (/(^|\/)infra\/pulumi\/index\.(?:ts|js)$/.test(path)) {
      sources.push({ kind: "pulumi", path, provider: "cloudflare" });
      parsed = parsePulumiInfrastructure(source, path);
    } else if (/(^|\/)(?:terraform|tofu)(?:[-.]plan)?\.json$/.test(path)) {
      sources.push({ kind: "terraform-plan", path, provider: "terraform" });
      parsed = parseTerraformPlanInfrastructure(source, path);
    } else if (/(^|\/)(?:k8s|kubernetes|manifests)\/.*\.ya?ml$/.test(path)) {
      sources.push({ kind: "kubernetes", path, provider: "kubernetes" });
      parsed = parseKubernetesInfrastructure(source, path);
    }
    if (!parsed) continue;
    environments.push(...list(parsed.environments));
    resources.push(...list(parsed.resources));
    schedules.push(...list(parsed.schedules));
  }
  return {
    sources: uniqueInfrastructureRecords(sources, (source) => source.path),
    environments: uniqueInfrastructureRecords(environments),
    resources: uniqueInfrastructureRecords(resources),
    schedules: uniqueInfrastructureRecords(schedules),
  };
}

export function realAppImportFacts(app) {
  const facts = [];
  const push = (kind, id) => {
    if (id) facts.push({ kind, id });
  };
  for (const route of list(app.routes)) push("route", `${route.method} ${route.path}`);
  push("contract-path", app.contracts?.path);
  for (const schema of list(app.contracts?.schemas)) push("contract-schema", schema);
  for (const workflow of list(app.workflows)) push("workflow", workflow.id);
  for (const source of list(app.infrastructure?.sources)) push("infrastructure-source", source.path);
  for (const environment of list(app.infrastructure?.environments)) push("infrastructure-environment", environment.id);
  for (const resource of list(app.infrastructure?.resources)) push("infrastructure-resource", resource.id);
  for (const schedule of list(app.infrastructure?.schedules)) push("infrastructure-schedule", schedule.id);
  return facts.sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
}

export function diffRealAppImportFacts(beforeFacts, afterFacts) {
  const factKey = (fact) => `${fact.kind}:${fact.id}`;
  const normalized = (facts) => {
    const records = new Map();
    for (const fact of list(facts)) records.set(factKey(fact), { kind: fact.kind, id: fact.id });
    return records;
  };
  const before = normalized(beforeFacts);
  const after = normalized(afterFacts);
  const order = (left, right) => factKey(left).localeCompare(factKey(right));
  return {
    added: [...after.entries()]
      .filter(([key]) => !before.has(key))
      .map(([, fact]) => fact)
      .sort(order),
    removed: [...before.entries()]
      .filter(([key]) => !after.has(key))
      .map(([, fact]) => fact)
      .sort(order),
  };
}

export function evaluateRealAppImport(evaluation, app) {
  const expected = list(evaluation.expectedFacts).slice().sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`));
  const observed = realAppImportFacts(app);
  const key = (fact) => `${fact.kind}:${fact.id}`;
  const expectedKeys = new Set(expected.map(key));
  const observedKeys = new Set(observed.map(key));
  const matched = expected.filter((fact) => observedKeys.has(key(fact)));
  const missing = expected.filter((fact) => !observedKeys.has(key(fact)));
  const unexpected = observed.filter((fact) => !expectedKeys.has(key(fact)));
  const precision = observed.length === 0 ? (expected.length === 0 ? 1 : 0) : matched.length / observed.length;
  const recall = expected.length === 0 ? 1 : matched.length / expected.length;
  const errors = [
    ...missing.map((fact) => `missing observed fact: ${key(fact)}`),
    ...unexpected.map((fact) => `unexpected observed fact: ${key(fact)}`),
  ];
  return {
    evaluation: { id: evaluation.id, appRoot: evaluation.appRoot },
    app: { id: app.id },
    status: errors.length === 0 ? "pass" : "fail",
    summary: {
      expected: expected.length,
      observed: observed.length,
      matched: matched.length,
      missing: missing.length,
      unexpected: unexpected.length,
      precision,
      recall,
    },
    matched,
    missing,
    unexpected,
    errors,
  };
}

export function infrastructureCloudNodeKind(resource) {
  return ({
    "access-application": "service",
    "access-service-token": "secret",
    ai: "external",
    bucket: "bucket",
    cache: "cache",
    config: "external",
    "cron-job": "service",
    database: "database",
    images: "external",
    ingress: "service",
    job: "service",
    policy: "secret",
    queue: "queue",
    secret: "secret",
    service: "service",
    "service-endpoint": "service",
    storage: "database",
    "vector-index": "cache",
    worker: "service",
  })[resource.kind] ?? "external";
}

export function infrastructureDataStore(resource) {
  return new Set(["bucket", "cache", "database", "storage", "vector-index"]).has(resource.kind);
}

export function infrastructureService(resource) {
  return new Set(["access-application", "cron-job", "ingress", "job", "service", "service-endpoint", "worker"]).has(resource.kind);
}

export function infrastructureBindingId(resource) {
  return resource.owner ? `${resource.owner}/to/${resource.id}` : null;
}

export function infrastructureDependencyKind(resource) {
  if (resource.kind === "database" || resource.kind === "storage") return "database";
  if (resource.kind === "queue") return "queue";
  if (resource.kind === "cache" || resource.kind === "vector-index") return "cache";
  return "external";
}

export function realAppObservedDomain(app) {
  const routePaths = new Set(list(app.routes).map((route) => route.path));
  const schemas = new Set(list(app.contracts?.schemas));
  const workflowGates = sortedUnique(list(app.workflows).flatMap((workflow) => workflow.gates));
  const workflowIds = new Set(list(app.workflows).map((workflow) => workflow.id));
  const hasWorkflowText = (pattern) => list(app.workflows).some((workflow) => {
    const corpus = [...workflow.steps, ...workflow.repositories, ...workflow.artifacts, ...workflow.gates].join("\n").toLowerCase();
    return pattern.test(corpus);
  });
  const hasDashboard = list(app.scripts).some((script) => script.includes("dashboard")) || list(app.quality?.vrt?.routes).length > 0;
  const hasApi = list(app.routes).length > 0;
  const hasContracts = schemas.size > 0;
  const hasFlaker = Boolean(app.quality?.flaker?.path) || hasWorkflowText(/flaker/);
  const hasVrt = Boolean(app.quality?.vrt?.path) || hasWorkflowText(/\bvrt\b/);
  const hasArtifacts = hasWorkflowText(/artifact/);
  const infrastructureResources = list(app.infrastructure?.resources);
  const infrastructureNodeIds = infrastructureResources.map((resource) => resource.id);
  const infrastructureBindings = infrastructureResources.map(infrastructureBindingId).filter(Boolean);
  const infrastructureStores = infrastructureResources.filter(infrastructureDataStore).map((resource) => resource.id);
  const infrastructureServices = infrastructureResources.filter(infrastructureService).map((resource) => resource.id);
  const infrastructureEnvironments = list(app.infrastructure?.environments).map((environment) => environment.id);

  return {
    cloud: {
      nodes: sortedUnique([
        hasDashboard ? "public-client" : null,
        hasDashboard ? "dashboard" : null,
        hasApi ? "api" : null,
        hasContracts ? "contracts" : null,
        list(app.workflows).length > 0 ? "github-actions" : null,
        hasFlaker ? "flaker" : null,
        hasVrt ? "vrt" : null,
        ...infrastructureNodeIds,
      ]),
      flows: sortedUnique([
        hasDashboard ? "public-to-dashboard" : null,
        hasDashboard && hasApi ? "dashboard-to-api" : null,
        hasApi && hasContracts ? "api-to-contracts" : null,
        hasFlaker ? "github-actions-to-flaker" : null,
        hasVrt ? "github-actions-to-vrt" : null,
        ...infrastructureBindings,
      ]),
    },
    data: {
      datasets: sortedUnique([
        schemas.has("dashboardSnapshotSchema") ? "dashboard-snapshot" : null,
        schemas.has("incidentSchema") ? "incident" : null,
        schemas.has("serviceDetailSchema") ? "service-detail" : null,
      ]),
      stores: sortedUnique([
        hasApi ? "api-memory" : null,
        hasDashboard ? "dashboard-cache" : null,
        hasArtifacts ? "github-actions-artifacts" : null,
        app.quality?.flaker?.storage ? "flaker-duckdb" : null,
        ...infrastructureStores,
      ]),
      flows: sortedUnique([
        routePaths.has("/api/dashboard") && schemas.has("dashboardSnapshotSchema") ? "api-to-dashboard-data" : null,
        hasFlaker && hasArtifacts ? "ci-to-flaker-data" : null,
      ]),
    },
    release: {
      services: sortedUnique([hasApi ? "api" : null, hasDashboard ? "dashboard" : null, ...infrastructureServices]),
      environments: sortedUnique(["ci", ...infrastructureEnvironments]),
      gates: workflowGates.filter((gate) => gate !== "flaker"),
      steps: sortedUnique([...workflowIds]),
    },
    runtime: {
      services: sortedUnique([hasApi ? "api" : null, hasDashboard ? "dashboard" : null, ...infrastructureServices]),
      dependencies: sortedUnique([hasDashboard && hasApi ? "dashboard-to-api" : null, ...infrastructureBindings]),
      slos: sortedUnique([hasDashboard ? "dashboard-availability" : null]),
    },
  };
}
