type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

type VocabularyTerm = Identified & {
  kind?: string | null;
};

type IntentProcess = Identified & {
  input: string;
  outcomes?: Array<string | null | undefined>;
};

type IntentOutcome = Identified & {
  state: string;
};

type IntentScenarioStep = {
  outcome: string;
  process: string;
};

export type IntentScenario = Identified & {
  expectedState: string;
  initialState: string;
  steps?: IntentScenarioStep[];
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function intentScenarios(intent: unknown): IntentScenario[] {
  return list<IntentScenario>(record(intent)?.scenarios);
}

export function validateIntentScenarios(
  vocabularyValue: unknown,
  processesValue: unknown,
  outcomesValue: unknown,
  scenariosValue: unknown,
): string[] {
  const errors: string[] = [];
  const vocabulary = list<VocabularyTerm>(vocabularyValue);
  const processes = list<IntentProcess>(processesValue);
  const outcomes = list<IntentOutcome>(outcomesValue);
  const scenarios = list<IntentScenario>(scenariosValue);
  const stateIds = new Set(
    vocabulary.filter((term) => term.kind === "state").map((term) => term.id),
  );
  const processesById = new Map(processes.map((process) => [process.id, process]));
  const outcomesById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));

  for (const scenario of scenarios) {
    if (!stateIds.has(scenario.initialState)) {
      errors.push(`unknown intent scenario initial state: ${scenario.id} -> ${scenario.initialState}`);
    }
    if (!stateIds.has(scenario.expectedState)) {
      errors.push(`unknown intent scenario expected state: ${scenario.id} -> ${scenario.expectedState}`);
    }
    const steps = list<IntentScenarioStep>(scenario.steps);
    if (steps.length === 0) {
      errors.push(`intent scenario has no steps: ${scenario.id}`);
      continue;
    }

    let currentState = scenario.initialState;
    for (const [index, step] of steps.entries()) {
      const process = processesById.get(step.process);
      const outcome = outcomesById.get(step.outcome);
      const context = `${scenario.id}[${index}]`;
      if (!process) {
        errors.push(`unknown intent scenario process: ${context} -> ${step.process}`);
      }
      if (!outcome) {
        errors.push(`unknown intent scenario outcome: ${context} -> ${step.outcome}`);
      }
      if (!process || !outcome) continue;
      if (process.input !== currentState) {
        errors.push(`intent scenario input state mismatch: ${context} expected ${currentState}, process accepts ${process.input}`);
      }
      if (!list<string | null | undefined>(process.outcomes).includes(outcome.id)) {
        errors.push(`intent scenario outcome is not declared by process: ${context} -> ${outcome.id}`);
      }
      currentState = outcome.state;
    }
    if (currentState !== scenario.expectedState) {
      errors.push(`intent scenario expected state mismatch: ${scenario.id} expected ${scenario.expectedState}, actual ${currentState}`);
    }
  }

  return errors;
}
