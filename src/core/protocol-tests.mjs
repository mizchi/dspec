export const PROTOCOL_TEST_PLAN_SCHEMA_VERSION = "1.0";

function list(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

function byId(left, right) {
  return String(left.id).localeCompare(String(right.id));
}

function intent(model) {
  return model?.patterns?.intent ?? null;
}

function fieldMap(contract) {
  return new Map(list(contract?.fields).map((field) => [field.id, field]));
}

function bindingMap(bindings) {
  return new Map(list(bindings).map((binding) => [binding.contractField, binding.implementationField]));
}

function scalar(field, raw, location, errors) {
  if (typeof raw !== "string") {
    errors.push(`${location}: field ${field.id} must be encoded as a string`);
    return undefined;
  }
  let value;
  if (field.type === "integer") {
    if (!/^-?(0|[1-9][0-9]*)$/.test(raw)) {
      errors.push(`${location}: field ${field.id} expected integer`);
      return undefined;
    }
    value = Number(raw);
  } else if (field.type === "boolean") {
    if (raw !== "true" && raw !== "false") {
      errors.push(`${location}: field ${field.id} expected boolean`);
      return undefined;
    }
    value = raw === "true";
  } else {
    value = raw;
    if (field.type === "identifier" && !/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(value)) {
      errors.push(`${location}: field ${field.id} expected identifier`);
      return undefined;
    }
  }
  const comparable = String(value);
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
      if (!(new RegExp(field.pattern)).test(value)) errors.push(`${location}: field ${field.id} does not match pattern`);
    } catch {
      errors.push(`${location}: field ${field.id} has an invalid model pattern`);
    }
  }
  return value;
}

function materializePayload(contract, bindings, values, location, errors) {
  const fields = fieldMap(contract);
  const source = record(values);
  for (const id of Object.keys(source)) {
    if (!fields.has(id)) errors.push(`${location}: unknown field ${id}`);
  }
  const mapped = {};
  const mappedBindings = bindingMap(bindings);
  for (const field of [...fields.values()].sort(byId)) {
    if (!Object.hasOwn(source, field.id)) {
      if (field.required !== false) errors.push(`${location}: missing required field ${field.id}`);
      continue;
    }
    const implementationField = mappedBindings.get(field.id);
    if (!implementationField) {
      errors.push(`${location}: missing refinement binding for field ${field.id}`);
      continue;
    }
    const value = scalar(field, source[field.id], location, errors);
    if (value !== undefined) mapped[implementationField] = value;
  }
  return stableObject(mapped);
}

function transportFor(refinement, testCase, location, errors) {
  if (refinement.kind === "http-route") {
    if (!refinement.http) {
      errors.push(`${location}: HTTP refinement has no endpoint`);
      return null;
    }
    if (testCase.expectedGrpcCode !== null && testCase.expectedGrpcCode !== undefined) {
      errors.push(`${location}: expectedGrpcCode is only valid for grpc-method`);
    }
    return {
      kind: "http",
      method: refinement.http.method,
      path: refinement.http.path,
      expectedStatus: testCase.expectedStatus ?? refinement.http.expectedStatus,
    };
  }
  if (refinement.kind === "grpc-method") {
    if (!refinement.grpc) {
      errors.push(`${location}: gRPC refinement has no endpoint`);
      return null;
    }
    if (testCase.expectedStatus !== null && testCase.expectedStatus !== undefined) {
      errors.push(`${location}: expectedStatus is only valid for http-route`);
    }
    return {
      kind: "grpc",
      method: refinement.grpc.method,
      expectedCode: testCase.expectedGrpcCode ?? refinement.grpc.expectedCode,
    };
  }
  errors.push(`${location}: unsupported refinement transport ${refinement.kind}`);
  return null;
}

function materializeEffects(outcome, outcomeBinding, effectCases, location, errors) {
  const declared = new Map(list(outcome?.effects).map((effect) => [effect.id, effect]));
  const bindings = new Map(list(outcomeBinding?.effectBindings).map((binding) => [binding.effect, binding]));
  const cases = new Map(list(effectCases).map((effectCase) => [effectCase.effect, effectCase]));
  for (const effectCase of cases.values()) {
    if (!declared.has(effectCase.effect)) errors.push(`${location}: unknown effect ${effectCase.effect}`);
  }
  const effects = [];
  for (const effect of [...declared.values()].sort(byId)) {
    const effectCase = cases.get(effect.id);
    if (!effectCase) {
      if (effect.required !== false) errors.push(`${location}: missing required effect ${effect.id}`);
      continue;
    }
    effects.push({
      id: effect.id,
      output: materializePayload(effect.outputContract, bindings.get(effect.id)?.fields, effectCase.output, `${location} effect ${effect.id}`, errors),
    });
  }
  return effects;
}

/**
 * Turn reviewed, finite Intent contract cases into a transport-neutral plan
 * and an Intent trace document. The generated plan is executable evidence for
 * those declared cases; it is not a universal implementation proof.
 */
export function protocolTestPlan(model) {
  const errors = [];
  const intentModel = intent(model);
  if (!model?.id || !model?.version) errors.push("protocol test model id and version are required");
  if (!intentModel) errors.push("protocol test model has no Intent catalog");
  const processes = new Map(list(intentModel?.processes).map((process) => [process.id, process]));
  const outcomes = new Map(list(intentModel?.outcomes).map((outcome) => [outcome.id, outcome]));
  const tests = [...list(intentModel?.tests)].sort(byId);
  const seen = new Set();
  const operations = [];
  const traces = [];

  for (const testCase of tests) {
    const location = `protocol test ${testCase?.id ?? "missing"}`;
    if (!testCase?.id) {
      errors.push("protocol test id is missing");
      continue;
    }
    if (seen.has(testCase.id)) {
      errors.push(`duplicate protocol test id: ${testCase.id}`);
      continue;
    }
    seen.add(testCase.id);
    const before = errors.length;
    const process = processes.get(testCase.process);
    const outcome = outcomes.get(testCase.outcome);
    if (!process) {
      errors.push(`${location}: unknown process ${testCase.process ?? "missing"}`);
      continue;
    }
    if (!outcome || !list(process.outcomes).includes(testCase.outcome)) {
      errors.push(`${location}: outcome ${testCase.outcome ?? "missing"} is not declared by process ${process.id}`);
      continue;
    }
    const refinement = list(process.refinements).find((entry) => entry.id === testCase.refinement);
    if (!refinement) {
      errors.push(`${location}: unknown refinement ${testCase.refinement ?? "missing"}`);
      continue;
    }
    const transport = transportFor(refinement, testCase, location, errors);
    const outcomeBinding = list(refinement.outcomeBindings).find((binding) => binding.outcome === outcome.id);
    const input = materializePayload(process.inputContract, refinement.inputBindings, testCase.input, `${location} input`, errors);
    const output = materializePayload(outcome.outputContract, outcomeBinding?.fields, testCase.output, `${location} output`, errors);
    const effects = materializeEffects(outcome, outcomeBinding, testCase.effects, location, errors);
    if (errors.length !== before || !transport) continue;
    const expected = { output, ...(effects.length > 0 ? { effects } : {}) };
    operations.push({
      id: testCase.id,
      process: process.id,
      refinement: refinement.id,
      outcome: outcome.id,
      input,
      expected,
      transport,
    });
    traces.push({
      id: `protocol/${testCase.id}`,
      source: `model://${model.id}/protocol-test/${testCase.id}`,
      initialState: process.input,
      expectedState: outcome.state,
      steps: [{
        process: process.id,
        refinement: refinement.id,
        outcome: outcome.id,
        input,
        output,
        ...(effects.length > 0 ? { effects } : {}),
        transport: transport.kind === "http"
          ? { kind: "http", expectedStatus: transport.expectedStatus }
          : { kind: "grpc", expectedCode: transport.expectedCode },
      }],
    });
  }

  const orderedOperations = operations.sort(byId);
  const orderedTraces = traces.sort(byId);
  return {
    protocolTestPlanSchemaVersion: PROTOCOL_TEST_PLAN_SCHEMA_VERSION,
    status: errors.length === 0 ? "pass" : "fail",
    model: { id: model?.id ?? null, version: model?.version ?? null },
    summary: {
      cases: orderedOperations.length,
      http: orderedOperations.filter((operation) => operation.transport.kind === "http").length,
      grpc: orderedOperations.filter((operation) => operation.transport.kind === "grpc").length,
    },
    operations: orderedOperations,
    traceDocument: {
      schemaVersion: "1.0",
      model: { id: model?.id ?? null, version: model?.version ?? null },
      traces: orderedTraces,
    },
    errors: errors.sort(),
  };
}

export function validateProtocolTests(model) {
  return protocolTestPlan(model).errors;
}
