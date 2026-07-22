import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

export const FORMAL_LINKS_SCHEMA_VERSION = "1.0";

function list(value) {
  return Array.isArray(value) ? value : [];
}

function string(value) {
  return typeof value === "string" ? value : "";
}

function digest(source) {
  return `sha256:${createHash("sha256").update(source).digest("hex")}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function insideProject(projectRoot, path) {
  const fromRoot = relative(projectRoot, path);
  return fromRoot === "" || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !fromRoot.startsWith(".."));
}

function projectPath(projectRoot, declaredPath) {
  const path = resolve(projectRoot, declaredPath);
  return insideProject(projectRoot, path) ? path : null;
}

function sourceAt(projectRoot, declaredPath) {
  if (!declaredPath) return null;
  const path = projectPath(projectRoot, declaredPath);
  if (!path || !existsSync(path)) return null;
  try {
    return { path, source: readFileSync(path, "utf8") };
  } catch {
    return null;
  }
}

function knownRuleIds(document) {
  return new Set(list(document?.model?.rules).map((rule) => rule?.id).filter(Boolean));
}

function validModuleName(value) {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(value);
}

function hasLeanImport(source, importName) {
  const name = escapeRegExp(importName);
  return new RegExp(`^\\s*import\\s+(?:«)?${name}(?:»)?(?:\\s|$)`, "m").test(source);
}

function hasAlloyOpen(source, importName) {
  const name = escapeRegExp(importName);
  return new RegExp(`^\\s*open\\s+${name}(?:\\s|$)`, "m").test(source);
}

function hasLeanAnchor(source, anchor) {
  return new RegExp(`^\\s*(?:theorem|lemma)\\s+${escapeRegExp(anchor)}(?:\\s|$)`, "m").test(source);
}

function hasAlloyAnchor(source, anchor) {
  return new RegExp(`^\\s*check\\s+${escapeRegExp(anchor)}(?:\\s|$)`, "m").test(source);
}

function artifactId(artifact) {
  return string(artifact?.id) || "<unnamed>";
}

function claimId(claim) {
  return string(claim?.id) || "<unnamed>";
}

function staticArtifact(document, artifact, projectRoot) {
  const source = sourceAt(projectRoot, artifact.source);
  return {
    id: artifact.id,
    backend: artifact.backend,
    mode: artifact.mode,
    source: {
      path: artifact.source,
      digest: source ? digest(source.source) : null,
    },
    generated: list(artifact.generated).map((dependency) => {
      const generated = sourceAt(projectRoot, dependency.path);
      return {
        path: dependency.path,
        importName: dependency.importName,
        digest: generated ? digest(generated.source) : null,
      };
    }),
    claims: list(artifact.claims).map((claim) => ({
      id: claim.id,
      rule: claim.rule,
      anchor: claim.anchor,
      expectation: claim.expectation,
    })),
  };
}

/**
 * Validate the intentionally narrow bridge between a domain rule and direct
 * Lean/Alloy source. This checks linkage and syntax anchors; it deliberately
 * does not infer that a theorem entails the rule's natural-language wording.
 */
export function validateFormalLinks(document, { projectRoot = process.cwd() } = {}) {
  const errors = [];
  const formalLinks = document?.formalLinks;
  if (!formalLinks || typeof formalLinks !== "object") return ["formal links are missing"];

  const ruleIds = knownRuleIds(document);
  const artifactIds = new Set();
  const claimIds = new Set();
  for (const artifact of list(formalLinks.artifacts)) {
    const id = artifactId(artifact);
    if (!string(artifact?.id)) errors.push("formal link artifact id is required");
    if (artifactIds.has(id)) errors.push(`duplicate formal link artifact id: ${id}`);
    artifactIds.add(id);

    if (!["lean", "alloy"].includes(artifact?.backend)) {
      errors.push(`formal link backend must be lean or alloy: ${id}`);
    }
    if (!["authored", "extension"].includes(artifact?.mode)) {
      errors.push(`formal link mode must be authored or extension: ${id}`);
    }

    const generated = list(artifact?.generated);
    if (artifact?.mode === "authored" && generated.length > 0) {
      errors.push(`formal link authored artifact must not depend on generated source: ${id}`);
    }
    if (artifact?.mode === "extension" && generated.length === 0) {
      errors.push(`formal link extension requires generated dependency: ${id}`);
    }

    const source = sourceAt(projectRoot, string(artifact?.source));
    if (!source) errors.push(`formal link source is missing or outside project: ${id} -> ${artifact?.source ?? "<missing>"}`);

    for (const dependency of generated) {
      const dependencyPath = string(dependency?.path);
      const importName = string(dependency?.importName);
      if (!sourceAt(projectRoot, dependencyPath)) {
        errors.push(`formal link generated dependency is missing or outside project: ${id} -> ${dependencyPath || "<missing>"}`);
      }
      if (!validModuleName(importName)) {
        errors.push(`formal link generated import name is invalid: ${id} -> ${importName || "<missing>"}`);
      }
      if (source && artifact?.mode === "extension" && artifact?.backend === "lean" && !hasLeanImport(source.source, importName)) {
        errors.push(`formal link Lean extension is missing import ${importName}: ${id}`);
      }
      if (source && artifact?.mode === "extension" && artifact?.backend === "alloy" && !hasAlloyOpen(source.source, importName)) {
        errors.push(`formal link Alloy extension is missing open ${importName}: ${id}`);
      }
    }

    if (list(artifact?.claims).length === 0) errors.push(`formal link artifact has no claims: ${id}`);
    for (const claim of list(artifact?.claims)) {
      const id = claimId(claim);
      if (!string(claim?.id)) errors.push(`formal link claim id is required: ${artifactId(artifact)}`);
      if (claimIds.has(id)) errors.push(`duplicate formal link claim id: ${id}`);
      claimIds.add(id);
      if (!ruleIds.has(claim?.rule)) {
        errors.push(`formal link references unknown domain rule: ${artifactId(artifact)} -> ${claim?.rule ?? "<missing>"}`);
      }
      if (!string(claim?.anchor)) errors.push(`formal link claim anchor is required: ${artifactId(artifact)} -> ${id}`);
      if (artifact?.backend === "lean" && claim?.expectation !== "proved") {
        errors.push(`formal link Lean claim must expect proved: ${artifactId(artifact)} -> ${id}`);
      }
      if (artifact?.backend === "alloy" && !["holds", "violated"].includes(claim?.expectation)) {
        errors.push(`formal link Alloy claim must expect holds or violated: ${artifactId(artifact)} -> ${id}`);
      }
      if (source && artifact?.backend === "lean" && !hasLeanAnchor(source.source, string(claim?.anchor))) {
        errors.push(`formal link Lean theorem or lemma is missing: ${artifactId(artifact)} -> ${claim?.anchor ?? "<missing>"}`);
      }
      if (source && artifact?.backend === "alloy" && !hasAlloyAnchor(source.source, string(claim?.anchor))) {
        errors.push(`formal link Alloy check is missing: ${artifactId(artifact)} -> ${claim?.anchor ?? "<missing>"}`);
      }
    }
  }
  return errors;
}

/**
 * Return the reviewable source/rule linkage without invoking external tools.
 */
export function verifyFormalLinks(document, { projectRoot = process.cwd() } = {}) {
  const errors = validateFormalLinks(document, { projectRoot });
  return {
    schemaVersion: FORMAL_LINKS_SCHEMA_VERSION,
    model: { id: document?.model?.id ?? null, version: document?.model?.version ?? null },
    status: errors.length === 0 ? "pass" : "fail",
    artifacts: list(document?.formalLinks?.artifacts).map((artifact) => staticArtifact(document, artifact, projectRoot)),
    errors,
  };
}

function commandExists(command, versionArgs) {
  return spawnSync(command, versionArgs, { encoding: "utf8" }).status === 0;
}

function run(command, args, options) {
  return spawnSync(command, args, { encoding: "utf8", ...options });
}

function commandError(result, fallback) {
  return result.stderr || result.stdout || fallback;
}

function toolErrorClaim(claim, assurance, error) {
  return {
    ...claim,
    actual: null,
    assurance,
    status: "fail",
    counterexample: null,
    error,
  };
}

function buildLeanDependencies(document, projectRoot, directory, leanCommand) {
  const dependencies = new Map();
  for (const artifact of list(document?.formalLinks?.artifacts)) {
    if (artifact?.backend !== "lean") continue;
    for (const dependency of list(artifact.generated)) {
      const key = `${dependency.importName}\u0000${dependency.path}`;
      dependencies.set(key, dependency);
    }
  }

  const errors = [];
  for (const dependency of dependencies.values()) {
    const destination = join(directory, `${dependency.importName.replaceAll(".", sep)}.olean`);
    mkdirSync(dirname(destination), { recursive: true });
    const result = run(leanCommand, ["-o", destination, resolve(projectRoot, dependency.path)], { cwd: projectRoot });
    if (result.status !== 0) {
      errors.push(`Lean generated dependency failed: ${dependency.path}: ${commandError(result, "Lean exited unsuccessfully")}`);
    }
  }
  return errors;
}

function executeLeanArtifact(artifact, projectRoot, directory, leanCommand) {
  const sourcePath = resolve(projectRoot, artifact.source);
  const result = run(leanCommand, [sourcePath], {
    cwd: projectRoot,
    env: { ...process.env, LEAN_PATH: `${directory}${process.env.LEAN_PATH ? `:${process.env.LEAN_PATH}` : ""}` },
  });
  const claims = list(artifact.claims).map((claim) => (
    result.status === 0
      ? { ...claim, actual: "proved", assurance: "lean4-kernel", status: "pass", counterexample: null, error: null }
      : toolErrorClaim(claim, "lean4-kernel", commandError(result, "Lean exited unsuccessfully"))
  ));
  return { ...staticArtifact(null, artifact, projectRoot), status: result.status === 0 ? "pass" : "fail", claims };
}

function analyzerReceipt(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return { error: `cannot parse Alloy receipt: ${error.message}` };
  }
}

function executeAlloyArtifact(artifact, projectRoot, directory, alloyCommand) {
  const sourcePath = resolve(projectRoot, artifact.source);
  const claims = list(artifact.claims).map((claim) => {
    const output = join(directory, "alloy", artifact.id, claim.id);
    const result = run(alloyCommand, ["exec", "-q", "-t", "json", "-o", output, "-f", "-c", claim.anchor, sourcePath], { cwd: projectRoot });
    const receiptPath = join(output, "receipt.json");
    if (result.status !== 0 || !existsSync(receiptPath)) {
      return toolErrorClaim(claim, "alloy6-bounded", commandError(result, "Alloy receipt is missing"));
    }
    const receipt = analyzerReceipt(receiptPath);
    if (receipt.error) return toolErrorClaim(claim, "alloy6-bounded", receipt.error);
    const solutions = receipt?.commands?.[claim.anchor]?.solution;
    const counterexample = Array.isArray(solutions) && solutions.length > 0 ? solutions[0] : null;
    const actual = counterexample ? "violated" : "holds";
    const status = actual === claim.expectation ? "pass" : "fail";
    return {
      ...claim,
      actual,
      assurance: "alloy6-bounded",
      status,
      counterexample,
      receipt,
      error: status === "pass" ? null : `Alloy check ${claim.anchor} expected ${claim.expectation}, but found ${actual}`,
    };
  });
  return {
    ...staticArtifact(null, artifact, projectRoot),
    status: claims.every((claim) => claim.status === "pass") ? "pass" : "fail",
    claims,
  };
}

/**
 * Execute direct source after static linkage succeeds. Lean extensions compile
 * their declared generated dependencies into a private module cache; Alloy
 * extensions are analyzed in place so their `open` uses the sibling artifact.
 */
export function verifyFormalLinksWithTools(
  document,
  { projectRoot = process.cwd(), leanCommand = "lean", alloyCommand = "alloy6" } = {},
) {
  const reference = verifyFormalLinks(document, { projectRoot });
  if (reference.status === "fail") return { ...reference, toolStatus: "not-run" };

  const leanAvailable = commandExists(leanCommand, ["--version"]);
  const alloyAvailable = commandExists(alloyCommand, ["version"]);
  const directory = mkdtempSync(join(tmpdir(), "dspec-formal-links-"));
  try {
    const generatedLeanErrors = leanAvailable
      ? buildLeanDependencies(document, projectRoot, directory, leanCommand)
      : [];
    const artifacts = list(document?.formalLinks?.artifacts).map((artifact) => {
      if (artifact.backend === "lean") {
        if (!leanAvailable) {
          return {
            ...staticArtifact(null, artifact, projectRoot),
            status: "skip",
            claims: list(artifact.claims).map((claim) => ({ ...claim, actual: null, assurance: "lean4-kernel", status: "skip", counterexample: null, error: "lean not found on PATH" })),
          };
        }
        if (generatedLeanErrors.length > 0 && list(artifact.generated).length > 0) {
          return {
            ...staticArtifact(null, artifact, projectRoot),
            status: "fail",
            claims: list(artifact.claims).map((claim) => toolErrorClaim(claim, "lean4-kernel", generatedLeanErrors.join("\n"))),
          };
        }
        return executeLeanArtifact(artifact, projectRoot, directory, leanCommand);
      }
      if (!alloyAvailable) {
        return {
          ...staticArtifact(null, artifact, projectRoot),
          status: "skip",
          claims: list(artifact.claims).map((claim) => ({ ...claim, actual: null, assurance: "alloy6-bounded", status: "skip", counterexample: null, error: "alloy6 not found on PATH" })),
        };
      }
      return executeAlloyArtifact(artifact, projectRoot, directory, alloyCommand);
    });
    const statuses = artifacts.map((artifact) => artifact.status);
    const status = statuses.includes("fail") ? "fail" : statuses.includes("skip") ? "skip" : "pass";
    return {
      ...reference,
      status,
      toolStatus: status,
      artifacts,
      errors: [
        ...reference.errors,
        ...generatedLeanErrors,
        ...artifacts.filter((artifact) => artifact.status === "fail").map((artifact) => `formal tool execution failed: ${artifact.id}`),
      ],
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
