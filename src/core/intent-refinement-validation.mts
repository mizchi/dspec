import {
  type IntentContractField,
  type IntentDataContract,
  validateIntentFieldBindings,
} from "./intent-data-contract-validation.mjs";

type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

type IntentEffect = Identified & {
  outputContract?: IntentDataContract | null;
};

type IntentOutcome = Identified & {
  effects?: IntentEffect[];
  outputContract?: IntentDataContract | null;
};

type IntentEffectBinding = {
  effect: string;
  fields?: unknown;
};

type IntentOutcomeBinding = {
  effectBindings?: IntentEffectBinding[];
  fields?: unknown;
  outcome: string;
};

export type IntentRefinement = Identified & {
  grpc?: unknown;
  http?: unknown;
  inputBindings?: unknown;
  kind: string;
  outcomeBindings?: IntentOutcomeBinding[];
  transaction?: {
    dbTransaction: string;
  } | null;
};

type IntentProcess = Identified & {
  inputContract?: IntentDataContract | null;
  outcomes?: Array<string | null | undefined>;
  refinements?: IntentRefinement[];
};

export type IntentRefinementValidationState = {
  readonly seenIds: Set<string | null | undefined>;
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

function checkUniqueIdentifiers(errors: string[], label: string, identifiers: readonly unknown[]): void {
  const seen = new Set<unknown>();
  for (const identifier of identifiers) {
    if (seen.has(identifier)) errors.push(`duplicate ${label}: ${identifier}`);
    seen.add(identifier);
  }
}

function hasRequiredFields(contract: IntentDataContract | null | undefined): boolean {
  return list<IntentContractField>(contract?.fields).some((field) => field.required !== false);
}

export function createIntentRefinementValidationState(): IntentRefinementValidationState {
  return { seenIds: new Set() };
}

export function intentRefinements(process: unknown): IntentRefinement[] {
  return list<IntentRefinement>(record(process)?.refinements);
}

export function validateIntentRefinements(
  processValue: unknown,
  outcomesValue: unknown,
  dbTransactionsValue: unknown,
  state: IntentRefinementValidationState,
): string[] {
  const errors: string[] = [];
  const process = processValue as IntentProcess;
  const outcomes = list<IntentOutcome>(outcomesValue);
  const dbTransactions = list<Identified>(dbTransactionsValue);
  const outcomesById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const dbTransactionIds = new Set(dbTransactions.map((transaction) => transaction.id));
  const declaredOutcomes = list<string | null | undefined>(process.outcomes);
  const refinements = intentRefinements(process);
  checkUnique(errors, `intent refinement id in ${process.id}`, refinements);

  for (const refinement of refinements) {
    if (state.seenIds.has(refinement.id)) {
      errors.push(`duplicate intent refinement id: ${refinement.id}`);
    }
    state.seenIds.add(refinement.id);
    if (refinement.kind === "http-route" && !refinement.http) {
      errors.push(`intent HTTP refinement requires endpoint: ${process.id}.${refinement.id}`);
    }
    if (refinement.kind !== "http-route" && refinement.http) {
      errors.push(`intent refinement HTTP endpoint requires http-route kind: ${process.id}.${refinement.id}`);
    }
    if (refinement.kind === "grpc-method" && !refinement.grpc) {
      errors.push(`intent gRPC refinement requires endpoint: ${process.id}.${refinement.id}`);
    }
    if (refinement.kind !== "grpc-method" && refinement.grpc) {
      errors.push(`intent refinement gRPC endpoint requires grpc-method kind: ${process.id}.${refinement.id}`);
    }
    if (refinement.kind === "transaction" && !refinement.transaction) {
      errors.push(`intent transaction refinement requires endpoint: ${process.id}.${refinement.id}`);
    }
    if (refinement.kind !== "transaction" && refinement.transaction) {
      errors.push(`intent refinement transaction endpoint requires transaction kind: ${process.id}.${refinement.id}`);
    }
    if (
      refinement.transaction
      && !dbTransactionIds.has(refinement.transaction.dbTransaction)
    ) {
      errors.push(`unknown intent transaction refinement DB transaction: ${process.id}.${refinement.id} -> ${refinement.transaction.dbTransaction}`);
    }
    errors.push(...validateIntentFieldBindings(
      `${process.id}.${refinement.id} input`,
      process.inputContract,
      refinement.inputBindings,
    ));

    const bindingsByOutcome = new Map<string | null | undefined, IntentOutcomeBinding>();
    const outcomeBindings = list<IntentOutcomeBinding>(refinement.outcomeBindings);
    checkUniqueIdentifiers(
      errors,
      `intent refinement outcome binding in ${process.id}.${refinement.id}`,
      outcomeBindings.map((binding) => binding.outcome),
    );
    for (const binding of outcomeBindings) {
      if (!declaredOutcomes.includes(binding.outcome)) {
        errors.push(`unknown intent refinement outcome: ${process.id}.${refinement.id} -> ${binding.outcome}`);
        continue;
      }
      bindingsByOutcome.set(binding.outcome, binding);
      const outcome = outcomesById.get(binding.outcome);
      errors.push(...validateIntentFieldBindings(
        `${process.id}.${refinement.id} outcome ${binding.outcome}`,
        outcome?.outputContract,
        binding.fields,
      ));
      const outcomeEffects = list<IntentEffect>(outcome?.effects);
      const effectBindings = list<IntentEffectBinding>(binding.effectBindings);
      checkUniqueIdentifiers(
        errors,
        `intent refinement effect binding in ${process.id}.${refinement.id} outcome ${binding.outcome}`,
        effectBindings.map((effectBinding) => effectBinding.effect),
      );
      const effectBindingsById = new Map<string | null | undefined, IntentEffectBinding>();
      for (const effectBinding of effectBindings) {
        const effect = outcomeEffects.find((candidate) => candidate.id === effectBinding.effect);
        if (!effect) {
          errors.push(`unknown intent refinement outcome effect: ${process.id}.${refinement.id}.${binding.outcome} -> ${effectBinding.effect}`);
          continue;
        }
        effectBindingsById.set(effect.id, effectBinding);
        errors.push(...validateIntentFieldBindings(
          `${process.id}.${refinement.id} outcome ${binding.outcome} effect ${effect.id}`,
          effect.outputContract,
          effectBinding.fields,
        ));
      }
      for (const effect of outcomeEffects) {
        if (hasRequiredFields(effect.outputContract) && !effectBindingsById.has(effect.id)) {
          errors.push(`intent refinement missing effect binding: ${process.id}.${refinement.id}.${binding.outcome} -> ${effect.id}`);
        }
      }
    }
    for (const outcomeId of declaredOutcomes) {
      const outcome = outcomesById.get(outcomeId);
      if (hasRequiredFields(outcome?.outputContract) && !bindingsByOutcome.has(outcomeId)) {
        errors.push(`intent refinement missing outcome binding: ${process.id}.${refinement.id} -> ${outcomeId}`);
      }
    }
  }

  return errors;
}
