import { readFileSync } from "node:fs";

const prompt = readFileSync(0, "utf8");
if (!prompt.includes("## Claims") || prompt.includes("expected: `entailed`")) {
  process.stderr.write("invalid or label-leaking prompt\n");
  process.exit(2);
}

process.stdout.write(readFileSync("spec-reading-eval-answers.json", "utf8"));
