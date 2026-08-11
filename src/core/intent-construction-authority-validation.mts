type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

type IntentProcess = Identified & {
  constructs?: Array<string | null | undefined>;
};

export type IntentConstructionAuthority = Identified & {
  outcome: string;
  process: string;
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function intentConstructionAuthorities(intent: unknown): IntentConstructionAuthority[] {
  return list<IntentConstructionAuthority>(record(intent)?.constructionAuthorities);
}

export function validateIntentConstructionAuthorities(
  processesValue: unknown,
  outcomesValue: unknown,
  authoritiesValue: unknown,
): string[] {
  const errors: string[] = [];
  const processes = list<IntentProcess>(processesValue);
  const outcomes = list<Identified>(outcomesValue);
  const authorities = list<IntentConstructionAuthority>(authoritiesValue);
  const processesById = new Map(processes.map((process) => [process.id, process]));
  const outcomesById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const authorityPairs = new Set<string>();
  const authorityPairsByOutcome = new Map<string | null | undefined, number>();

  for (const authority of authorities) {
    const process = processesById.get(authority.process);
    const outcome = outcomesById.get(authority.outcome);
    if (!process) {
      errors.push(`unknown construction authority process: ${authority.id} -> ${authority.process}`);
    }
    if (!outcome) {
      errors.push(`unknown construction authority outcome: ${authority.id} -> ${authority.outcome}`);
    }
    const pair = `${authority.process}\u0000${authority.outcome}`;
    if (authorityPairs.has(pair)) {
      errors.push(`duplicate construction authority: ${authority.process} -> ${authority.outcome}`);
    }
    authorityPairs.add(pair);
    if (
      process
      && outcome
      && !list<string | null | undefined>(process.constructs).includes(outcome.id)
    ) {
      errors.push(`construction authority is not declared by process: ${authority.id} -> ${authority.outcome}`);
    }
    if (outcome) {
      authorityPairsByOutcome.set(
        outcome.id,
        (authorityPairsByOutcome.get(outcome.id) ?? 0) + 1,
      );
    }
  }

  for (const process of processes) {
    for (const outcomeId of list<string | null | undefined>(process.constructs)) {
      if (!authorityPairs.has(`${process.id}\u0000${outcomeId}`)) {
        errors.push(`intent process construction has no authority: ${process.id} -> ${outcomeId}`);
      }
    }
  }
  for (const outcome of outcomes) {
    if (!authorityPairsByOutcome.has(outcome.id)) {
      errors.push(`intent outcome has no construction authority: ${outcome.id}`);
    }
  }

  return errors;
}
