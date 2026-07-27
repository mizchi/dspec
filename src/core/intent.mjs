function list(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function intentModel(model) {
  return model?.patterns?.intent ?? null;
}

function intentProcesses(model) {
  return list(intentModel(model)?.processes);
}

function intentOutcomes(model) {
  return list(intentModel(model)?.outcomes);
}

function outcomeEffects(outcome) {
  return list(outcome?.effects);
}

function constructionAuthorities(model) {
  return list(intentModel(model)?.constructionAuthorities);
}

function intentScenarios(model) {
  return list(intentModel(model)?.scenarios);
}

function fieldEntries(contract) {
  return list(contract?.fields);
}

function jsonAllowedValues(field) {
  return list(field.allowedValues).map((value) => {
    if (field.type === "integer") return Number(value);
    if (field.type === "boolean") return value === "true";
    return value;
  });
}

function contractSchema(contract) {
  const properties = {};
  const required = [];
  for (const field of fieldEntries(contract)) {
    const property = {};
    if (field.type === "integer") property.type = "integer";
    if (field.type === "boolean") property.type = "boolean";
    if (field.type === "string" || field.type === "identifier") property.type = "string";
    if (list(field.allowedValues).length > 0) property.enum = jsonAllowedValues(field);
    if (field.minimum !== null && field.minimum !== undefined) property.minimum = field.minimum;
    if (field.maximum !== null && field.maximum !== undefined) property.maximum = field.maximum;
    if (field.pattern) property.pattern = field.pattern;
    properties[field.id] = property;
    if (field.required !== false) required.push(field.id);
  }
  return {
    type: "object",
    properties,
    required: required.sort(),
    additionalProperties: true,
  };
}

function implementationPayloadSchema() {
  return {
    type: "object",
    additionalProperties: true,
  };
}

function effectObservationSchema() {
  return {
    type: "object",
    required: ["id", "output"],
    properties: {
      id: { type: "string" },
      output: implementationPayloadSchema(),
    },
  };
}

export function intentTraceSchema(model) {
  const processes = intentProcesses(model).map((process) => ({
    id: process.id,
    input: contractSchema(process.inputContract),
    execution: process.execution
      ? {
        maxInFlight: process.execution.maxInFlight,
        idempotencyKey: process.execution.idempotencyKey ?? null,
        timeoutSteps: process.execution.timeoutSteps ?? null,
        timeoutMs: process.execution.timeoutMs ?? null,
      }
      : null,
    outcomes: list(process.outcomes)
      .map((outcomeId) => {
        const outcome = intentOutcomes(model).find((candidate) => candidate.id === outcomeId);
        return outcome
          ? {
            id: outcome.id,
            state: outcome.state,
            output: contractSchema(outcome.outputContract),
            effects: outcomeEffects(outcome)
              .map((effect) => ({ id: effect.id, capability: effect.capability, required: effect.required !== false, output: contractSchema(effect.outputContract) }))
              .sort((left, right) => left.id.localeCompare(right.id)),
          }
          : { id: outcomeId };
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
    refinements: list(process.refinements)
      .map((refinement) => ({
        id: refinement.id,
        kind: refinement.kind,
        implementation: refinement.implementation,
        http: refinement.http ?? null,
        grpc: refinement.grpc ?? null,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  })).sort((left, right) => left.id.localeCompare(right.id));

  return {
    schemaVersion: "1.0",
    model: { id: model.id, version: model.version },
    traces: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "source", "initialState", "expectedState", "steps"],
        properties: {
          id: { type: "string" },
          scenario: { type: "string" },
          source: { type: "string" },
          observedAt: { type: "string", format: "date-time" },
          initialState: { type: "string" },
          expectedState: { type: "string" },
          steps: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["process", "outcome", "refinement", "input", "output"],
              properties: {
                process: { type: "string" },
                outcome: { type: "string" },
                refinement: { type: "string" },
                input: implementationPayloadSchema(),
                output: implementationPayloadSchema(),
                effects: {
                  type: "array",
                  items: effectObservationSchema(),
                },
              },
            },
          },
        },
      },
    },
    processes,
  };
}

function scalarValue(field, value, location, errors) {
  const type = field.type;
  if (type === "string" && typeof value !== "string") {
    errors.push(`${location}: field ${field.id} expected string`);
    return;
  }
  if (type === "identifier" && (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(value))) {
    errors.push(`${location}: field ${field.id} expected identifier`);
    return;
  }
  if (type === "integer" && (!Number.isInteger(value))) {
    errors.push(`${location}: field ${field.id} expected integer`);
    return;
  }
  if (type === "boolean" && typeof value !== "boolean") {
    errors.push(`${location}: field ${field.id} expected boolean`);
    return;
  }

  const comparable = typeof value === "boolean" ? String(value) : String(value);
  if (list(field.allowedValues).length > 0 && !list(field.allowedValues).includes(comparable)) {
    errors.push(`${location}: field ${field.id} is not an allowed value`);
  }
  if (field.minimum !== null && field.minimum !== undefined && typeof value === "number" && value < field.minimum) {
    errors.push(`${location}: field ${field.id} is below minimum ${field.minimum}`);
  }
  if (field.maximum !== null && field.maximum !== undefined && typeof value === "number" && value > field.maximum) {
    errors.push(`${location}: field ${field.id} exceeds maximum ${field.maximum}`);
  }
  if (field.pattern && typeof value === "string") {
    try {
      if (!(new RegExp(field.pattern)).test(value)) {
        errors.push(`${location}: field ${field.id} does not match pattern`);
      }
    } catch {
      errors.push(`${location}: field ${field.id} has an invalid model pattern`);
    }
  }
}

function bindingMap(bindings, location, errors) {
  const map = new Map();
  for (const binding of list(bindings)) {
    if (!binding?.contractField || !binding?.implementationField) {
      errors.push(`${location}: invalid field binding`);
      continue;
    }
    map.set(binding.contractField, binding.implementationField);
  }
  return map;
}

function validatePayload(contract, bindings, payload, location, errors) {
  if (!contract) return;
  const observed = record(payload);
  if (!observed) {
    errors.push(`${location}: expected an object payload`);
    return;
  }
  const mappings = bindingMap(bindings, location, errors);
  for (const field of fieldEntries(contract)) {
    const implementationField = mappings.get(field.id);
    if (!implementationField) {
      errors.push(`${location}: no refinement binding for field ${field.id}`);
      continue;
    }
    if (!(implementationField in observed)) {
      if (field.required !== false) errors.push(`${location}: missing required field ${field.id}`);
      continue;
    }
    scalarValue(field, observed[implementationField], location, errors);
  }
}

function effectBindingMap(outcomeBinding, location, errors) {
  const bindings = new Map();
  for (const binding of list(outcomeBinding?.effectBindings)) {
    if (!binding?.effect) {
      errors.push(`${location}: invalid effect binding`);
      continue;
    }
    if (bindings.has(binding.effect)) {
      errors.push(`${location}: duplicate effect binding ${binding.effect}`);
      continue;
    }
    bindings.set(binding.effect, binding);
  }
  return bindings;
}

function validateObservedEffects(outcome, outcomeBinding, observedEffects, location, errors) {
  const declared = new Map(outcomeEffects(outcome).map((effect) => [effect.id, effect]));
  if (declared.size === 0 && observedEffects === undefined) return 0;
  if (!Array.isArray(observedEffects)) {
    for (const effect of declared.values()) {
      if (effect.required !== false) errors.push(`${location}: missing required effect ${effect.id}`);
    }
    if (declared.size === 0) errors.push(`${location}: effects must be an array`);
    return 0;
  }

  const bindings = effectBindingMap(outcomeBinding, location, errors);
  const observedIds = new Set();
  for (const observation of observedEffects) {
    if (!record(observation) || typeof observation.id !== "string" || observation.id.length === 0) {
      errors.push(`${location}: invalid effect observation`);
      continue;
    }
    if (observedIds.has(observation.id)) {
      errors.push(`${location}: duplicate effect observation ${observation.id}`);
      continue;
    }
    observedIds.add(observation.id);
    const effect = declared.get(observation.id);
    if (!effect) {
      errors.push(`${location}: effect ${observation.id} is not declared by outcome ${outcome.id}`);
      continue;
    }
    const binding = bindings.get(effect.id);
    validatePayload(effect.outputContract, binding?.fields, observation.output, `${location} effect ${effect.id}`, errors);
  }
  for (const effect of declared.values()) {
    if (effect.required !== false && !observedIds.has(effect.id)) {
      errors.push(`${location}: missing required effect ${effect.id}`);
    }
  }
  return observedEffects.length;
}

function stateIds(model) {
  return new Set(list(model?.vocabulary).filter((term) => term.kind === "state").map((term) => term.id));
}

function refinementIndex(model) {
  const refinements = new Map();
  for (const process of intentProcesses(model)) {
    for (const refinement of list(process.refinements)) {
      refinements.set(refinement.id, { process, refinement });
    }
  }
  return refinements;
}

function traceError(errors, traceId, stepIndex, message) {
  const step = stepIndex === null ? "" : ` step ${stepIndex}`;
  errors.push(`trace ${traceId}${step}: ${message}`);
}

function validTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value);
}

function traceSummaryRecord(trace, status, errors) {
  return {
    id: typeof trace?.id === "string" ? trace.id : null,
    source: typeof trace?.source === "string" ? trace.source : null,
    observedAt: trace?.observedAt ?? null,
    steps: list(trace?.steps).length,
    status,
    errors,
  };
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  const object = record(value);
  if (!object) return value;
  return Object.fromEntries(Object.keys(object).sort().map((key) => [key, stableJsonValue(object[key])]));
}

function matchingJsonValues(left, right) {
  return JSON.stringify(stableJsonValue(left)) === JSON.stringify(stableJsonValue(right));
}

function executionError(error) {
  return error instanceof Error && error.message ? error.message : String(error);
}

function executionObservation(value) {
  const observed = record(value);
  if (observed?.__dspecIntentExecution === true) {
    return {
      output: observed.output,
      effects: observed.effects ?? null,
      transaction: observed.transaction ?? null,
    };
  }
  return { output: value, effects: null, transaction: null };
}

function normalizedEffects(effects) {
  return list(effects)
    .map((effect) => stableJsonValue(effect))
    .sort((left, right) => String(left?.id ?? "").localeCompare(String(right?.id ?? "")));
}

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function bindingImplementationField(bindings, contractField) {
  return list(bindings).find((binding) => binding?.contractField === contractField)?.implementationField ?? null;
}

function outcomeBindingFor(refinement, outcomeId) {
  return list(refinement?.outcomeBindings).find((binding) => binding?.outcome === outcomeId) ?? null;
}

function coverageTarget(kind, id) {
  return { kind, id, observations: [] };
}

function coverageTargetKey(kind, id) {
  return `${kind}\u0000${id}`;
}

function intentCoverageTargets(model) {
  const targets = new Map();
  const add = (kind, id) => {
    const key = coverageTargetKey(kind, id);
    if (!targets.has(key)) targets.set(key, coverageTarget(kind, id));
  };
  const outcomes = new Map(intentOutcomes(model).map((outcome) => [outcome.id, outcome]));
  for (const process of intentProcesses(model)) {
    for (const outcomeId of list(process.outcomes)) {
      add("transition", `${process.id}/${outcomeId}`);
    }
    for (const refinement of list(process.refinements)) {
      for (const field of fieldEntries(process.inputContract)) {
        add("input-field", `${process.id}/${refinement.id}/input/${field.id}`);
      }
      for (const outcomeId of list(process.outcomes)) {
        const outcome = outcomes.get(outcomeId);
        add("refinement-outcome", `${process.id}/${refinement.id}/${outcomeId}`);
        for (const field of fieldEntries(outcome?.outputContract)) {
          add("output-field", `${process.id}/${refinement.id}/${outcomeId}/output/${field.id}`);
        }
        for (const effect of outcomeEffects(outcome)) {
          add("effect", `${process.id}/${refinement.id}/${outcomeId}/effect/${effect.id}`);
          for (const field of fieldEntries(effect.outputContract)) {
            add("effect-field", `${process.id}/${refinement.id}/${outcomeId}/effect/${effect.id}/output/${field.id}`);
          }
        }
      }
    }
  }
  return targets;
}

function markCoverage(targets, kind, id, traceId, step) {
  const target = targets.get(coverageTargetKey(kind, id));
  if (!target) return;
  if (!target.observations.some((observation) => observation.traceId === traceId && observation.step === step)) {
    target.observations.push({ traceId, step });
  }
}

function coverageSummaryByKind(targets) {
  const summary = new Map();
  for (const target of targets) {
    const entry = summary.get(target.kind) ?? { kind: target.kind, targets: 0, covered: 0, uncovered: 0 };
    entry.targets += 1;
    if (target.observations.length > 0) entry.covered += 1;
    else entry.uncovered += 1;
    summary.set(target.kind, entry);
  }
  return [...summary.values()].sort((left, right) => left.kind.localeCompare(right.kind));
}

/// Measure finite trace coverage of declared Intent boundaries.
///
/// Coverage is observational rather than universal: a target is covered only
/// when a supplied trace crosses its declared implementation-facing boundary.
export function intentTraceCoverage(model, document, options = {}) {
  const verification = verifyIntentTraces(model, document, options);
  const targets = intentCoverageTargets(model);
  const processes = new Map(intentProcesses(model).map((process) => [process.id, process]));
  const outcomes = new Map(intentOutcomes(model).map((outcome) => [outcome.id, outcome]));
  const refinements = refinementIndex(model);

  for (const [traceIndex, trace] of list(document?.traces).entries()) {
    const traceId = typeof trace?.id === "string" && trace.id.length > 0 ? trace.id : `index-${traceIndex}`;
    for (const [stepIndex, step] of list(trace?.steps).entries()) {
      const process = processes.get(step?.process);
      const outcome = outcomes.get(step?.outcome);
      const refinementEntry = refinements.get(step?.refinement);
      if (!process || !outcome || !refinementEntry || refinementEntry.process.id !== process.id) continue;
      const refinement = refinementEntry.refinement;
      const prefix = `${process.id}/${refinement.id}/${outcome.id}`;
      markCoverage(targets, "transition", `${process.id}/${outcome.id}`, traceId, stepIndex);
      markCoverage(targets, "refinement-outcome", prefix, traceId, stepIndex);

      const input = record(step?.input);
      for (const field of fieldEntries(process.inputContract)) {
        const implementationField = bindingImplementationField(refinement.inputBindings, field.id);
        if (implementationField && hasOwn(input, implementationField)) {
          markCoverage(targets, "input-field", `${process.id}/${refinement.id}/input/${field.id}`, traceId, stepIndex);
        }
      }

      const output = record(step?.output);
      const outcomeBinding = outcomeBindingFor(refinement, outcome.id);
      for (const field of fieldEntries(outcome.outputContract)) {
        const implementationField = bindingImplementationField(outcomeBinding?.fields, field.id);
        if (implementationField && hasOwn(output, implementationField)) {
          markCoverage(targets, "output-field", `${prefix}/output/${field.id}`, traceId, stepIndex);
        }
      }

      const effectBindings = new Map(list(outcomeBinding?.effectBindings).map((binding) => [binding.effect, binding]));
      for (const observation of list(step?.effects)) {
        const effect = outcomeEffects(outcome).find((candidate) => candidate.id === observation?.id);
        if (!effect) continue;
        const effectPrefix = `${prefix}/effect/${effect.id}`;
        markCoverage(targets, "effect", effectPrefix, traceId, stepIndex);
        const effectOutput = record(observation.output);
        const effectBinding = effectBindings.get(effect.id);
        for (const field of fieldEntries(effect.outputContract)) {
          const implementationField = bindingImplementationField(effectBinding?.fields, field.id);
          if (implementationField && hasOwn(effectOutput, implementationField)) {
            markCoverage(targets, "effect-field", `${effectPrefix}/output/${field.id}`, traceId, stepIndex);
          }
        }
      }
    }
  }

  const entries = [...targets.values()]
    .map((target) => ({ ...target, observations: target.observations.sort((left, right) => `${left.traceId}\u0000${left.step}`.localeCompare(`${right.traceId}\u0000${right.step}`)) }))
    .sort((left, right) => coverageTargetKey(left.kind, left.id).localeCompare(coverageTargetKey(right.kind, right.id)));
  const uncovered = entries.filter((target) => target.observations.length === 0);
  const errors = [
    ...verification.errors,
    ...uncovered.map((target) => `uncovered Intent trace target: ${target.kind} ${target.id}`),
  ];
  const covered = entries.length - uncovered.length;
  return {
    model: verification.model,
    status: errors.length === 0 ? "pass" : "fail",
    summary: {
      targets: entries.length,
      covered,
      uncovered: uncovered.length,
      coverage: entries.length === 0 ? 1 : covered / entries.length,
      byKind: coverageSummaryByKind(entries),
    },
    verification: {
      status: verification.status,
      summary: verification.summary,
    },
    targets: entries,
    uncovered,
    errors,
  };
}

function scenarioShape(scenario) {
  return {
    id: scenario.id,
    initialState: scenario.initialState,
    expectedState: scenario.expectedState,
    steps: list(scenario.steps).map((step) => ({ process: step.process, outcome: step.outcome })),
  };
}

function matchingScenarioTrace(scenario, trace) {
  if (trace?.initialState !== scenario.initialState || trace?.expectedState !== scenario.expectedState) return false;
  const scenarioSteps = list(scenario.steps);
  const traceSteps = list(trace?.steps);
  return scenarioSteps.length === traceSteps.length
    && scenarioSteps.every((step, index) =>
      step.process === traceSteps[index]?.process && step.outcome === traceSteps[index]?.outcome);
}

/// Check that declared human-level scenarios have matching finite observations.
///
/// A scenario describes a structural path, rather than concrete input values,
/// so the report can suggest a missing case without fabricating domain data.
export function intentScenarioCorpusReport(model, document, options = {}) {
  const verification = verifyIntentTraces(model, document, options);
  const scenarios = intentScenarios(model).slice().sort((left, right) => left.id.localeCompare(right.id));
  const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const errors = [...verification.errors];
  const observations = [];

  for (const [index, trace] of list(document?.traces).entries()) {
    const traceId = typeof trace?.id === "string" && trace.id.length > 0 ? trace.id : `index-${index}`;
    const scenarioId = trace?.scenario;
    if (scenarioId === undefined || scenarioId === null || scenarioId === "") {
      observations.push({ trace: traceId, scenario: null, status: "unassigned", errors: [] });
      continue;
    }
    const scenario = scenariosById.get(scenarioId);
    if (!scenario) {
      const error = `trace ${traceId}: unknown declared Intent scenario ${scenarioId}`;
      errors.push(error);
      observations.push({ trace: traceId, scenario: scenarioId, status: "fail", errors: [error] });
      continue;
    }
    if (!matchingScenarioTrace(scenario, trace)) {
      const error = `trace ${traceId}: does not match declared Intent scenario ${scenario.id}`;
      errors.push(error);
      observations.push({ trace: traceId, scenario: scenario.id, status: "fail", errors: [error] });
      continue;
    }
    observations.push({ trace: traceId, scenario: scenario.id, status: "pass", errors: [] });
  }

  const observedScenarioIds = new Set(
    observations.filter((observation) => observation.status === "pass").map((observation) => observation.scenario),
  );
  const required = scenarios.filter((scenario) => scenario.required !== false);
  const covered = required.filter((scenario) => observedScenarioIds.has(scenario.id));
  const missing = required
    .filter((scenario) => !observedScenarioIds.has(scenario.id))
    .map(scenarioShape);
  for (const scenario of missing) {
    errors.push(`missing required Intent scenario trace: ${scenario.id}`);
  }
  const suggestions = missing.map(({ id, ...scenario }) => ({
    scenario: id,
    ...scenario,
    reason: "required declared scenario has no matching observed trace",
  }));

  return {
    model: verification.model,
    status: errors.length === 0 ? "pass" : "fail",
    summary: {
      scenarios: scenarios.length,
      required: required.length,
      covered: covered.length,
      uncovered: missing.length,
      coverage: required.length === 0 ? 1 : covered.length / required.length,
    },
    verification: { status: verification.status, summary: verification.summary },
    observations: observations.sort((left, right) => `${left.scenario ?? ""}\u0000${left.trace}`.localeCompare(`${right.scenario ?? ""}\u0000${right.trace}`)),
    missing,
    suggestions,
    errors,
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function invalidScalarValue(field) {
  if (field.type === "integer") return "not-an-integer";
  if (field.type === "boolean") return "not-a-boolean";
  return 0;
}

function mutationShrinks(traceId, step, kind, subject) {
  return [
    { traceId, step },
    { kind, subject },
  ];
}

function evaluateTraceMutation(model, document, options, descriptor, apply) {
  const mutated = cloneJson(document);
  apply(mutated);
  const verification = verifyIntentTraces(model, mutated, options);
  const detected = verification.status === "fail";
  return {
    ...descriptor,
    expected: "fail",
    actual: verification.status,
    status: detected ? "pass" : "fail",
    errors: verification.errors,
  };
}

/// Generate deterministic negative finite trace cases and score their detection.
///
/// Mutations only assert that this verifier rejects a nearby violation. They do
/// not imply that all production faults or all implementation behaviors are
/// covered.
export function intentTraceMutationReport(model, document, options = {}) {
  const baseline = verifyIntentTraces(model, document, options);
  if (baseline.status !== "pass") {
    return {
      model: baseline.model,
      status: "fail",
      baseline: { status: baseline.status, summary: baseline.summary },
      generated: 0,
      detected: 0,
      missed: 0,
      score: 0,
      mutations: [],
      errors: [...baseline.errors, "cannot generate Intent mutations from an invalid baseline trace document"],
    };
  }

  const mutations = [];
  const processes = new Map(intentProcesses(model).map((process) => [process.id, process]));
  const outcomes = new Map(intentOutcomes(model).map((outcome) => [outcome.id, outcome]));
  const refinements = refinementIndex(model);
  const add = (descriptor, apply) => mutations.push(evaluateTraceMutation(model, document, options, descriptor, apply));

  for (const [traceIndex, trace] of list(document?.traces).entries()) {
    const traceId = typeof trace?.id === "string" && trace.id.length > 0 ? trace.id : `index-${traceIndex}`;
    for (const [stepIndex, step] of list(trace?.steps).entries()) {
      const process = processes.get(step?.process);
      const outcome = outcomes.get(step?.outcome);
      const refinementEntry = refinements.get(step?.refinement);
      if (!process || !outcome || !refinementEntry || refinementEntry.process.id !== process.id) continue;
      const refinement = refinementEntry.refinement;
      const outcomeBinding = outcomeBindingFor(refinement, outcome.id);
      const targetStep = (mutated) => mutated.traces[traceIndex].steps[stepIndex];

      for (const field of fieldEntries(process.inputContract).filter((candidate) => candidate.required !== false)) {
        const implementationField = bindingImplementationField(refinement.inputBindings, field.id);
        if (!implementationField || !hasOwn(record(step.input), implementationField)) continue;
        add({
          id: `${traceId}/step-${stepIndex}/required-input-removed/${field.id}`,
          kind: "required-input-removed",
          traceId,
          step: stepIndex,
          mutation: { field: field.id, implementationField },
          shrinks: mutationShrinks(traceId, stepIndex, "required-input-removed", field.id),
        }, (mutated) => { delete targetStep(mutated).input[implementationField]; });
      }

      for (const field of fieldEntries(outcome.outputContract).filter((candidate) => candidate.required !== false)) {
        const implementationField = bindingImplementationField(outcomeBinding?.fields, field.id);
        if (!implementationField || !hasOwn(record(step.output), implementationField)) continue;
        add({
          id: `${traceId}/step-${stepIndex}/required-output-removed/${field.id}`,
          kind: "required-output-removed",
          traceId,
          step: stepIndex,
          mutation: { field: field.id, implementationField },
          shrinks: mutationShrinks(traceId, stepIndex, "required-output-removed", field.id),
        }, (mutated) => { delete targetStep(mutated).output[implementationField]; });
      }

      const alternativeOutcome = list(process.outcomes).filter((outcomeId) => outcomeId !== outcome.id).slice().sort()[0] ?? null;
      if (alternativeOutcome) {
        add({
          id: `${traceId}/step-${stepIndex}/outcome-substituted/${alternativeOutcome}`,
          kind: "outcome-substituted",
          traceId,
          step: stepIndex,
          mutation: { from: outcome.id, to: alternativeOutcome },
          shrinks: mutationShrinks(traceId, stepIndex, "outcome-substituted", alternativeOutcome),
        }, (mutated) => { targetStep(mutated).outcome = alternativeOutcome; });
      }

      add({
        id: `${traceId}/step-${stepIndex}/unexpected-effect-added`,
        kind: "unexpected-effect-added",
        traceId,
        step: stepIndex,
        mutation: { effect: "__unexpected-effect__" },
        shrinks: mutationShrinks(traceId, stepIndex, "unexpected-effect-added", "__unexpected-effect__"),
      }, (mutated) => { targetStep(mutated).effects = [...list(targetStep(mutated).effects), { id: "__unexpected-effect__", output: {} }]; });

      const effectBindings = new Map(list(outcomeBinding?.effectBindings).map((binding) => [binding.effect, binding]));
      for (const effect of outcomeEffects(outcome)) {
        const effectIndex = list(step.effects).findIndex((observation) => observation?.id === effect.id);
        if (effect.required !== false && effectIndex >= 0) {
          add({
            id: `${traceId}/step-${stepIndex}/required-effect-removed/${effect.id}`,
            kind: "required-effect-removed",
            traceId,
            step: stepIndex,
            mutation: { effect: effect.id },
            shrinks: mutationShrinks(traceId, stepIndex, "required-effect-removed", effect.id),
          }, (mutated) => { targetStep(mutated).effects.splice(effectIndex, 1); });
        }
        const effectBinding = effectBindings.get(effect.id);
        for (const field of fieldEntries(effect.outputContract).filter((candidate) => candidate.required !== false)) {
          const implementationField = bindingImplementationField(effectBinding?.fields, field.id);
          const output = record(list(step.effects)[effectIndex]?.output);
          if (effectIndex < 0 || !implementationField || !hasOwn(output, implementationField)) continue;
          add({
            id: `${traceId}/step-${stepIndex}/effect-payload-invalid/${effect.id}/${field.id}`,
            kind: "effect-payload-invalid",
            traceId,
            step: stepIndex,
            mutation: { effect: effect.id, field: field.id, implementationField },
            shrinks: mutationShrinks(traceId, stepIndex, "effect-payload-invalid", `${effect.id}/${field.id}`),
          }, (mutated) => { targetStep(mutated).effects[effectIndex].output[implementationField] = invalidScalarValue(field); });
        }
      }
    }
  }

  const ordered = mutations.sort((left, right) => left.id.localeCompare(right.id));
  const detected = ordered.filter((mutation) => mutation.status === "pass").length;
  const missed = ordered.length - detected;
  return {
    model: baseline.model,
    status: missed === 0 ? "pass" : "fail",
    baseline: { status: baseline.status, summary: baseline.summary },
    generated: ordered.length,
    detected,
    missed,
    score: ordered.length === 0 ? 1 : detected / ordered.length,
    mutations: ordered,
    errors: ordered
      .filter((mutation) => mutation.status !== "pass")
      .map((mutation) => `${mutation.id}: verifier did not reject generated mutation`),
  };
}

export async function executeIntentRefinements(model, document, invoke) {
  const errors = [];
  const executions = [];
  const documentRecord = record(document);
  if (!documentRecord) {
    return {
      status: "fail",
      summary: { executedRefinements: 0 },
      executions,
      errors: ["invalid intent trace document"],
    };
  }
  if (!Array.isArray(documentRecord.traces)) {
    return {
      status: "fail",
      summary: { executedRefinements: 0 },
      executions,
      errors: ["intent trace document traces must be an array"],
    };
  }
  if (typeof invoke !== "function") {
    return {
      status: "fail",
      summary: { executedRefinements: 0 },
      executions,
      errors: ["intent refinement invoker must be a function"],
    };
  }

  const processes = new Map(intentProcesses(model).map((process) => [process.id, process]));
  const outcomes = new Map(intentOutcomes(model).map((outcome) => [outcome.id, outcome]));
  const refinements = refinementIndex(model);
  for (const [traceIndex, trace] of documentRecord.traces.entries()) {
    const traceId = typeof trace?.id === "string" && trace.id.length > 0 ? trace.id : `index-${traceIndex}`;
    for (const [stepIndex, step] of list(trace?.steps).entries()) {
      const process = processes.get(step?.process);
      const entry = refinements.get(step?.refinement);
      if (!entry) {
        errors.push(`trace ${traceId} step ${stepIndex}: unknown refinement ${step?.refinement ?? "missing"}`);
        continue;
      }
      if (!process || entry.process.id !== process.id) {
        errors.push(`trace ${traceId} step ${stepIndex}: refinement ${entry.refinement.id} does not belong to process ${step?.process ?? "missing"}`);
        continue;
      }
      if (!["function", "http-route", "grpc-method", "transaction"].includes(entry.refinement.kind)) {
        errors.push(`trace ${traceId} step ${stepIndex} refinement ${entry.refinement.id}: cannot execute ${entry.refinement.kind} refinement`);
        continue;
      }

      const execution = {
        traceId,
        step: stepIndex,
        process: process.id,
        refinement: entry.refinement.id,
        status: "pass",
      };
      executions.push(execution);
      try {
        const actual = await invoke(entry.refinement, step?.input, {
          model,
          trace,
          traceId,
          step: stepIndex,
          process,
          expectedOutput: step?.output,
          expectedEffects: step?.effects,
          expectedTransport: step?.transport ?? null,
          outcome: outcomes.get(step?.outcome),
        });
        const observed = executionObservation(actual);
        if (!matchingJsonValues(observed.output, step?.output)) {
          const message = `trace ${traceId} step ${stepIndex} refinement ${entry.refinement.id}: output does not match observed trace`;
          errors.push(message);
          execution.status = "fail";
          execution.error = message;
        }
        if (observed.effects !== null && !matchingJsonValues(normalizedEffects(observed.effects), normalizedEffects(step?.effects))) {
          const message = `trace ${traceId} step ${stepIndex} refinement ${entry.refinement.id}: effects do not match observed trace`;
          errors.push(message);
          execution.status = "fail";
          execution.error = message;
        }
        if (observed.transaction !== null) execution.transaction = observed.transaction;
      } catch (error) {
        const message = `trace ${traceId} step ${stepIndex} refinement ${entry.refinement.id}: execution failed: ${executionError(error)}`;
        errors.push(message);
        execution.status = "fail";
        execution.error = message;
      }
    }
  }
  return {
    status: errors.length === 0 ? "pass" : "fail",
    summary: { executedRefinements: executions.length },
    executions,
    errors,
  };
}

function implementationFieldFor(refinement, contractField) {
  return list(refinement?.inputBindings)
    .find((binding) => binding?.contractField === contractField)?.implementationField ?? null;
}

function policyTraceSeed(document, process, refinements) {
  for (const [traceIndex, trace] of list(document?.traces).entries()) {
    const traceId = typeof trace?.id === "string" && trace.id.length > 0 ? trace.id : `index-${traceIndex}`;
    for (const [stepIndex, step] of list(trace?.steps).entries()) {
      if (step?.process !== process.id) continue;
      const entry = refinements.get(step?.refinement);
      if (!entry || entry.process.id !== process.id) continue;
      if (!["function", "http-route", "grpc-method", "transaction"].includes(entry.refinement.kind)) continue;
      return { trace, traceId, step, stepIndex, refinement: entry.refinement };
    }
  }
  return null;
}

async function concurrentPolicyReplays(replayCount, maxInFlight, execute) {
  const results = new Array(replayCount);
  let next = 0;
  let inFlight = 0;
  let maxObservedInFlight = 0;
  const workerCount = Math.min(replayCount, maxInFlight);
  const worker = async () => {
    while (next < replayCount) {
      const replay = next;
      next += 1;
      inFlight += 1;
      maxObservedInFlight = Math.max(maxObservedInFlight, inFlight);
      try {
        results[replay] = await execute(replay);
      } finally {
        inFlight -= 1;
      }
    }
  };
  await Promise.all(Array.from({ length: workerCount }, worker));
  return { results, maxObservedInFlight };
}

/// Replays one verified trace input for every declared execution policy.
///
/// The bounded scheduler controls client-side pressure only. It records output
/// and declared effect consistency for duplicate inputs; it does not observe an
/// implementation's internal queue, DB isolation, or global idempotency store.
export async function exerciseIntentExecutionPolicies(model, document, invoke) {
  const errors = [];
  const observations = [];
  const documentRecord = record(document);
  if (!documentRecord || !Array.isArray(documentRecord.traces)) {
    return {
      status: "fail",
      summary: { policies: 0, replays: 0 },
      observations,
      errors: ["invalid intent trace document"],
    };
  }
  if (typeof invoke !== "function") {
    return {
      status: "fail",
      summary: { policies: 0, replays: 0 },
      observations,
      errors: ["intent refinement invoker must be a function"],
    };
  }

  const processes = intentProcesses(model)
    .filter((process) => process.execution)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
  if (processes.length === 0) {
    return {
      status: "skip",
      summary: { policies: 0, replays: 0 },
      observations,
      errors,
      reason: "model declares no Intent execution policies",
    };
  }

  const outcomes = new Map(intentOutcomes(model).map((outcome) => [outcome.id, outcome]));
  const refinements = refinementIndex(model);
  let replays = 0;
  for (const process of processes) {
    const policy = process.execution;
    const seed = policyTraceSeed(documentRecord, process, refinements);
    if (!seed) {
      errors.push(`execution policy ${process.id}: no executable trace step`);
      continue;
    }
    if (!Number.isInteger(policy.maxInFlight) || policy.maxInFlight < 1) {
      errors.push(`execution policy ${process.id}: maxInFlight must be a positive integer`);
      continue;
    }
    const input = record(seed.step?.input);
    const implementationField = policy.idempotencyKey
      ? implementationFieldFor(seed.refinement, policy.idempotencyKey)
      : null;
    if (policy.idempotencyKey && (!input || !implementationField || !hasOwn(input, implementationField))) {
      errors.push(`execution policy ${process.id}: trace seed does not provide idempotency key ${policy.idempotencyKey}`);
      continue;
    }

    const replayCount = policy.maxInFlight + 1;
    replays += replayCount;
    const run = async (replay) => {
      const startedAt = Date.now();
      const invocation = { replay, status: "pass" };
      try {
        const actual = await invoke(seed.refinement, seed.step.input, {
          model,
          trace: seed.trace,
          traceId: seed.traceId,
          step: seed.stepIndex,
          process,
          expectedOutput: seed.step.output,
          expectedEffects: seed.step.effects,
          outcome: outcomes.get(seed.step.outcome),
          executionPolicy: {
            replay,
            replayCount,
            maxInFlight: policy.maxInFlight,
            idempotencyKey: policy.idempotencyKey ?? null,
            timeoutMs: policy.timeoutMs ?? null,
          },
        });
        const observed = executionObservation(actual);
        invocation.outputMatchesObserved = matchingJsonValues(observed.output, seed.step.output);
        invocation.effectsMatchObserved = observed.effects === null
          ? null
          : matchingJsonValues(normalizedEffects(observed.effects), normalizedEffects(seed.step.effects));
        if (!invocation.outputMatchesObserved) {
          const message = `execution policy ${process.id} replay ${replay}: output does not match observed trace`;
          errors.push(message);
          invocation.status = "fail";
          invocation.error = message;
        } else if (invocation.effectsMatchObserved === false) {
          const message = `execution policy ${process.id} replay ${replay}: effects do not match observed trace`;
          errors.push(message);
          invocation.status = "fail";
          invocation.error = message;
        }
        if (observed.transaction !== null) invocation.transaction = observed.transaction;
      } catch (error) {
        const message = `execution policy ${process.id} replay ${replay}: execution failed: ${executionError(error)}`;
        errors.push(message);
        invocation.status = "fail";
        invocation.error = message;
      }
      invocation.durationMs = Date.now() - startedAt;
      return invocation;
    };
    const pressure = await concurrentPolicyReplays(replayCount, policy.maxInFlight, run);
    const effectInvocations = pressure.results.filter((invocation) => invocation.effectsMatchObserved !== null);
    observations.push({
      process: process.id,
      refinement: seed.refinement.id,
      traceId: seed.traceId,
      step: seed.stepIndex,
      idempotency: policy.idempotencyKey
        ? {
          contractField: policy.idempotencyKey,
          implementationField,
          value: input[implementationField],
          replayedSameKey: true,
        }
        : null,
      timeout: {
        timeoutSteps: policy.timeoutSteps ?? null,
        timeoutMs: policy.timeoutMs ?? null,
      },
      pressure: {
        replayCount,
        maxInFlight: policy.maxInFlight,
        maxObservedInFlight: pressure.maxObservedInFlight,
        scope: "client-scheduled",
      },
      result: {
        outputMatchesObserved: pressure.results.every((invocation) => invocation.outputMatchesObserved === true),
        effectsMatchObserved: effectInvocations.length === 0
          ? null
          : effectInvocations.every((invocation) => invocation.effectsMatchObserved === true),
      },
      invocations: pressure.results,
      status: pressure.results.every((invocation) => invocation.status === "pass") ? "pass" : "fail",
    });
  }
  return {
    status: errors.length === 0 ? "pass" : "fail",
    summary: { policies: processes.length, replays },
    observations,
    errors,
  };
}

export function verifyIntentTraces(model, document, options = {}) {
  const errors = [];
  const traceErrors = [];
  const documentRecord = record(document);
  const staticErrors = list(options.staticErrors);
  const refinementErrors = list(options.refinementErrors);
  errors.push(...staticErrors, ...refinementErrors);

  if (!documentRecord) {
    errors.push("invalid intent trace document");
  } else {
    if (documentRecord.schemaVersion !== "1.0") {
      errors.push(`unsupported intent trace schema version: ${documentRecord.schemaVersion ?? "missing"}`);
    }
    if (documentRecord.model?.id !== model.id) {
      errors.push(`intent trace model id mismatch: expected ${model.id}, got ${documentRecord.model?.id ?? "missing"}`);
    }
    if (documentRecord.model?.version !== model.version) {
      errors.push(`intent trace model version mismatch: expected ${model.version}, got ${documentRecord.model?.version ?? "missing"}`);
    }
  }

  const processes = new Map(intentProcesses(model).map((process) => [process.id, process]));
  const outcomes = new Map(intentOutcomes(model).map((outcome) => [outcome.id, outcome]));
  const states = stateIds(model);
  const authorities = new Set(constructionAuthorities(model).map((authority) => `${authority.process}\u0000${authority.outcome}`));
  const refinements = refinementIndex(model);
  const traces = list(documentRecord?.traces);
  if (documentRecord && !Array.isArray(documentRecord.traces)) errors.push("intent trace document traces must be an array");

  const seenTraceIds = new Set();
  const traceReports = [];
  let steps = 0;
  let observedEffects = 0;
  const effectErrors = [];
  const hasEffectContracts = intentOutcomes(model).some((outcome) => outcomeEffects(outcome).length > 0);
  for (const trace of traces) {
    const before = errors.length;
    const traceId = typeof trace?.id === "string" && trace.id.length > 0 ? trace.id : `index-${traceReports.length}`;
    if (seenTraceIds.has(traceId)) traceError(errors, traceId, null, "duplicate trace id");
    seenTraceIds.add(traceId);
    if (!trace?.id) traceError(errors, traceId, null, "missing trace id");
    if (typeof trace?.source !== "string" || trace.source.length === 0) traceError(errors, traceId, null, "missing trace source");
    if (trace?.observedAt !== undefined && !validTimestamp(trace.observedAt)) traceError(errors, traceId, null, "invalid observedAt timestamp");
    if (!states.has(trace?.initialState)) traceError(errors, traceId, null, `unknown initial state ${trace?.initialState ?? "missing"}`);
    if (!states.has(trace?.expectedState)) traceError(errors, traceId, null, `unknown expected state ${trace?.expectedState ?? "missing"}`);
    const traceSteps = list(trace?.steps);
    if (!Array.isArray(trace?.steps) || traceSteps.length === 0) traceError(errors, traceId, null, "trace has no steps");
    let currentState = trace?.initialState;

    for (const [stepIndex, step] of traceSteps.entries()) {
      steps += 1;
      const process = processes.get(step?.process);
      const outcome = outcomes.get(step?.outcome);
      if (!process) {
        traceError(errors, traceId, stepIndex, `unknown process ${step?.process ?? "missing"}`);
        continue;
      }
      if (process.input !== currentState) {
        traceError(errors, traceId, stepIndex, `process input state ${process.input} does not match current state ${currentState ?? "missing"}`);
      }
      if (!outcome || !list(process.outcomes).includes(step.outcome)) {
        traceError(errors, traceId, stepIndex, `outcome ${step?.outcome ?? "missing"} is not declared by process ${process.id}`);
        continue;
      }
      if (!authorities.has(`${process.id}\u0000${outcome.id}`)) {
        traceError(errors, traceId, stepIndex, `outcome ${outcome.id} has no construction authority for process ${process.id}`);
      }
      if (!list(process.transitions).some((transition) => transition.from === process.input && transition.to === outcome.state)) {
        traceError(errors, traceId, stepIndex, `outcome ${outcome.id} has no declared transition from ${process.input}`);
      }

      let outcomeBinding = null;
      const refinementEntry = refinements.get(step?.refinement);
      if (!refinementEntry) {
        traceError(errors, traceId, stepIndex, `unknown refinement ${step?.refinement ?? "missing"}`);
      } else if (refinementEntry.process.id !== process.id) {
        traceError(errors, traceId, stepIndex, `refinement ${step.refinement} belongs to process ${refinementEntry.process.id}`);
      } else {
        validatePayload(process.inputContract, refinementEntry.refinement.inputBindings, step?.input, `trace ${traceId} step ${stepIndex} input`, errors);
        outcomeBinding = list(refinementEntry.refinement.outcomeBindings).find((binding) => binding.outcome === outcome.id);
        validatePayload(outcome.outputContract, outcomeBinding?.fields, step?.output, `trace ${traceId} step ${stepIndex} output`, errors);
      }
      const effectBefore = errors.length;
      observedEffects += validateObservedEffects(outcome, outcomeBinding, step?.effects, `trace ${traceId} step ${stepIndex}`, errors);
      effectErrors.push(...errors.slice(effectBefore));
      currentState = outcome.state;
    }
    if (traceSteps.length > 0 && currentState !== trace?.expectedState) {
      traceError(errors, traceId, null, `expected state ${trace?.expectedState ?? "missing"}, got ${currentState ?? "missing"}`);
    }
    const entryErrors = errors.slice(before).filter((error) => error.startsWith(`trace ${traceId}`));
    traceErrors.push(...entryErrors);
    traceReports.push(traceSummaryRecord(trace, entryErrors.length === 0 ? "pass" : "fail", entryErrors));
  }

  const staticStatus = staticErrors.length === 0 ? "pass" : "fail";
  const refinementStatus = refinementErrors.length === 0 ? "pass" : "fail";
  const traceStatus = traceErrors.length === 0 && documentRecord ? "pass" : "fail";
  return {
    model: { id: model.id, version: model.version },
    status: errors.length === 0 ? "pass" : "fail",
    summary: {
      traces: traces.length,
      steps,
      refinements: refinements.size,
      contracts: intentProcesses(model).filter((process) => process.inputContract).length
        + intentOutcomes(model).filter((outcome) => outcome.outputContract).length,
      observedEffects,
    },
    traces: traceReports,
    evidence: {
      assumptions: [
        "observed trace sources are trusted inputs",
        "trace verification is bounded to the supplied finite observations",
        "IntentDataContract.clauses require separate backend or conformance evidence",
      ],
      checks: [
        { id: "intent-static-contract", scope: "model", status: staticStatus, errors: staticErrors },
        { id: "intent-refinement-reference", scope: "implementation-reference", status: refinementStatus, errors: refinementErrors },
        { id: "intent-observed-trace", scope: "observed-trace", status: traceStatus, errors: traceErrors },
        ...(hasEffectContracts
          ? [{ id: "intent-observed-effect", scope: "outcome-postcondition", status: effectErrors.length === 0 ? "pass" : "fail", errors: effectErrors }]
          : []),
      ],
    },
    errors,
  };
}
