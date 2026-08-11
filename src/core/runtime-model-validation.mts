type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

export type RuntimeModelService = Identified;

export type RuntimeModelDependency = Identified & {
  service?: string | null;
  timeoutMs?: number | null;
};

export type RuntimeModelSignal = Identified & {
  indicator?: string | null;
  service?: string | null;
};

export type RuntimeModelRunbook = Identified & {
  service?: string | null;
};

export type RuntimeModelAlert = Identified & {
  runbook?: string | null;
  service?: string | null;
  signal?: string | null;
};

export type RuntimeModelSlo = Identified & {
  indicator?: string | null;
  service?: string | null;
  targetPercent?: number | null;
};

export type RuntimeModelTelemetry = Identified & {
  observedPercent?: number | null;
  service?: string | null;
  signal?: string | null;
  slo?: string | null;
};

export type RuntimeModelAlertPolicy = Identified & {
  alert?: string | null;
};

export type RuntimeModelRunbookExecution = Identified & {
  runbook?: string | null;
};

export type RuntimeModelDependencyTrace = Identified & {
  dependency?: string | null;
  observedLatencyMs?: number | null;
};

export type RuntimeModelIntentExecution = Identified & {
  maxInFlightObserved?: number | null;
  observedLatencyMs?: number | null;
  process?: string | null;
  refinement?: string | null;
};

export type RuntimePattern = {
  alertPolicies?: RuntimeModelAlertPolicy[];
  alerts?: RuntimeModelAlert[];
  dependencies?: RuntimeModelDependency[];
  dependencyTraces?: RuntimeModelDependencyTrace[];
  intentExecutions?: RuntimeModelIntentExecution[];
  runbookExecutions?: RuntimeModelRunbookExecution[];
  runbooks?: RuntimeModelRunbook[];
  services?: RuntimeModelService[];
  signals?: RuntimeModelSignal[];
  slos?: RuntimeModelSlo[];
  telemetry?: RuntimeModelTelemetry[];
};

type IntentRefinement = Identified;

type IntentProcess = Identified & {
  refinements?: IntentRefinement[];
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

function intentProcesses(model: unknown): IntentProcess[] {
  const patterns = record(record(model)?.patterns);
  const intent = record(patterns?.intent);
  return list<IntentProcess>(intent?.processes);
}

function intentRefinements(process: IntentProcess): IntentRefinement[] {
  return list<IntentRefinement>(process.refinements);
}

export function runtimePattern(model: unknown): RuntimePattern | null {
  const patterns = record(record(model)?.patterns);
  const runtime = record(patterns?.runtime);
  return runtime ? runtime as RuntimePattern : null;
}

export function runtimeServices(runtime: RuntimePattern | null | undefined): RuntimeModelService[] {
  return list<RuntimeModelService>(runtime?.services);
}

export function runtimeDependencies(runtime: RuntimePattern | null | undefined): RuntimeModelDependency[] {
  return list<RuntimeModelDependency>(runtime?.dependencies);
}

export function runtimeSignals(runtime: RuntimePattern | null | undefined): RuntimeModelSignal[] {
  return list<RuntimeModelSignal>(runtime?.signals);
}

export function runtimeRunbooks(runtime: RuntimePattern | null | undefined): RuntimeModelRunbook[] {
  return list<RuntimeModelRunbook>(runtime?.runbooks);
}

export function runtimeAlerts(runtime: RuntimePattern | null | undefined): RuntimeModelAlert[] {
  return list<RuntimeModelAlert>(runtime?.alerts);
}

export function runtimeSlos(runtime: RuntimePattern | null | undefined): RuntimeModelSlo[] {
  return list<RuntimeModelSlo>(runtime?.slos);
}

export function runtimeTelemetry(runtime: RuntimePattern | null | undefined): RuntimeModelTelemetry[] {
  return list<RuntimeModelTelemetry>(runtime?.telemetry);
}

export function runtimeAlertPolicies(runtime: RuntimePattern | null | undefined): RuntimeModelAlertPolicy[] {
  return list<RuntimeModelAlertPolicy>(runtime?.alertPolicies);
}

export function runtimeRunbookExecutions(runtime: RuntimePattern | null | undefined): RuntimeModelRunbookExecution[] {
  return list<RuntimeModelRunbookExecution>(runtime?.runbookExecutions);
}

export function runtimeDependencyTraces(runtime: RuntimePattern | null | undefined): RuntimeModelDependencyTrace[] {
  return list<RuntimeModelDependencyTrace>(runtime?.dependencyTraces);
}

export function runtimeIntentExecutions(runtime: RuntimePattern | null | undefined): RuntimeModelIntentExecution[] {
  return list<RuntimeModelIntentExecution>(runtime?.intentExecutions);
}

export function validateRuntimeModel(model: unknown): string[] {
  const errors: string[] = [];
  const runtime = runtimePattern(model);
  if (!runtime) return errors;

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
    } else if (signal.service !== window.service) {
      errors.push(`runtime telemetry signal service mismatch: ${window.id} -> ${window.signal}`);
    }
    if (window.slo) {
      const slo = slosById.get(window.slo);
      if (!slo) {
        errors.push(`unknown runtime telemetry slo: ${window.id} -> ${window.slo}`);
      } else if (slo.service !== window.service) {
        errors.push(`runtime telemetry slo service mismatch: ${window.id} -> ${window.slo}`);
      } else if (signal && signal.indicator !== slo.indicator) {
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
    } else if (!intentRefinements(process).some((refinement) => refinement.id === execution.refinement)) {
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
