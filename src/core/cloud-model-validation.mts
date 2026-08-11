type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

export type CloudModelZone = Identified;

export type CloudModelNode = Identified & {
  zone?: string | null;
};

export type CloudModelFlow = Identified & {
  from?: string | null;
  to?: string | null;
};

export type CloudModelPolicy = Identified & {
  actions?: unknown[];
  principal?: string | null;
  resource?: string | null;
};

export type CloudPattern = {
  flows?: CloudModelFlow[];
  nodes?: CloudModelNode[];
  policies?: CloudModelPolicy[];
  zones?: CloudModelZone[];
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function checkUnique(errors: string[], label: string, items: readonly Identified[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) errors.push(`duplicate ${label}: ${item.id}`);
    seen.add(item.id);
  }
}

export function cloudPattern(model: unknown): CloudPattern | null {
  const patterns = record(record(model)?.patterns);
  const cloud = record(patterns?.cloud);
  return cloud ? cloud as CloudPattern : null;
}

export function cloudZones(cloud: CloudPattern | null | undefined): CloudModelZone[] {
  return list<CloudModelZone>(cloud?.zones);
}

export function cloudNodes(cloud: CloudPattern | null | undefined): CloudModelNode[] {
  return list<CloudModelNode>(cloud?.nodes);
}

export function cloudFlows(cloud: CloudPattern | null | undefined): CloudModelFlow[] {
  return list<CloudModelFlow>(cloud?.flows);
}

export function cloudPolicies(cloud: CloudPattern | null | undefined): CloudModelPolicy[] {
  return list<CloudModelPolicy>(cloud?.policies);
}

export function validateCloudModel(model: unknown): string[] {
  const errors: string[] = [];
  const cloud = cloudPattern(model);
  if (!cloud) return errors;

  const zones = cloudZones(cloud);
  const nodes = cloudNodes(cloud);
  const flows = cloudFlows(cloud);
  const policies = cloudPolicies(cloud);
  checkUnique(errors, "cloud zone id", zones);
  checkUnique(errors, "cloud node id", nodes);
  checkUnique(errors, "cloud flow id", flows);
  checkUnique(errors, "cloud policy id", policies);

  const zoneIds = new Set(zones.map((zone) => zone.id));
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    if (!zoneIds.has(node.zone)) {
      errors.push(`unknown cloud node zone: ${node.id} -> ${node.zone}`);
    }
  }

  for (const flow of flows) {
    if (!nodeIds.has(flow.from)) {
      errors.push(`unknown cloud flow source: ${flow.id} -> ${flow.from}`);
    }
    if (!nodeIds.has(flow.to)) {
      errors.push(`unknown cloud flow target: ${flow.id} -> ${flow.to}`);
    }
  }

  for (const policy of policies) {
    if (!nodeIds.has(policy.principal)) {
      errors.push(`unknown cloud policy principal: ${policy.id} -> ${policy.principal}`);
    }
    if (!nodeIds.has(policy.resource)) {
      errors.push(`unknown cloud policy resource: ${policy.id} -> ${policy.resource}`);
    }
    if (list(policy.actions).length === 0) {
      errors.push(`cloud policy has no actions: ${policy.id}`);
    }
  }

  return errors;
}
