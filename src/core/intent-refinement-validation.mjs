import { validateIntentFieldBindings, } from "./intent-data-contract-validation.mjs";
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
function checkUniqueIdentifiers(errors, label, identifiers) {
    const seen = new Set();
    for (const identifier of identifiers) {
        if (seen.has(identifier))
            errors.push(`duplicate ${label}: ${identifier}`);
        seen.add(identifier);
    }
}
function hasRequiredFields(contract) {
    return list(contract?.fields).some((field) => field.required !== false);
}
export function createIntentRefinementValidationState() {
    return { seenIds: new Set() };
}
export function intentRefinements(process) {
    return list(record(process)?.refinements);
}
export function validateIntentRefinements(processValue, outcomesValue, dbTransactionsValue, state) {
    const errors = [];
    const process = processValue;
    const outcomes = list(outcomesValue);
    const dbTransactions = list(dbTransactionsValue);
    const outcomesById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
    const dbTransactionIds = new Set(dbTransactions.map((transaction) => transaction.id));
    const declaredOutcomes = list(process.outcomes);
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
        if (refinement.transaction
            && !dbTransactionIds.has(refinement.transaction.dbTransaction)) {
            errors.push(`unknown intent transaction refinement DB transaction: ${process.id}.${refinement.id} -> ${refinement.transaction.dbTransaction}`);
        }
        errors.push(...validateIntentFieldBindings(`${process.id}.${refinement.id} input`, process.inputContract, refinement.inputBindings));
        const bindingsByOutcome = new Map();
        const outcomeBindings = list(refinement.outcomeBindings);
        checkUniqueIdentifiers(errors, `intent refinement outcome binding in ${process.id}.${refinement.id}`, outcomeBindings.map((binding) => binding.outcome));
        for (const binding of outcomeBindings) {
            if (!declaredOutcomes.includes(binding.outcome)) {
                errors.push(`unknown intent refinement outcome: ${process.id}.${refinement.id} -> ${binding.outcome}`);
                continue;
            }
            bindingsByOutcome.set(binding.outcome, binding);
            const outcome = outcomesById.get(binding.outcome);
            errors.push(...validateIntentFieldBindings(`${process.id}.${refinement.id} outcome ${binding.outcome}`, outcome?.outputContract, binding.fields));
            const outcomeEffects = list(outcome?.effects);
            const effectBindings = list(binding.effectBindings);
            checkUniqueIdentifiers(errors, `intent refinement effect binding in ${process.id}.${refinement.id} outcome ${binding.outcome}`, effectBindings.map((effectBinding) => effectBinding.effect));
            const effectBindingsById = new Map();
            for (const effectBinding of effectBindings) {
                const effect = outcomeEffects.find((candidate) => candidate.id === effectBinding.effect);
                if (!effect) {
                    errors.push(`unknown intent refinement outcome effect: ${process.id}.${refinement.id}.${binding.outcome} -> ${effectBinding.effect}`);
                    continue;
                }
                effectBindingsById.set(effect.id, effectBinding);
                errors.push(...validateIntentFieldBindings(`${process.id}.${refinement.id} outcome ${binding.outcome} effect ${effect.id}`, effect.outputContract, effectBinding.fields));
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
