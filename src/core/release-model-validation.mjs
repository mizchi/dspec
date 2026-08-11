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
export function releasePattern(model) {
    const patterns = record(record(model)?.patterns);
    const release = record(patterns?.release);
    return release ? release : null;
}
export function releaseServices(release) {
    return list(release?.services);
}
export function releaseEnvironments(release) {
    return list(release?.environments);
}
export function releaseGates(release) {
    return list(release?.gates);
}
export function releaseRollbacks(release) {
    return list(release?.rollbacks);
}
export function releaseMigrations(release) {
    return list(release?.migrations);
}
export function releaseSteps(release) {
    return list(release?.steps);
}
export function validateReleaseModel(model) {
    const errors = [];
    const release = releasePattern(model);
    if (!release)
        return errors;
    const services = releaseServices(release);
    const environments = releaseEnvironments(release);
    const gates = releaseGates(release);
    const rollbacks = releaseRollbacks(release);
    const migrations = releaseMigrations(release);
    const steps = releaseSteps(release);
    checkUnique(errors, "release service id", services);
    checkUnique(errors, "release environment id", environments);
    checkUnique(errors, "release gate id", gates);
    checkUnique(errors, "release rollback id", rollbacks);
    checkUnique(errors, "release migration id", migrations);
    checkUnique(errors, "release step id", steps);
    const serviceIds = new Set(services.map((service) => service.id));
    const environmentIds = new Set(environments.map((environment) => environment.id));
    const gateIds = new Set(gates.map((gate) => gate.id));
    const rollbacksById = new Map(rollbacks.map((rollback) => [rollback.id, rollback]));
    const migrationsById = new Map(migrations.map((migration) => [migration.id, migration]));
    for (const rollback of rollbacks) {
        if (!serviceIds.has(rollback.service)) {
            errors.push(`unknown release rollback service: ${rollback.id} -> ${rollback.service}`);
        }
    }
    for (const migration of migrations) {
        if (!serviceIds.has(migration.service)) {
            errors.push(`unknown release migration service: ${migration.id} -> ${migration.service}`);
        }
    }
    for (const step of steps) {
        if (!serviceIds.has(step.service)) {
            errors.push(`unknown release step service: ${step.id} -> ${step.service}`);
        }
        if (!environmentIds.has(step.environment)) {
            errors.push(`unknown release step environment: ${step.id} -> ${step.environment}`);
        }
        if (step.trafficPercent !== null && step.trafficPercent !== undefined
            && (step.trafficPercent < 0 || step.trafficPercent > 100)) {
            errors.push(`release step traffic percent out of range: ${step.id} -> ${step.trafficPercent}`);
        }
        for (const gateId of list(step.gates)) {
            if (!gateIds.has(gateId)) {
                errors.push(`unknown release step gate: ${step.id} -> ${gateId}`);
            }
        }
        if (step.rollback) {
            const rollback = rollbacksById.get(step.rollback);
            if (!rollback) {
                errors.push(`unknown release step rollback: ${step.id} -> ${step.rollback}`);
            }
            else if (rollback.service !== step.service) {
                errors.push(`release step rollback service mismatch: ${step.id} -> ${step.rollback}`);
            }
        }
        if (step.migration) {
            const migration = migrationsById.get(step.migration);
            if (!migration) {
                errors.push(`unknown release step migration: ${step.id} -> ${step.migration}`);
            }
            else if (migration.service !== step.service) {
                errors.push(`release step migration service mismatch: ${step.id} -> ${step.migration}`);
            }
        }
    }
    return errors;
}
