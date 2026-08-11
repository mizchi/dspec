type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

export type DataModelPolicy = Identified & {
  classification?: string | null;
  maxRetentionDays?: number | null;
};

export type DataModelSet = Identified & {
  classification?: string | null;
  retentionDays?: number | null;
};

export type DataModelStore = Identified;

export type DataModelPlacement = Identified & {
  dataset?: string | null;
  store?: string | null;
};

export type DataModelFlow = Identified & {
  dataset?: string | null;
  from?: string | null;
  to?: string | null;
};

export type DataPattern = {
  datasets?: DataModelSet[];
  flows?: DataModelFlow[];
  placements?: DataModelPlacement[];
  policies?: DataModelPolicy[];
  stores?: DataModelStore[];
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

export function dataPattern(model: unknown): DataPattern | null {
  const patterns = record(record(model)?.patterns);
  const data = record(patterns?.data);
  return data ? data as DataPattern : null;
}

export function dataPolicies(data: DataPattern | null | undefined): DataModelPolicy[] {
  return list<DataModelPolicy>(data?.policies);
}

export function dataSets(data: DataPattern | null | undefined): DataModelSet[] {
  return list<DataModelSet>(data?.datasets);
}

export function dataStores(data: DataPattern | null | undefined): DataModelStore[] {
  return list<DataModelStore>(data?.stores);
}

export function dataPlacements(data: DataPattern | null | undefined): DataModelPlacement[] {
  return list<DataModelPlacement>(data?.placements);
}

export function dataFlows(data: DataPattern | null | undefined): DataModelFlow[] {
  return list<DataModelFlow>(data?.flows);
}

export function validateDataModel(model: unknown): string[] {
  const errors: string[] = [];
  const data = dataPattern(model);
  if (!data) return errors;

  const policies = dataPolicies(data);
  const datasets = dataSets(data);
  const stores = dataStores(data);
  const placements = dataPlacements(data);
  const flows = dataFlows(data);
  checkUnique(errors, "data policy id", policies);
  checkUnique(errors, "data set id", datasets);
  checkUnique(errors, "data store id", stores);
  checkUnique(errors, "data placement id", placements);
  checkUnique(errors, "data flow id", flows);

  const policyClassifications = new Set<string | null | undefined>();
  for (const policy of policies) {
    if (policyClassifications.has(policy.classification)) {
      errors.push(`duplicate data policy classification: ${policy.classification}`);
    }
    policyClassifications.add(policy.classification);
    if (policy.maxRetentionDays !== null && policy.maxRetentionDays !== undefined && policy.maxRetentionDays < 0) {
      errors.push(`negative data policy max retention days: ${policy.id}`);
    }
  }

  const datasetIds = new Set(datasets.map((dataset) => dataset.id));
  const storeIds = new Set(stores.map((store) => store.id));

  for (const dataset of datasets) {
    if (!policyClassifications.has(dataset.classification)) {
      errors.push(`missing data policy for classification: ${dataset.id} -> ${dataset.classification}`);
    }
    if (dataset.retentionDays !== null && dataset.retentionDays !== undefined && dataset.retentionDays < 0) {
      errors.push(`negative data set retention days: ${dataset.id}`);
    }
  }

  for (const placement of placements) {
    if (!datasetIds.has(placement.dataset)) {
      errors.push(`unknown data placement dataset: ${placement.id} -> ${placement.dataset}`);
    }
    if (!storeIds.has(placement.store)) {
      errors.push(`unknown data placement store: ${placement.id} -> ${placement.store}`);
    }
  }

  for (const flow of flows) {
    if (!datasetIds.has(flow.dataset)) {
      errors.push(`unknown data flow dataset: ${flow.id} -> ${flow.dataset}`);
    }
    if (!storeIds.has(flow.from)) {
      errors.push(`unknown data flow source store: ${flow.id} -> ${flow.from}`);
    }
    if (!storeIds.has(flow.to)) {
      errors.push(`unknown data flow target store: ${flow.id} -> ${flow.to}`);
    }
  }

  return errors;
}
