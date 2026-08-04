import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CommandError } from "./error.mjs";
const DAILY_DRIFT_PACKET_SCRIPT = fileURLToPath(new URL("../../scripts/generate-daily-drift-packet.mjs", import.meta.url));
export function dailyDriftUsage() {
    return `usage:
  dspec daily-drift collect [--generated-at <iso>] [--require-formal-tools] [--fail-on-drift] [--baseline <approved-baseline.json>] [--output <directory>] <daily-drift-targets.pkl>
  dspec daily-drift approve --approved-by <identity> --approval-id <id> --spec-change-review <target-id>=<review.pkl> [--spec-change-review <target-id>=<review.pkl> ...] [--generated-at <iso>] [--require-formal-tools] [--baseline <approved-baseline.json>] [--output <directory>] <daily-drift-targets.pkl>

Collect an artifact-only daily Intent-to-formal-to-implementation drift packet,
or write a replacement baseline after deterministic collection succeeds.
`;
}
export function runDailyDriftCommand(args, { write, writeError, setExitCode }) {
    const [operation, ...forwarded] = args;
    if (!operation || operation === "--help" || operation === "-h" || operation === "help") {
        write(dailyDriftUsage());
        return;
    }
    if (!new Set(["collect", "approve"]).has(operation)) {
        throw new CommandError(`unknown daily-drift operation: ${operation}\n${dailyDriftUsage()}`);
    }
    const childArgs = operation === "approve" ? ["--write-baseline", ...forwarded] : forwarded;
    const result = spawnSync(process.execPath, [DAILY_DRIFT_PACKET_SCRIPT, ...childArgs], {
        cwd: process.cwd(),
        encoding: "utf8",
    });
    if (result.error)
        throw new CommandError(result.error.message);
    if (result.stdout)
        write(result.stdout);
    if (result.stderr)
        writeError(result.stderr);
    if (typeof result.status === "number" && result.status !== 0)
        setExitCode(result.status);
}
