function factKey(fact) {
    return `${fact.kind}:${fact.id}`;
}
export function normalizeRealAppImportFacts(facts = []) {
    return facts
        .map((fact) => ({ kind: fact.kind, id: fact.id }))
        .sort((left, right) => factKey(left).localeCompare(factKey(right)));
}
export function realAppImportFactListsEqual(left = [], right = []) {
    const normalizedLeft = normalizeRealAppImportFacts(left);
    const normalizedRight = normalizeRealAppImportFacts(right);
    return normalizedLeft.length === normalizedRight.length
        && normalizedLeft.every((fact, index) => factKey(fact) === factKey(normalizedRight[index]));
}
export function externalHoldoutMutationReport(input) {
    const expectedAdded = normalizeRealAppImportFacts(input.expectedAddedFacts);
    const expectedRemoved = normalizeRealAppImportFacts(input.expectedRemovedFacts);
    const added = normalizeRealAppImportFacts(input.addedFacts);
    const removed = normalizeRealAppImportFacts(input.removedFacts);
    const errors = [];
    if (!realAppImportFactListsEqual(added, expectedAdded)) {
        errors.push(`expected added facts ${JSON.stringify(expectedAdded)}, actual ${JSON.stringify(added)}`);
    }
    if (!realAppImportFactListsEqual(removed, expectedRemoved)) {
        errors.push(`expected removed facts ${JSON.stringify(expectedRemoved)}, actual ${JSON.stringify(removed)}`);
    }
    return {
        id: input.id,
        sourceRepository: input.sourceRepository,
        sourceBeforeRevision: input.sourceBeforeRevision,
        sourceAfterRevision: input.sourceAfterRevision,
        beforeAppRoot: input.beforeAppRoot,
        afterAppRoot: input.afterAppRoot,
        expectedAdded,
        expectedRemoved,
        added,
        removed,
        status: errors.length === 0 ? "pass" : "fail",
        errors,
    };
}
export function externalHoldoutCorpusReport(input) {
    const holdouts = input.holdouts;
    const mutations = input.mutations;
    const holdoutErrors = holdouts.flatMap((entry) => entry.evaluation.errors.map((error) => `${entry.holdout.id}: ${error}`));
    const mutationErrors = mutations.flatMap((entry) => entry.errors.map((error) => `${entry.id}: ${error}`));
    const holdoutSummary = holdouts.reduce((total, entry) => ({
        total: total.total + 1,
        passed: total.passed + (entry.evaluation.status === "pass" ? 1 : 0),
        expected: total.expected + entry.evaluation.summary.expected,
        observed: total.observed + entry.evaluation.summary.observed,
        matched: total.matched + entry.evaluation.summary.matched,
        missing: total.missing + entry.evaluation.summary.missing,
        unexpected: total.unexpected + entry.evaluation.summary.unexpected,
        estimatedAuthoringMinutes: total.estimatedAuthoringMinutes + (entry.holdout.estimatedAuthoringMinutes ?? 0),
        manualMappings: total.manualMappings + (entry.holdout.manualMappings?.length ?? 0),
        exclusions: total.exclusions + (entry.holdout.exclusions?.length ?? 0),
    }), {
        total: 0,
        passed: 0,
        expected: 0,
        observed: 0,
        matched: 0,
        missing: 0,
        unexpected: 0,
        estimatedAuthoringMinutes: 0,
        manualMappings: 0,
        exclusions: 0,
    });
    const mutationSummary = mutations.reduce((total, entry) => ({
        total: total.total + 1,
        detected: total.detected + (entry.status === "pass" ? 1 : 0),
        added: total.added + entry.added.length,
        removed: total.removed + entry.removed.length,
    }), { total: 0, detected: 0, added: 0, removed: 0 });
    const completedHoldoutSummary = {
        ...holdoutSummary,
        precision: holdoutSummary.observed === 0
            ? (holdoutSummary.expected === 0 ? 1 : 0)
            : holdoutSummary.matched / holdoutSummary.observed,
        recall: holdoutSummary.expected === 0 ? 1 : holdoutSummary.matched / holdoutSummary.expected,
    };
    const completedMutationSummary = {
        ...mutationSummary,
        missed: mutationSummary.total - mutationSummary.detected,
        detectionRate: mutationSummary.total === 0 ? 1 : mutationSummary.detected / mutationSummary.total,
    };
    const errors = [...holdoutErrors, ...mutationErrors];
    return {
        corpus: { id: input.id },
        status: errors.length === 0 ? "pass" : "fail",
        summary: { holdouts: completedHoldoutSummary, mutations: completedMutationSummary },
        holdouts,
        mutations,
        errors,
    };
}
function markdownCell(value) {
    return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", "<br>");
}
export function renderExternalHoldoutCorpusMarkdown(report) {
    const lines = [
        `# External Real App Import Corpus ${report.corpus.id}`,
        "",
        `- status: \`${report.status}\``,
        `- import precision / recall: \`${report.summary.holdouts.precision}\` / \`${report.summary.holdouts.recall}\``,
        `- mutation detection: \`${report.summary.mutations.detected}/${report.summary.mutations.total}\``,
        `- retrospective authoring estimate: \`${report.summary.holdouts.estimatedAuthoringMinutes} min\``,
        `- manual mappings: \`${report.summary.holdouts.manualMappings}\``,
        `- documented exclusions: \`${report.summary.holdouts.exclusions}\``,
        "",
        "| Holdout | Source | Revision | Expected | Observed | Precision | Recall | Mappings | Exclusions |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ];
    for (const entry of report.holdouts) {
        const { holdout, evaluation } = entry;
        lines.push(`| ${markdownCell(holdout.id)} | ${markdownCell(holdout.sourceRepository)} | ${markdownCell(holdout.sourceRevision)} | ${evaluation.summary.expected} | ${evaluation.summary.observed} | ${evaluation.summary.precision} | ${evaluation.summary.recall} | ${holdout.manualMappings?.length ?? 0} | ${holdout.exclusions?.length ?? 0} |`);
    }
    lines.push("", "| Mutation | Status | Added | Removed | Errors |", "| --- | --- | --- | --- | --- |");
    for (const entry of report.mutations) {
        lines.push(`| ${markdownCell(entry.id)} | ${markdownCell(entry.status)} | ${entry.added.length} | ${entry.removed.length} | ${markdownCell(entry.errors.join("<br>"))} |`);
    }
    return `${lines.join("\n")}\n`;
}
