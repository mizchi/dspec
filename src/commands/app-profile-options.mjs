import { CommandError } from "./error.mjs";
export function parseAppProfileArgs(args, usageText) {
    let dryRun = false;
    let fix = false;
    let json = false;
    let markdown = false;
    const files = [];
    for (const arg of args) {
        if (arg === "--dry-run") {
            dryRun = true;
            continue;
        }
        if (arg === "--fix") {
            fix = true;
            continue;
        }
        if (arg === "--json") {
            json = true;
            continue;
        }
        if (arg === "--markdown") {
            markdown = true;
            continue;
        }
        files.push(arg);
    }
    if (files.length === 0 || (json && markdown)) {
        throw new CommandError(usageText);
    }
    if (dryRun && !fix) {
        throw new CommandError("--dry-run requires --fix\n");
    }
    return { files, fix, dryRun, json, markdown };
}
export function parseAppProfileSuiteArgs(args, usageText) {
    const parsed = parseAppProfileArgs(args, usageText);
    if (parsed.files.length !== 1) {
        throw new CommandError(usageText);
    }
    return {
        file: parsed.files[0],
        fix: parsed.fix,
        dryRun: parsed.dryRun,
        json: parsed.json,
        markdown: parsed.markdown,
    };
}
export function parseScaffoldAppProfileArgs(args, usageText) {
    let applyFile = null;
    let diffFile = null;
    let dryRun = false;
    let json = false;
    let observedFacts = null;
    const gates = [];
    const files = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--json") {
            json = true;
            continue;
        }
        if (arg === "--dry-run") {
            dryRun = true;
            continue;
        }
        if (arg === "--diff") {
            diffFile = args[index + 1] ?? null;
            index += 1;
            if (!diffFile)
                throw new CommandError("--diff requires a profile path\n");
            continue;
        }
        if (arg === "--apply") {
            applyFile = args[index + 1] ?? null;
            index += 1;
            if (!applyFile)
                throw new CommandError("--apply requires a profile path\n");
            continue;
        }
        if (arg === "--observed-facts") {
            observedFacts = args[index + 1] ?? null;
            index += 1;
            if (!observedFacts)
                throw new CommandError("--observed-facts requires a path\n");
            continue;
        }
        if (arg === "--gate") {
            const gate = args[index + 1] ?? null;
            index += 1;
            if (!gate)
                throw new CommandError("--gate requires a gate name\n");
            gates.push(gate);
            continue;
        }
        files.push(arg);
    }
    if (files.length !== 2) {
        throw new CommandError(usageText);
    }
    if (diffFile && applyFile) {
        throw new CommandError("--diff and --apply are mutually exclusive\n");
    }
    if (dryRun && !applyFile) {
        throw new CommandError("--dry-run requires --apply for scaffold-app-profile\n");
    }
    if (json && !diffFile && !applyFile) {
        throw new CommandError("--json requires --diff or --apply for scaffold-app-profile\n");
    }
    return { modelFile: files[0], appRoot: files[1], observedFacts, gates, applyFile, diffFile, dryRun, json };
}
export function parseEvaluateAppProfileArgs(args, usageText) {
    let json = false;
    let markdown = false;
    let file = null;
    for (const arg of args) {
        if (arg === "--json") {
            json = true;
            continue;
        }
        if (arg === "--markdown") {
            markdown = true;
            continue;
        }
        if (!file) {
            file = arg;
            continue;
        }
        throw new CommandError(`unexpected argument: ${arg}`);
    }
    if (!file || (json && markdown)) {
        throw new CommandError(usageText);
    }
    return { file, json, markdown };
}
