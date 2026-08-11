import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { CommandError } from "./error.mjs";
function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function stableObject(value) {
    if (Array.isArray(value))
        return value.map(stableObject);
    const object = record(value);
    if (!object)
        return value;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, stableObject(object[key])]));
}
function stableJson(value) {
    return `${JSON.stringify(stableObject(value), null, 2)}\n`;
}
function fileDigest(path) {
    return `sha256:${createHash("sha256").update(readFileSync(resolve(path))).digest("hex")}`;
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function resolvePathRelativeToFile(ownerFile, targetPath) {
    if (!ownerFile || isAbsolute(targetPath))
        return targetPath;
    return resolve(dirname(resolve(ownerFile)), targetPath);
}
export function pklImportPath(fromFile, targetFile) {
    const raw = relative(dirname(resolve(fromFile)), resolve(targetFile)).replace(/\\/g, "/");
    return raw.startsWith(".") ? raw : `./${raw}`;
}
export function defaultSchemaLockPath(modelFile) {
    const extension = ".pkl";
    const base = modelFile.endsWith(extension)
        ? modelFile.slice(0, -extension.length)
        : modelFile;
    return `${base}.lock.json`;
}
export function schemaImportFromModel(modelFile) {
    const source = readFileSync(resolve(modelFile), "utf8");
    const importPath = source.match(/^\s*import\s+"([^"\n]*Schema\.pkl)"\s+as\s+[A-Za-z_][A-Za-z0-9_]*\s*$/m)?.[1];
    if (!importPath) {
        throw new CommandError(`model does not import a Schema.pkl module: ${modelFile}\n`);
    }
    return importPath;
}
function enclosingPklProject(modelFile) {
    let directory = dirname(resolve(modelFile));
    while (true) {
        const projectFile = join(directory, "PklProject");
        if (existsSync(projectFile))
            return projectFile;
        const parent = dirname(directory);
        if (parent === directory)
            return null;
        directory = parent;
    }
}
function localPklDependencyRoot(modelFile, alias) {
    const projectFile = enclosingPklProject(modelFile);
    if (!projectFile)
        return null;
    const projectSource = readFileSync(projectFile, "utf8");
    const declaration = projectSource.match(new RegExp(`\\["${escapeRegex(alias)}"\\]\\s*=\\s*import\\("([^"\\n]+)"\\)`));
    if (!declaration?.[1])
        return null;
    const dependencyProject = resolve(dirname(projectFile), declaration[1]);
    return dirname(dependencyProject);
}
export function resolveSchemaModulePath(modelFile, importPath) {
    if (!importPath.startsWith("@"))
        return resolvePathRelativeToFile(modelFile, importPath);
    const match = importPath.match(/^@([^/]+)\/(.+)$/);
    if (!match)
        throw new CommandError(`unsupported schema import: ${importPath}\n`);
    const dependencyRoot = localPklDependencyRoot(modelFile, match[1]);
    if (!dependencyRoot) {
        throw new CommandError(`schema lock requires a local Pkl dependency: ${importPath}\n`);
    }
    return resolve(dependencyRoot, match[2]);
}
function schemaModuleFiles(schemaFile, seen = new Set()) {
    const absolutePath = resolve(schemaFile);
    if (seen.has(absolutePath))
        return [];
    seen.add(absolutePath);
    if (!existsSync(absolutePath)) {
        throw new CommandError(`schema module does not exist: ${absolutePath}\n`);
    }
    const source = readFileSync(absolutePath, "utf8");
    const inherited = Array.from(source.matchAll(/^\s*(?:amends|extends)\s+"([^"\n]+)"/gm), (match) => match[1]).filter((path) => path !== undefined && !path.includes(":"));
    return [
        absolutePath,
        ...inherited.flatMap((path) => schemaModuleFiles(resolve(dirname(absolutePath), path), seen)),
    ];
}
function schemaPackage(schemaFile) {
    let directory = dirname(resolve(schemaFile));
    while (true) {
        const manifestPath = join(directory, "package.json");
        if (existsSync(manifestPath)) {
            try {
                const manifest = record(JSON.parse(readFileSync(manifestPath, "utf8")));
                if (typeof manifest?.name === "string" && typeof manifest.version === "string") {
                    return { name: manifest.name, version: manifest.version };
                }
            }
            catch {
                // A malformed package manifest does not prevent file-level schema locking.
            }
        }
        const parent = dirname(directory);
        if (parent === directory)
            return null;
        directory = parent;
    }
}
export function schemaLockDocument(modelFile, lockFile) {
    const importPath = schemaImportFromModel(modelFile);
    const schemaFile = resolveSchemaModulePath(modelFile, importPath);
    const modules = schemaModuleFiles(schemaFile);
    const files = [modules[0], ...modules.slice(1).sort()]
        .filter((path) => path !== undefined)
        .map((path) => ({ path: pklImportPath(lockFile, path), digest: fileDigest(path) }));
    return {
        schemaLockVersion: 1,
        model: { schemaImportPath: importPath },
        schema: {
            rootPath: pklImportPath(lockFile, schemaFile),
            files,
            package: schemaPackage(schemaFile),
        },
    };
}
export function writeSchemaLock({ modelFile, lockFile, force = false, }) {
    const outputPath = resolve(lockFile);
    if (existsSync(outputPath) && !force) {
        throw new CommandError(`refusing to overwrite existing schema lock: ${lockFile}; use --force\n`);
    }
    const document = schemaLockDocument(modelFile, outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, stableJson(document));
    return {
        path: lockFile,
        files: document.schema.files.length,
        package: document.schema.package,
    };
}
export function schemaLockReport(modelFile, { lockFile = null, requireLock = false } = {}) {
    const selectedLockFile = lockFile ?? defaultSchemaLockPath(modelFile);
    const lockPath = resolve(selectedLockFile);
    const explicitlyRequested = lockFile !== null;
    if (!existsSync(lockPath)) {
        const errors = requireLock || explicitlyRequested
            ? [`schema lock not found: ${selectedLockFile}`]
            : [];
        return {
            status: errors.length > 0 ? "fail" : "skip",
            configured: false,
            path: selectedLockFile,
            reason: "schema lock not found",
            errors,
        };
    }
    let lock;
    try {
        lock = JSON.parse(readFileSync(lockPath, "utf8"));
    }
    catch (error) {
        const errors = [`failed to parse schema lock: ${selectedLockFile}: ${errorMessage(error)}`];
        return { status: "fail", configured: true, path: selectedLockFile, errors };
    }
    const errors = [];
    if (lock.schemaLockVersion !== 1) {
        errors.push(`unsupported schema lock version: ${lock.schemaLockVersion ?? "missing"}`);
    }
    let importPath = null;
    try {
        importPath = schemaImportFromModel(modelFile);
    }
    catch (error) {
        errors.push(errorMessage(error).trim());
    }
    if (importPath !== null && lock.model?.schemaImportPath !== importPath) {
        errors.push(`schema import changed: lock has ${lock.model?.schemaImportPath ?? "missing"}, model has ${importPath}`);
    }
    let schemaFile = null;
    if (importPath !== null) {
        try {
            schemaFile = resolveSchemaModulePath(modelFile, importPath);
        }
        catch (error) {
            errors.push(errorMessage(error).trim());
        }
    }
    const expectedRootPath = schemaFile === null ? null : pklImportPath(lockPath, schemaFile);
    if (expectedRootPath !== null && lock.schema?.rootPath !== expectedRootPath) {
        errors.push(`schema root changed: lock has ${lock.schema?.rootPath ?? "missing"}, model resolves ${expectedRootPath}`);
    }
    const files = Array.isArray(lock.schema?.files) ? lock.schema.files : [];
    if (files.length === 0)
        errors.push("schema lock has no module files");
    for (const entryValue of files) {
        const entry = record(entryValue);
        if (!entry || typeof entry.path !== "string" || typeof entry.digest !== "string") {
            errors.push("schema lock has an invalid module file entry");
            continue;
        }
        const path = resolvePathRelativeToFile(lockPath, entry.path);
        if (!existsSync(path)) {
            errors.push(`schema module missing: ${entry.path}`);
            continue;
        }
        const digest = fileDigest(path);
        if (digest !== entry.digest)
            errors.push(`schema module digest changed: ${entry.path}`);
    }
    const currentPackage = schemaFile === null || !existsSync(schemaFile)
        ? null
        : schemaPackage(schemaFile);
    if (JSON.stringify(lock.schema?.package ?? null) !== JSON.stringify(currentPackage)) {
        errors.push("schema package metadata changed");
    }
    const lockedPackage = record(lock.schema?.package);
    const packageValue = typeof lockedPackage?.name === "string"
        && typeof lockedPackage.version === "string"
        ? { name: lockedPackage.name, version: lockedPackage.version }
        : null;
    return {
        status: errors.length === 0 ? "pass" : "fail",
        configured: true,
        path: selectedLockFile,
        files: files.length,
        package: packageValue,
        errors,
    };
}
