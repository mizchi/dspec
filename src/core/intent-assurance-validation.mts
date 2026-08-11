type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

export type IntentGoal = Identified & {
  claims?: Array<string | null>;
  intents?: Array<string | null>;
};

export type IntentClaim = Identified & {
  processes?: Array<string | null>;
};

export type IntentAssuranceTask = Identified & {
  assurance?: string | null;
  backend?: string | null;
  claims?: Array<string | null>;
  kind?: string | null;
  target: {
    kind?: string | null;
  };
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function checkUniqueIdentifiers(errors: string[], label: string, identifiers: readonly unknown[]): void {
  const seen = new Set<unknown>();
  for (const identifier of identifiers) {
    if (seen.has(identifier)) errors.push(`duplicate ${label}: ${identifier}`);
    seen.add(identifier);
  }
}

export function intentGoals(intent: unknown): IntentGoal[] {
  return list<IntentGoal>(record(intent)?.goals);
}

export function intentClaims(intent: unknown): IntentClaim[] {
  return list<IntentClaim>(record(intent)?.claims);
}

export function intentAssuranceTasks(intent: unknown): IntentAssuranceTask[] {
  return list<IntentAssuranceTask>(record(intent)?.assuranceTasks);
}

export function validateIntentGoalClaimAssurance(
  processesValue: unknown,
  goalsValue: unknown,
  claimsValue: unknown,
  assuranceTasksValue: unknown,
): string[] {
  const errors: string[] = [];
  const processes = list<Identified>(processesValue);
  const goals = list<IntentGoal>(goalsValue);
  const claims = list<IntentClaim>(claimsValue);
  const assuranceTasks = list<IntentAssuranceTask>(assuranceTasksValue);
  const processesById = new Map(processes.map((process) => [process.id, process]));
  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));

  const claimGoals = new Map<string | null | undefined, IntentGoal[]>();
  for (const goal of goals) {
    const goalIntents = list<string | null>(goal.intents);
    const goalClaims = list<string | null>(goal.claims);
    checkUniqueIdentifiers(errors, `intent goal process in ${goal.id}`, goalIntents);
    checkUniqueIdentifiers(errors, `intent goal claim in ${goal.id}`, goalClaims);
    if (goalIntents.length === 0) errors.push(`intent goal has no processes: ${goal.id}`);
    if (goalClaims.length === 0) errors.push(`intent goal has no claims: ${goal.id}`);
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

  const taskCoveredClaimIds = new Set<string | null | undefined>();
  for (const claim of claims) {
    const claimProcesses = list<string | null>(claim.processes);
    checkUniqueIdentifiers(errors, `intent claim process in ${claim.id}`, claimProcesses);
    if (claimProcesses.length === 0) errors.push(`intent claim has no processes: ${claim.id}`);
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
        if (!list<string | null>(goal.intents).includes(processId)) {
          errors.push(`intent claim process is outside goal intent: ${claim.id} -> ${processId}`);
        }
      }
    }
  }

  for (const task of assuranceTasks) {
    const taskClaims = list<string | null>(task.claims);
    checkUniqueIdentifiers(errors, `intent assurance task claim in ${task.id}`, taskClaims);
    if (taskClaims.length === 0) errors.push(`intent assurance task has no claims: ${task.id}`);
    for (const claimId of taskClaims) {
      if (!claimsById.has(claimId)) {
        errors.push(`unknown intent assurance task claim: ${task.id} -> ${claimId}`);
      } else {
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
