function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function checkUniqueIdentifiers(errors, label, identifiers) {
    const seen = new Set();
    for (const identifier of identifiers) {
        if (seen.has(identifier))
            errors.push(`duplicate ${label}: ${identifier}`);
        seen.add(identifier);
    }
}
function intentRefinements(process) {
    return list(process.refinements);
}
export function intentSemanticBindings(intent) {
    return list(record(intent)?.semanticBindings);
}
export function validateIntentSemanticBindings(processesValue, claimsValue, cloudNodesValue, semanticBindingsValue) {
    const errors = [];
    const processes = list(processesValue);
    const claims = list(claimsValue);
    const cloudNodes = list(cloudNodesValue);
    const semanticBindings = list(semanticBindingsValue);
    const processesById = new Map(processes.map((process) => [process.id, process]));
    const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
    const cloudNodeIds = new Set(cloudNodes.map((node) => node.id));
    const bindingCoveredClaimIds = new Set();
    const semanticBindingKeys = new Set();
    for (const binding of semanticBindings) {
        const bindingClaims = list(binding.claims);
        checkUniqueIdentifiers(errors, `intent semantic binding claim in ${binding.id}`, bindingClaims);
        for (const claimId of bindingClaims) {
            const claim = claimsById.get(claimId);
            if (!claim) {
                errors.push(`unknown intent semantic binding claim: ${binding.id} -> ${claimId}`);
            }
            else {
                bindingCoveredClaimIds.add(claimId);
                if (!list(claim.processes).includes(binding.process)) {
                    errors.push(`intent semantic binding process is outside claim: ${binding.id} -> ${claimId}`);
                }
            }
        }
        const process = processesById.get(binding.process);
        if (!process) {
            errors.push(`unknown intent semantic binding process: ${binding.id} -> ${binding.process}`);
            continue;
        }
        const refinement = binding.refinement
            ? intentRefinements(process).find((candidate) => candidate.id === binding.refinement)
            : null;
        if (binding.refinement && !refinement) {
            errors.push(`unknown intent semantic binding refinement: ${binding.id} -> ${binding.refinement}`);
        }
        const key = `${binding.kind}\u0000${binding.target}\u0000${binding.value ?? ""}`;
        if (semanticBindingKeys.has(key)) {
            errors.push(`duplicate intent semantic binding target: ${binding.kind} ${binding.target}`);
        }
        semanticBindingKeys.add(key);
        if (binding.kind === "http-route") {
            if (!binding.refinement || !refinement || refinement.kind !== "http-route" || !refinement.http) {
                errors.push(`intent semantic HTTP binding requires an HTTP refinement: ${binding.id}`);
            }
            else {
                const expectedTarget = `${refinement.http.method} ${refinement.http.path}`;
                if (binding.target !== expectedTarget) {
                    errors.push(`intent semantic HTTP binding target mismatch: ${binding.id} expected ${expectedTarget}, got ${binding.target}`);
                }
            }
        }
        if (binding.kind === "db-transaction") {
            if (!binding.refinement || !refinement || refinement.kind !== "transaction" || !refinement.transaction) {
                errors.push(`intent semantic DB binding requires a transaction refinement: ${binding.id}`);
            }
            else if (binding.target !== refinement.transaction.dbTransaction) {
                errors.push(`intent semantic DB binding target mismatch: ${binding.id} expected ${refinement.transaction.dbTransaction}, got ${binding.target}`);
            }
        }
        if (binding.kind === "cloud-resource" && !cloudNodeIds.has(binding.target)) {
            errors.push(`unknown intent semantic cloud resource: ${binding.id} -> ${binding.target}`);
        }
        if (binding.kind === "otel-attribute"
            && (binding.value === null || binding.value === undefined || binding.value.length === 0)) {
            errors.push(`intent semantic OTel attribute requires a value: ${binding.id}`);
        }
    }
    for (const claim of claims) {
        if (claim.requiredImplementationBinding !== false && !bindingCoveredClaimIds.has(claim.id)) {
            errors.push(`intent claim has no implementation binding: ${claim.id}`);
        }
    }
    return errors;
}
