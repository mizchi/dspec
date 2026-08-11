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
export function cloudPattern(model) {
    const patterns = record(record(model)?.patterns);
    const cloud = record(patterns?.cloud);
    return cloud ? cloud : null;
}
export function cloudZones(cloud) {
    return list(cloud?.zones);
}
export function cloudNodes(cloud) {
    return list(cloud?.nodes);
}
export function cloudFlows(cloud) {
    return list(cloud?.flows);
}
export function cloudPolicies(cloud) {
    return list(cloud?.policies);
}
export function validateCloudModel(model) {
    const errors = [];
    const cloud = cloudPattern(model);
    if (!cloud)
        return errors;
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
