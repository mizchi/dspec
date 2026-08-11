function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function checkUniqueIdentifiers(errors, label, identifiers) {
    const seen = new Set();
    for (const identifier of identifiers) {
        if (seen.has(identifier))
            errors.push(`duplicate ${label}: ${identifier}`);
        seen.add(identifier);
    }
}
export function intentGoals(intent) {
    return list(record(intent)?.goals);
}
export function intentClaims(intent) {
    return list(record(intent)?.claims);
}
export function intentAssuranceTasks(intent) {
    return list(record(intent)?.assuranceTasks);
}
export function validateIntentGoalClaimAssurance(processesValue, goalsValue, claimsValue, assuranceTasksValue) {
    const errors = [];
    const processes = list(processesValue);
    const goals = list(goalsValue);
    const claims = list(claimsValue);
    const assuranceTasks = list(assuranceTasksValue);
    const processesById = new Map(processes.map((process) => [process.id, process]));
    const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
    const claimGoals = new Map();
    for (const goal of goals) {
        const goalIntents = list(goal.intents);
        const goalClaims = list(goal.claims);
        checkUniqueIdentifiers(errors, `intent goal process in ${goal.id}`, goalIntents);
        checkUniqueIdentifiers(errors, `intent goal claim in ${goal.id}`, goalClaims);
        if (goalIntents.length === 0)
            errors.push(`intent goal has no processes: ${goal.id}`);
        if (goalClaims.length === 0)
            errors.push(`intent goal has no claims: ${goal.id}`);
        for (const processId of goalIntents) {
            if (!processesById.has(processId)) {
                errors.push(`unknown intent goal process: ${goal.id} -> ${processId}`);
            }
        }
        for (const claimId of goalClaims) {
            if (!claimsById.has(claimId)) {
                errors.push(`unknown intent goal claim: ${goal.id} -> ${claimId}`);
                continue;
            }
            claimGoals.set(claimId, [...(claimGoals.get(claimId) ?? []), goal]);
        }
    }
    const taskCoveredClaimIds = new Set();
    for (const claim of claims) {
        const claimProcesses = list(claim.processes);
        checkUniqueIdentifiers(errors, `intent claim process in ${claim.id}`, claimProcesses);
        if (claimProcesses.length === 0)
            errors.push(`intent claim has no processes: ${claim.id}`);
        for (const processId of claimProcesses) {
            if (!processesById.has(processId)) {
                errors.push(`unknown intent claim process: ${claim.id} -> ${processId}`);
            }
        }
        const parents = claimGoals.get(claim.id) ?? [];
        if (parents.length === 0) {
            errors.push(`intent claim has no goal: ${claim.id}`);
        }
        if (parents.length > 1) {
            errors.push(`intent claim belongs to multiple goals: ${claim.id}`);
        }
        for (const goal of parents) {
            for (const processId of claimProcesses) {
                if (!list(goal.intents).includes(processId)) {
                    errors.push(`intent claim process is outside goal intent: ${claim.id} -> ${processId}`);
                }
            }
        }
    }
    for (const task of assuranceTasks) {
        const taskClaims = list(task.claims);
        checkUniqueIdentifiers(errors, `intent assurance task claim in ${task.id}`, taskClaims);
        if (taskClaims.length === 0)
            errors.push(`intent assurance task has no claims: ${task.id}`);
        for (const claimId of taskClaims) {
            if (!claimsById.has(claimId)) {
                errors.push(`unknown intent assurance task claim: ${task.id} -> ${claimId}`);
            }
            else {
                taskCoveredClaimIds.add(claimId);
            }
        }
        if (task.kind === "property-test") {
            if (!["node", "playwright"].includes(task.backend ?? "")) {
                errors.push(`intent property-test task requires node or playwright backend: ${task.id}`);
            }
            if (!["executed", "mutation-tested"].includes(task.assurance ?? "")) {
                errors.push(`intent property-test task requires executed or mutation-tested assurance: ${task.id}`);
            }
        }
        if (task.kind === "formal-model") {
            if (!["lean", "alloy", "quint"].includes(task.backend ?? "")) {
                errors.push(`intent formal-model task requires lean, alloy, or quint backend: ${task.id}`);
            }
            if (!["model", "proof"].includes(task.target.kind ?? "")) {
                errors.push(`intent formal-model task requires a model or proof target: ${task.id}`);
            }
            const expectedAssurance = task.backend === "lean" ? "proved" : "bounded";
            if (task.assurance !== expectedAssurance) {
                errors.push(`intent formal-model task assurance mismatch: ${task.id} -> ${task.backend} requires ${expectedAssurance}`);
            }
        }
        if (task.kind === "runtime-observation") {
            if (task.backend !== "runtime" || task.assurance !== "executed" || task.target.kind !== "runtime") {
                errors.push(`intent runtime-observation task requires runtime executed evidence: ${task.id}`);
            }
        }
        if (task.kind === "manual-review") {
            if (task.backend !== "manual" || task.assurance !== "reference") {
                errors.push(`intent manual-review task requires manual reference assurance: ${task.id}`);
            }
        }
    }
    for (const claim of claims) {
        if (!taskCoveredClaimIds.has(claim.id)) {
            errors.push(`intent claim has no assurance task: ${claim.id}`);
        }
    }
    return errors;
}
