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
function intentProcesses(model) {
    const patterns = record(record(model)?.patterns);
    const intent = record(patterns?.intent);
    return list(intent?.processes);
}
function intentRefinements(process) {
    return list(process.refinements);
}
export function runtimePattern(model) {
    const patterns = record(record(model)?.patterns);
    const runtime = record(patterns?.runtime);
    return runtime ? runtime : null;
}
export function runtimeServices(runtime) {
    return list(runtime?.services);
}
export function runtimeDependencies(runtime) {
    return list(runtime?.dependencies);
}
export function runtimeSignals(runtime) {
    return list(runtime?.signals);
}
export function runtimeRunbooks(runtime) {
    return list(runtime?.runbooks);
}
export function runtimeAlerts(runtime) {
    return list(runtime?.alerts);
}
export function runtimeSlos(runtime) {
    return list(runtime?.slos);
}
export function runtimeTelemetry(runtime) {
    return list(runtime?.telemetry);
}
export function runtimeAlertPolicies(runtime) {
    return list(runtime?.alertPolicies);
}
export function runtimeRunbookExecutions(runtime) {
    return list(runtime?.runbookExecutions);
}
export function runtimeDependencyTraces(runtime) {
    return list(runtime?.dependencyTraces);
}
export function runtimeIntentExecutions(runtime) {
    return list(runtime?.intentExecutions);
}
export function validateRuntimeModel(model) {
    const errors = [];
    const runtime = runtimePattern(model);
    if (!runtime)
        return errors;
    const services = runtimeServices(runtime);
    const dependencies = runtimeDependencies(runtime);
    const signals = runtimeSignals(runtime);
    const runbooks = runtimeRunbooks(runtime);
    const alerts = runtimeAlerts(runtime);
    const slos = runtimeSlos(runtime);
    const telemetry = runtimeTelemetry(runtime);
    const alertPolicies = runtimeAlertPolicies(runtime);
    const runbookExecutions = runtimeRunbookExecutions(runtime);
    const dependencyTraces = runtimeDependencyTraces(runtime);
    const intentExecutions = runtimeIntentExecutions(runtime);
    checkUnique(errors, "runtime service id", services);
    checkUnique(errors, "runtime dependency id", dependencies);
    checkUnique(errors, "runtime signal id", signals);
    checkUnique(errors, "runtime runbook id", runbooks);
    checkUnique(errors, "runtime alert id", alerts);
    checkUnique(errors, "runtime slo id", slos);
    checkUnique(errors, "runtime telemetry id", telemetry);
    checkUnique(errors, "runtime alert policy id", alertPolicies);
    checkUnique(errors, "runtime runbook execution id", runbookExecutions);
    checkUnique(errors, "runtime dependency trace id", dependencyTraces);
    checkUnique(errors, "runtime intent execution id", intentExecutions);
    const serviceIds = new Set(services.map((service) => service.id));
    const signalIds = new Set(signals.map((signal) => signal.id));
    const runbookIds = new Set(runbooks.map((runbook) => runbook.id));
    const dependencyIds = new Set(dependencies.map((dependency) => dependency.id));
    const alertsById = new Map(alerts.map((alert) => [alert.id, alert]));
    const signalsById = new Map(signals.map((signal) => [signal.id, signal]));
    const slosById = new Map(slos.map((slo) => [slo.id, slo]));
    const processesById = new Map(intentProcesses(model).map((process) => [process.id, process]));
    for (const dependency of dependencies) {
        if (!serviceIds.has(dependency.service)) {
            errors.push(`unknown runtime dependency service: ${dependency.id} -> ${dependency.service}`);
        }
        if (dependency.timeoutMs !== null && dependency.timeoutMs !== undefined && dependency.timeoutMs < 0) {
            errors.push(`negative runtime dependency timeout: ${dependency.id}`);
        }
    }
    for (const signal of signals) {
        if (!serviceIds.has(signal.service)) {
            errors.push(`unknown runtime signal service: ${signal.id} -> ${signal.service}`);
        }
    }
    for (const runbook of runbooks) {
        if (!serviceIds.has(runbook.service)) {
            errors.push(`unknown runtime runbook service: ${runbook.id} -> ${runbook.service}`);
        }
    }
    for (const alert of alerts) {
        if (!serviceIds.has(alert.service)) {
            errors.push(`unknown runtime alert service: ${alert.id} -> ${alert.service}`);
        }
        if (!signalIds.has(alert.signal)) {
            errors.push(`unknown runtime alert signal: ${alert.id} -> ${alert.signal}`);
        }
        if (alert.runbook && !runbookIds.has(alert.runbook)) {
            errors.push(`unknown runtime alert runbook: ${alert.id} -> ${alert.runbook}`);
        }
    }
    for (const slo of slos) {
        if (!serviceIds.has(slo.service)) {
            errors.push(`unknown runtime slo service: ${slo.id} -> ${slo.service}`);
        }
        if (slo.targetPercent !== null && slo.targetPercent !== undefined
            && (slo.targetPercent < 0 || slo.targetPercent > 100)) {
            errors.push(`runtime slo target percent out of range: ${slo.id} -> ${slo.targetPercent}`);
        }
    }
    for (const window of telemetry) {
        if (!serviceIds.has(window.service)) {
            errors.push(`unknown runtime telemetry service: ${window.id} -> ${window.service}`);
        }
        const signal = signalsById.get(window.signal);
        if (!signal) {
            errors.push(`unknown runtime telemetry signal: ${window.id} -> ${window.signal}`);
        }
        else if (signal.service !== window.service) {
            errors.push(`runtime telemetry signal service mismatch: ${window.id} -> ${window.signal}`);
        }
        if (window.slo) {
            const slo = slosById.get(window.slo);
            if (!slo) {
                errors.push(`unknown runtime telemetry slo: ${window.id} -> ${window.slo}`);
            }
            else if (slo.service !== window.service) {
                errors.push(`runtime telemetry slo service mismatch: ${window.id} -> ${window.slo}`);
            }
            else if (signal && signal.indicator !== slo.indicator) {
                errors.push(`runtime telemetry slo indicator mismatch: ${window.id} -> ${window.slo}`);
            }
        }
        if (window.observedPercent !== null && window.observedPercent !== undefined
            && (window.observedPercent < 0 || window.observedPercent > 100)) {
            errors.push(`runtime telemetry observed percent out of range: ${window.id} -> ${window.observedPercent}`);
        }
    }
    for (const policy of alertPolicies) {
        if (!alertsById.has(policy.alert)) {
            errors.push(`unknown runtime alert policy alert: ${policy.id} -> ${policy.alert}`);
        }
    }
    for (const execution of runbookExecutions) {
        if (!runbookIds.has(execution.runbook)) {
            errors.push(`unknown runtime runbook execution runbook: ${execution.id} -> ${execution.runbook}`);
        }
    }
    for (const trace of dependencyTraces) {
        if (!dependencyIds.has(trace.dependency)) {
            errors.push(`unknown runtime dependency trace dependency: ${trace.id} -> ${trace.dependency}`);
        }
        if (trace.observedLatencyMs !== null && trace.observedLatencyMs !== undefined && trace.observedLatencyMs < 0) {
            errors.push(`negative runtime dependency trace latency: ${trace.id}`);
        }
    }
    for (const execution of intentExecutions) {
        const process = processesById.get(execution.process);
        if (!process) {
            errors.push(`unknown runtime Intent execution process: ${execution.id} -> ${execution.process}`);
        }
        else if (!intentRefinements(process).some((refinement) => refinement.id === execution.refinement)) {
            errors.push(`unknown runtime Intent execution refinement: ${execution.id} -> ${execution.refinement}`);
        }
        if (execution.observedLatencyMs !== null && execution.observedLatencyMs !== undefined && execution.observedLatencyMs < 0) {
            errors.push(`negative runtime Intent execution latency: ${execution.id}`);
        }
        if (execution.maxInFlightObserved !== null && execution.maxInFlightObserved !== undefined && execution.maxInFlightObserved < 0) {
            errors.push(`negative runtime Intent execution max in-flight: ${execution.id}`);
        }
    }
    return errors;
}
