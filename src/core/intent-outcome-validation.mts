import { validateIntentDataContract } from "./intent-data-contract-validation.mjs";

type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

type VocabularyTerm = Identified & {
  kind?: string | null;
};

type IntentEffect = Identified & {
  capability: string;
  outputContract?: unknown;
};

export type IntentOutcome = Identified & {
  effects?: IntentEffect[];
  outputContract?: unknown;
  state: string;
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

export function intentCapabilities(intent: unknown): Identified[] {
  return list<Identified>(record(intent)?.capabilities);
}

export function intentOutcomes(intent: unknown): IntentOutcome[] {
  return list<IntentOutcome>(record(intent)?.outcomes);
}

export function validateIntentOutcomes(
  vocabularyValue: unknown,
  capabilitiesValue: unknown,
  outcomesValue: unknown,
): string[] {
  const errors: string[] = [];
  const vocabulary = list<VocabularyTerm>(vocabularyValue);
  const capabilities = list<Identified>(capabilitiesValue);
  const outcomes = list<IntentOutcome>(outcomesValue);
  const stateIds = new Set(
    vocabulary.filter((term) => term.kind === "state").map((term) => term.id),
  );
  const capabilityIds = new Set(capabilities.map((capability) => capability.id));
  const outcomeStates = new Set<string>();

  for (const outcome of outcomes) {
    if (!stateIds.has(outcome.state)) {
      errors.push(`unknown intent outcome state: ${outcome.id} -> ${outcome.state}`);
    }
    if (outcomeStates.has(outcome.state)) {
      errors.push(`duplicate intent outcome state: ${outcome.state}`);
    }
    outcomeStates.add(outcome.state);
    errors.push(...validateIntentDataContract(`${outcome.id} output`, outcome.outputContract));
    const effects = list<IntentEffect>(outcome.effects);
    checkUnique(errors, `intent outcome effect id in ${outcome.id}`, effects);
    for (const effect of effects) {
      if (!capabilityIds.has(effect.capability)) {
        errors.push(`unknown intent outcome effect capability: ${outcome.id}.${effect.id} -> ${effect.capability}`);
      }
      errors.push(...validateIntentDataContract(
        `${outcome.id} effect ${effect.id} output`,
        effect.outputContract,
      ));
    }
  }

  return errors;
}
