function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
export function intentConstructionAuthorities(intent) {
    return list(record(intent)?.constructionAuthorities);
}
export function validateIntentConstructionAuthorities(processesValue, outcomesValue, authoritiesValue) {
    const errors = [];
    const processes = list(processesValue);
    const outcomes = list(outcomesValue);
    const authorities = list(authoritiesValue);
    const processesById = new Map(processes.map((process) => [process.id, process]));
    const outcomesById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
    const authorityPairs = new Set();
    const authorityPairsByOutcome = new Map();
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
        if (process
            && outcome
            && !list(process.constructs).includes(outcome.id)) {
            errors.push(`construction authority is not declared by process: ${authority.id} -> ${authority.outcome}`);
        }
        if (outcome) {
            authorityPairsByOutcome.set(outcome.id, (authorityPairsByOutcome.get(outcome.id) ?? 0) + 1);
        }
    }
    for (const process of processes) {
        for (const outcomeId of list(process.constructs)) {
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
