import { cloudNodes, cloudPattern } from "./cloud-model-validation.mjs";
import { dbPattern, dbTransactions } from "./db-model-validation.mjs";
import { intentAccessPolicies, validateIntentAccessPolicyPrecedence, validateIntentAccessPolicyReferences, } from "./intent-access-policy-validation.mjs";
import { intentAssuranceTasks, intentClaims, intentGoals, validateIntentGoalClaimAssurance, } from "./intent-assurance-validation.mjs";
import { intentConstructionAuthorities, validateIntentConstructionAuthorities, } from "./intent-construction-authority-validation.mjs";
import { intentCapabilities, intentOutcomes, validateIntentOutcomes, } from "./intent-outcome-validation.mjs";
import { intentProcesses, validateIntentProcess } from "./intent-process-validation.mjs";
import { createIntentRefinementValidationState, validateIntentRefinements, } from "./intent-refinement-validation.mjs";
import { intentScenarios, validateIntentScenarios, } from "./intent-scenario-validation.mjs";
import { intentSemanticBindings, validateIntentSemanticBindings, } from "./intent-semantic-binding-validation.mjs";
function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
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
export function intentPattern(model) {
    const patterns = record(record(model)?.patterns);
    const intent = record(patterns?.intent);
    return intent ? intent : null;
}
export function validateIntentCatalogUniqueness(intentValue) {
    const errors = [];
    const capabilities = intentCapabilities(intentValue);
    const outcomes = intentOutcomes(intentValue);
    const processes = intentProcesses(intentValue);
    const authorities = intentConstructionAuthorities(intentValue);
    const accessPolicies = intentAccessPolicies(intentValue);
    const goals = intentGoals(intentValue);
    const claims = intentClaims(intentValue);
    const assuranceTasks = intentAssuranceTasks(intentValue);
    const semanticBindings = intentSemanticBindings(intentValue);
    const scenarios = intentScenarios(intentValue);
    checkUnique(errors, "intent capability id", capabilities);
    checkUnique(errors, "intent outcome id", outcomes);
    checkUnique(errors, "intent process id", processes);
    checkUnique(errors, "construction authority id", authorities);
    checkUnique(errors, "intent access policy id", accessPolicies);
    checkUnique(errors, "intent goal id", goals);
    checkUnique(errors, "intent claim id", claims);
    checkUnique(errors, "intent assurance task id", assuranceTasks);
    checkUnique(errors, "intent semantic binding id", semanticBindings);
    checkUnique(errors, "intent scenario id", scenarios);
    return errors;
}
export function validateIntentModel(modelValue) {
    const errors = [];
    const model = record(modelValue);
    const intent = intentPattern(model);
    if (!intent)
        return errors;
    const vocabulary = model?.vocabulary;
    const capabilities = intentCapabilities(intent);
    const outcomes = intentOutcomes(intent);
    const processes = intentProcesses(intent);
    const authorities = intentConstructionAuthorities(intent);
    const accessPolicies = intentAccessPolicies(intent);
    const goals = intentGoals(intent);
    const claims = intentClaims(intent);
    const assuranceTasks = intentAssuranceTasks(intent);
    const semanticBindings = intentSemanticBindings(intent);
    const scenarios = intentScenarios(intent);
    const transactions = dbTransactions(dbPattern(model));
    errors.push(...validateIntentCatalogUniqueness(intent));
    errors.push(...validateIntentOutcomes(vocabulary, capabilities, outcomes));
    errors.push(...validateIntentAccessPolicyReferences(processes, vocabulary, accessPolicies));
    errors.push(...validateIntentGoalClaimAssurance(processes, goals, claims, assuranceTasks));
    errors.push(...validateIntentSemanticBindings(processes, claims, cloudNodes(cloudPattern(model)), semanticBindings));
    errors.push(...validateIntentAccessPolicyPrecedence(accessPolicies));
    const refinementValidationState = createIntentRefinementValidationState();
    for (const process of processes) {
        errors.push(...validateIntentProcess(process, vocabulary, capabilities, outcomes));
        errors.push(...validateIntentRefinements(process, outcomes, transactions, refinementValidationState));
    }
    errors.push(...validateIntentConstructionAuthorities(processes, outcomes, authorities));
    errors.push(...validateIntentScenarios(vocabulary, processes, outcomes, scenarios));
    return errors;
}
