function list(value) {
  return Array.isArray(value) ? value : [];
}

function quintModuleName(value) {
  const name = String(value ?? "dspec")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (!name) return "dspec";
  return /^[0-9]/.test(name) ? `dspec_${name}` : name;
}

function quintString(value) {
  const text = String(value ?? "");
  const backendSafe = /^[\x20-\x7e]*$/.test(text)
    ? text
    : `utf8:${Buffer.from(text, "utf8").toString("base64url")}`;
  return JSON.stringify(backendSafe);
}

function quintSet(values) {
  return `Set(${values.map(quintString).join(", ")})`;
}

function automatedChecks(rule) {
  return list(rule?.checks)
    .filter((target) => target?.backend !== "manual" && target?.backend !== "runtime")
    .map((target) => String(target.ref))
    .sort();
}

function clauseTexts(rule) {
  return ["when", "must", "mustNot"].flatMap((field) =>
    list(rule?.[field]).map((clause) => clause?.ast
      ? `${clause.ast.op}:${clause.ast.name ?? ""}:${list(clause.ast.args).join(",")}`
      : String(clause?.text?.default ?? ""))
  );
}

function quintList(values) {
  return `List(${values.map(quintString).join(", ")})`;
}

function quintMap(entries) {
  return `Map(\n    ${entries.map(([key, value]) => `${quintString(key)} -> ${value}`).join(",\n    ")}\n  )`;
}

/**
 * Render the executable temporal core of a dspec model as Quint.
 *
 * Static projections remain responsible for checking the richer domain
 * contracts. This model checks the lifecycle of every active approved rule
 * and makes missing automated evidence reachable as an unsafe state.
 */
export function renderQuintModel(model) {
  const rules = list(model?.rules).slice().sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const activeApproved = rules.filter((rule) => rule.reviewStatus === "approved" && !rule.deprecated);
  const selectableRuleIds = activeApproved.length > 0
    ? activeApproved.map((rule) => String(rule.id))
    : ["__no_rules__"];
  const fallbackRules = activeApproved.length > 0
    ? []
    : [{ id: "__no_rules__", checks: [{ backend: "node", ref: "__no_rules__" }] }];
  const checkEntries = [...rules, ...fallbackRules]
    .map((rule) => `${quintString(rule.id)} -> ${quintSet(automatedChecks(rule))}`)
    .join(",\n    ");
  const clauseEntries = [...rules, ...fallbackRules]
    .map((rule) => `${quintString(rule.id)} -> ${quintList(clauseTexts(rule))}`)
    .join(",\n    ");
  const intentProcesses = list(model?.patterns?.intent?.processes)
    .filter((process) => process?.execution)
    .slice()
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const stateProcesses = intentProcesses.length > 0 ? intentProcesses : [{ id: "__no_intent__", execution: { maxInFlight: 1 } }];
  const timedProcesses = intentProcesses.filter((process) => Number.isInteger(process.execution.timeoutSteps));
  const executionKeyCount = Math.max(1, ...intentProcesses.map((process) => process.execution.maxInFlight));
  const maxInFlightMap = quintMap(stateProcesses.map((process) => [String(process.id), String(process.execution.maxInFlight)]));
  const timeoutStepsMap = quintMap(stateProcesses.map((process) => [
    String(process.id),
    String(Number.isInteger(process.execution.timeoutSteps) ? process.execution.timeoutSteps : 1),
  ]));

  return `module ${quintModuleName(model?.id)} {
  pure val clauseAstSemanticsVersion = ${quintString(model?.clauseAstSemanticsVersion)}
  pure val rules: Set[str] = ${quintSet(rules.map((rule) => String(rule.id)))}
  pure val activeApprovedRules: Set[str] = ${quintSet(activeApproved.map((rule) => String(rule.id)))}
  pure val selectableRules: Set[str] = ${quintSet(selectableRuleIds)}
  pure val checks: str -> Set[str] = Map(
    ${checkEntries}
  )
  pure val ruleClauses: str -> List[str] = Map(
    ${clauseEntries}
  )
  pure val workflowStates: Set[str] = Set("approved", "verified", "deprecated", "uncovered")
  pure val intentExecutionProcesses: Set[str] = ${quintSet(intentProcesses.map((process) => String(process.id)))}
  pure val intentStateProcesses: Set[str] = ${quintSet(stateProcesses.map((process) => String(process.id)))}
  pure val intentIdempotentProcesses: Set[str] = ${quintSet(intentProcesses.filter((process) => process.execution.idempotencyKey).map((process) => String(process.id)))}
  pure val intentTimedProcesses: Set[str] = ${quintSet(timedProcesses.map((process) => String(process.id)))}
  pure val intentProcessMaxInFlight: str -> int = ${maxInFlightMap}
  pure val intentProcessTimeoutSteps: str -> int = ${timeoutStepsMap}
  pure val intentExecutionKeySpace: Set[int] = 1.to(${executionKeyCount})

  var selectedRule: str
  var ruleState: str
  var intentInFlight: str -> int
  var intentActiveKeys: str -> Set[int]
  var intentElapsed: str -> int

  action init = {
    nondet rule = selectableRules.oneOf()
    all {
      selectedRule' = rule,
      ruleState' = "approved",
      intentInFlight' = intentStateProcesses.mapBy(_ => 0),
      intentActiveKeys' = intentStateProcesses.mapBy(_ => Set()),
      intentElapsed' = intentStateProcesses.mapBy(_ => 0),
    }
  }

  action markVerified = all {
    ruleState == "approved",
    checks.get(selectedRule).size() > 0,
    selectedRule' = selectedRule,
    ruleState' = "verified",
    intentInFlight' = intentInFlight,
    intentActiveKeys' = intentActiveKeys,
    intentElapsed' = intentElapsed,
  }

  action detectUncovered = all {
    ruleState == "approved",
    checks.get(selectedRule).size() == 0,
    selectedRule' = selectedRule,
    ruleState' = "uncovered",
    intentInFlight' = intentInFlight,
    intentActiveKeys' = intentActiveKeys,
    intentElapsed' = intentElapsed,
  }

  action deprecate = all {
    ruleState == "approved",
    selectedRule' = selectedRule,
    ruleState' = "deprecated",
    intentInFlight' = intentInFlight,
    intentActiveKeys' = intentActiveKeys,
    intentElapsed' = intentElapsed,
  }

  action intentStart = {
    nondet process = intentStateProcesses.oneOf()
    nondet key = intentExecutionKeySpace.oneOf()
    all {
      intentExecutionProcesses.contains(process),
      intentInFlight.get(process) < intentProcessMaxInFlight.get(process),
      not(intentIdempotentProcesses.contains(process)) or not(intentActiveKeys.get(process).contains(key)),
      selectedRule' = selectedRule,
      ruleState' = ruleState,
      intentInFlight' = intentInFlight.put(process, intentInFlight.get(process) + 1),
      intentActiveKeys' = if (intentIdempotentProcesses.contains(process))
        intentActiveKeys.put(process, intentActiveKeys.get(process).union(Set(key)))
      else
        intentActiveKeys,
      intentElapsed' = if (intentInFlight.get(process) == 0)
        intentElapsed.put(process, 0)
      else
        intentElapsed,
    }
  }

  action intentComplete = {
    nondet process = intentStateProcesses.oneOf()
    nondet key = intentExecutionKeySpace.oneOf()
    all {
      intentExecutionProcesses.contains(process),
      intentInFlight.get(process) > 0,
      not(intentIdempotentProcesses.contains(process)) or intentActiveKeys.get(process).contains(key),
      selectedRule' = selectedRule,
      ruleState' = ruleState,
      intentInFlight' = intentInFlight.put(process, intentInFlight.get(process) - 1),
      intentActiveKeys' = if (intentIdempotentProcesses.contains(process))
        intentActiveKeys.put(process, intentActiveKeys.get(process).exclude(Set(key)))
      else
        intentActiveKeys,
      intentElapsed' = if (intentInFlight.get(process) == 1)
        intentElapsed.put(process, 0)
      else
        intentElapsed,
    }
  }

  action intentTick = {
    nondet process = intentStateProcesses.oneOf()
    all {
      intentTimedProcesses.contains(process),
      intentInFlight.get(process) > 0,
      intentElapsed.get(process) < intentProcessTimeoutSteps.get(process),
      selectedRule' = selectedRule,
      ruleState' = ruleState,
      intentInFlight' = intentInFlight,
      intentActiveKeys' = intentActiveKeys,
      intentElapsed' = intentElapsed.put(process, intentElapsed.get(process) + 1),
    }
  }

  action intentExpire = {
    nondet process = intentStateProcesses.oneOf()
    all {
      intentTimedProcesses.contains(process),
      intentInFlight.get(process) > 0,
      intentElapsed.get(process) == intentProcessTimeoutSteps.get(process),
      selectedRule' = selectedRule,
      ruleState' = ruleState,
      intentInFlight' = intentInFlight.put(process, 0),
      intentActiveKeys' = intentActiveKeys.put(process, Set()),
      intentElapsed' = intentElapsed.put(process, 0),
    }
  }

  action stay = all {
    selectedRule' = selectedRule,
    ruleState' = ruleState,
    intentInFlight' = intentInFlight,
    intentActiveKeys' = intentActiveKeys,
    intentElapsed' = intentElapsed,
  }

  action step = any {
    markVerified,
    detectUncovered,
    deprecate,
    intentStart,
    intentComplete,
    intentTick,
    intentExpire,
    stay,
  }

  val coverageInvariant =
    activeApprovedRules.forall(rule => checks.get(rule).size() > 0)

  val workflowInvariant =
    workflowStates.contains(ruleState) and ruleState != "uncovered"

  val intentConcurrencyBounded =
    intentExecutionProcesses.forall(process =>
      intentInFlight.get(process) <= intentProcessMaxInFlight.get(process))

  val intentIdempotencyKeysAreExclusive =
    intentIdempotentProcesses.forall(process =>
      intentActiveKeys.get(process).size() == intentInFlight.get(process))

  val intentTimeoutsBounded =
    intentTimedProcesses.forall(process =>
      intentElapsed.get(process) <= intentProcessTimeoutSteps.get(process))
}
`;
}
