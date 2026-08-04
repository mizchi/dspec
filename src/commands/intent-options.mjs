import { CommandError } from "./error.mjs";
export function intentUsage() {
    return `usage:
  dspec intent verify [--json|--markdown] [--output <report.json>] <model.pkl> <traces.json>
  dspec intent exercise [--json|--markdown] [--policy] [--timeout-ms <positive-int>] [--http-base-url <url>] [--output <report.json>] <model.pkl> <traces.json>
  dspec intent generate-tests [--json] [--output <plan.json>] <model.pkl>
  dspec intent test [--json|--markdown] [--timeout-ms <positive-int>] [--http-base-url <url>] [--grpc-runner <script-or-executable>] [--output <report.json>] <model.pkl>
  dspec intent access [--json] <model.pkl> <process-id> <actor-or-role-id>
  dspec intent bindings [--json|--markdown] <model.pkl> <observed-bindings.json>
  dspec intent graph [--json|--markdown] [--locale <locale>] <model.pkl>
  dspec intent corpus [--json|--markdown] [--output <report.json>] <model.pkl> <traces.json>
  dspec intent coverage [--json|--markdown] [--output <report.json>] <model.pkl> <traces.json>
  dspec intent mutation [--json|--markdown] [--output <report.json>] <model.pkl> <traces.json>
  dspec intent schema <model.pkl>

Validate bounded implementation observations against typed Intent Process
contracts and explicit refinement mappings, execute refinements, measure
scenario corpus coverage, observation coverage, generate nearby negative trace
cases, emit the trace document shape, or generate and execute reviewed finite
protocol test vectors. generate-tests is transport-neutral. test invokes HTTP
directly and invokes gRPC through the supplied JSON runner. The --policy
option replays observed inputs, including duplicate idempotency keys, to a
configured test or staging implementation.
`;
}
const DEFAULT_INTENT_EXERCISE_TIMEOUT_MS = 5000;
function optionError(message) {
    throw new CommandError(`${message}\n${intentUsage()}`);
}
function parseOutputOptions(args, subcommand, supportedOptions) {
    let json = false;
    let markdown = false;
    let outputFile = null;
    const positional = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--json" && supportedOptions.has(arg)) {
            json = true;
            continue;
        }
        if (arg === "--markdown" && supportedOptions.has(arg)) {
            markdown = true;
            continue;
        }
        if (arg === "--output" && supportedOptions.has(arg)) {
            outputFile = args[index + 1] ?? null;
            index += 1;
            if (!outputFile)
                optionError("missing value for --output");
            continue;
        }
        if (arg.startsWith("-"))
            optionError(`unknown intent ${subcommand} option: ${arg}`);
        positional.push(arg);
    }
    if (json && markdown)
        optionError(`intent ${subcommand} accepts only one output format`);
    return { json, markdown, outputFile, positional };
}
export function parseIntentTraceArgs(args, subcommand) {
    let json = false;
    let markdown = false;
    let outputFile = null;
    let timeoutMs = DEFAULT_INTENT_EXERCISE_TIMEOUT_MS;
    let httpBaseUrl = null;
    let policy = false;
    const positional = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--json") {
            json = true;
            continue;
        }
        if (arg === "--markdown") {
            markdown = true;
            continue;
        }
        if (arg === "--output") {
            outputFile = args[index + 1] ?? null;
            index += 1;
            if (!outputFile)
                optionError("missing value for --output");
            continue;
        }
        if (arg === "--timeout-ms") {
            const value = args[index + 1] ?? null;
            index += 1;
            if (subcommand !== "exercise" || !value || !/^[1-9][0-9]*$/.test(value))
                optionError("--timeout-ms requires a positive integer for intent exercise");
            timeoutMs = Number(value);
            continue;
        }
        if (arg === "--policy") {
            if (subcommand !== "exercise")
                optionError("--policy is available only for intent exercise");
            policy = true;
            continue;
        }
        if (arg === "--http-base-url") {
            const value = args[index + 1] ?? null;
            index += 1;
            if (subcommand !== "exercise" || !value)
                optionError("--http-base-url requires a URL for intent exercise");
            try {
                const url = new URL(value);
                if (!["http:", "https:"].includes(url.protocol))
                    throw new Error("unsupported protocol");
            }
            catch {
                optionError("--http-base-url requires an http or https URL");
            }
            httpBaseUrl = value;
            continue;
        }
        if (arg.startsWith("-"))
            optionError(`unknown intent ${subcommand} option: ${arg}`);
        positional.push(arg);
    }
    if (json && markdown)
        optionError(`intent ${subcommand} accepts only one output format`);
    if (positional.length !== 2)
        throw new CommandError(intentUsage());
    return { json, markdown, outputFile, timeoutMs, httpBaseUrl, policy, modelFile: positional[0], traceFile: positional[1] };
}
export function parseIntentProtocolTestArgs(args, subcommand) {
    let json = false;
    let markdown = false;
    let outputFile = null;
    let timeoutMs = DEFAULT_INTENT_EXERCISE_TIMEOUT_MS;
    let httpBaseUrl = null;
    let grpcRunner = null;
    const positional = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--json") {
            json = true;
            continue;
        }
        if (arg === "--markdown") {
            markdown = true;
            continue;
        }
        if (arg === "--output") {
            outputFile = args[index + 1] ?? null;
            index += 1;
            if (!outputFile)
                optionError("missing value for --output");
            continue;
        }
        if (arg === "--timeout-ms") {
            const value = args[index + 1] ?? null;
            index += 1;
            if (subcommand !== "test" || !value || !/^[1-9][0-9]*$/.test(value))
                optionError("--timeout-ms requires a positive integer for intent test");
            timeoutMs = Number(value);
            continue;
        }
        if (arg === "--http-base-url") {
            const value = args[index + 1] ?? null;
            index += 1;
            if (subcommand !== "test" || !value)
                optionError("--http-base-url requires a URL for intent test");
            try {
                const url = new URL(value);
                if (!["http:", "https:"].includes(url.protocol))
                    throw new Error("unsupported protocol");
            }
            catch {
                optionError("--http-base-url requires an http or https URL");
            }
            httpBaseUrl = value;
            continue;
        }
        if (arg === "--grpc-runner") {
            grpcRunner = args[index + 1] ?? null;
            index += 1;
            if (subcommand !== "test" || !grpcRunner || grpcRunner.startsWith("-"))
                optionError("--grpc-runner requires a script or executable for intent test");
            continue;
        }
        if (arg.startsWith("-"))
            optionError(`unknown intent ${subcommand} option: ${arg}`);
        positional.push(arg);
    }
    if (json && markdown)
        optionError(`intent ${subcommand} accepts only one output format`);
    if (subcommand === "generate-tests" && markdown)
        optionError("intent generate-tests supports JSON only");
    if (positional.length !== 1)
        throw new CommandError(intentUsage());
    return { json, markdown, outputFile, timeoutMs, httpBaseUrl, grpcRunner, modelFile: positional[0] };
}
export function parseIntentAccessArgs(args) {
    const { json, positional } = parseOutputOptions(args, "access", new Set(["--json"]));
    if (positional.length !== 3)
        throw new CommandError(intentUsage());
    return { json, modelFile: positional[0], process: positional[1], subject: positional[2] };
}
export function parseIntentBindingArgs(args) {
    const { json, markdown, positional } = parseOutputOptions(args, "bindings", new Set(["--json", "--markdown"]));
    if (positional.length !== 2)
        throw new CommandError(intentUsage());
    return { json, markdown, modelFile: positional[0], observedFile: positional[1] };
}
export function parseIntentGraphArgs(args) {
    let json = false;
    let markdown = false;
    let locale = null;
    const positional = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--json") {
            json = true;
            continue;
        }
        if (arg === "--markdown") {
            markdown = true;
            continue;
        }
        if (arg === "--locale") {
            locale = args[index + 1];
            index += 1;
            if (!locale || locale.startsWith("-"))
                optionError("intent graph requires a locale value");
            continue;
        }
        if (arg.startsWith("-"))
            optionError(`unknown intent graph option: ${arg}`);
        positional.push(arg);
    }
    if (json && markdown)
        optionError("intent graph accepts only one output format");
    if (positional.length !== 1)
        throw new CommandError(intentUsage());
    return { json, markdown, locale, modelFile: positional[0] };
}
