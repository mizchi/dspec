function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function checkUnique(errors, label, items) {
    const seen = new Set();
    for (const item of items) {
        if (!item?.id)
            continue;
        if (seen.has(item.id))
            errors.push(`duplicate ${label}: ${item.id}`);
        seen.add(item.id);
    }
}
export function dataPattern(model) {
    const patterns = record(record(model)?.patterns);
    const data = record(patterns?.data);
    return data ? data : null;
}
export function dataPolicies(data) {
    return list(data?.policies);
}
export function dataSets(data) {
    return list(data?.datasets);
}
export function dataStores(data) {
    return list(data?.stores);
}
export function dataPlacements(data) {
    return list(data?.placements);
}
export function dataFlows(data) {
    return list(data?.flows);
}
export function validateDataModel(model) {
    const errors = [];
    const data = dataPattern(model);
    if (!data)
        return errors;
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
    const policyClassifications = new Set();
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
