import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";

import { isSafeProjectionPath, projectionDigest, projectionStableJson } from "./core/projection.mjs";

const PROJECTION_LOCK_NAME = ".dspec-projection.lock";
const PROJECTION_LOCK_OWNER_NAME = "owner.json";
export const PROJECTION_LOCK_SCHEMA_VERSION = "2.0";
export const PROJECTION_LOCK_LEASE_MS = 15 * 60 * 1000;

function currentContent(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function verifyPreconditions(actions, root) {
  const paths = new Set();
  for (const action of actions) {
    if (!isSafeProjectionPath(action.path)) throw new Error(`unsafe projection transaction path: ${action.path}`);
    if (paths.has(action.path)) throw new Error(`duplicate projection transaction path: ${action.path}`);
    paths.add(action.path);

    const content = currentContent(resolve(root, action.path));
    const digest = content === null ? null : projectionDigest(content);
    if (digest !== action.beforeDigest) {
      throw new Error(`projection transaction precondition failed: ${action.path}`);
    }
    if (["create", "update"].includes(action.action) && typeof action.desiredContent !== "string") {
      throw new Error(`projection transaction write has no content: ${action.path}`);
    }
  }
}

function rollback(applied) {
  const errors = [];
  for (const entry of applied.slice().reverse()) {
    try {
      if (existsSync(entry.target)) rmSync(entry.target, { force: true });
      if (entry.backedUp && existsSync(entry.backup)) {
        mkdirSync(dirname(entry.target), { recursive: true });
        renameSync(entry.backup, entry.target);
      }
    } catch (error) {
      errors.push(`${entry.action.path}: ${error.message}`);
    }
  }
  return errors;
}

function readProjectionLockOwner(path) {
  try {
    const owner = JSON.parse(readFileSync(join(path, PROJECTION_LOCK_OWNER_NAME), "utf8"));
    if (owner?.schemaVersion !== PROJECTION_LOCK_SCHEMA_VERSION
      || typeof owner.token !== "string"
      || owner.token.length === 0
      || !Number.isInteger(owner.pid)
      || owner.pid <= 0
      || typeof owner.hostname !== "string"
      || owner.hostname.length === 0
      || typeof owner.acquiredAt !== "string"
      || !Number.isFinite(Date.parse(owner.acquiredAt))
      || typeof owner.heartbeatAt !== "string"
      || !Number.isFinite(Date.parse(owner.heartbeatAt))
      || !Number.isInteger(owner.leaseMs)
      || owner.leaseMs <= 0) {
      return null;
    }
    return owner;
  } catch {
    return null;
  }
}

function projectionTimestamp(now) {
  const value = typeof now === "function" ? now() : now;
  const milliseconds = value === undefined ? Date.now() : typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`invalid Projection lock time: ${value}`);
  return new Date(milliseconds).toISOString();
}

function projectionLockLease(owner, now) {
  if (!owner) return { status: "unknown", expiresAt: null };
  const expiresAtMs = Date.parse(owner.heartbeatAt) + owner.leaseMs;
  return {
    status: Date.parse(projectionTimestamp(now)) > expiresAtMs ? "expired" : "active",
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

function projectionLockLiveness(owner) {
  if (!owner || owner.hostname !== hostname()) return "unknown";
  try {
    process.kill(owner.pid, 0);
    return "alive";
  } catch (error) {
    if (error.code === "ESRCH") return "dead";
    if (error.code === "EPERM") return "alive";
    return "unknown";
  }
}

function publicProjectionLockOwner(owner) {
  if (!owner) return null;
  return {
    schemaVersion: owner.schemaVersion,
    pid: owner.pid,
    hostname: owner.hostname,
    acquiredAt: owner.acquiredAt,
    heartbeatAt: owner.heartbeatAt,
    leaseMs: owner.leaseMs,
  };
}

function projectionLockState(root, { now } = {}) {
  const resolvedRoot = resolve(root);
  const path = join(resolvedRoot, PROJECTION_LOCK_NAME);
  if (!existsSync(path)) {
    return {
      resolvedRoot,
      path,
      owner: null,
      liveness: "absent",
      lease: { status: "absent", expiresAt: null },
      status: "absent",
    };
  }
  const owner = readProjectionLockOwner(path);
  return {
    resolvedRoot,
    path,
    owner,
    liveness: projectionLockLiveness(owner),
    lease: projectionLockLease(owner, now),
    status: "held",
  };
}

export function inspectProjectionLock(root = process.cwd(), { now } = {}) {
  const state = projectionLockState(root, { now });
  return {
    status: state.status,
    path: PROJECTION_LOCK_NAME,
    owner: publicProjectionLockOwner(state.owner),
    liveness: state.liveness,
    lease: state.lease,
  };
}

export function recoverProjectionLock(root = process.cwd(), { force = false, now } = {}) {
  const state = projectionLockState(root, { now });
  const previous = {
    status: state.status,
    path: PROJECTION_LOCK_NAME,
    owner: publicProjectionLockOwner(state.owner),
    liveness: state.liveness,
    lease: state.lease,
  };
  if (state.status === "absent") return { status: "absent", forced: false, previous };
  if (!force && state.liveness !== "dead" && state.lease.status !== "expired") {
    if (state.liveness === "alive") {
      throw new Error(`Projection generation lock has a live owner: pid ${state.owner.pid} on ${state.owner.hostname}`);
    }
    if (state.lease.status === "active") {
      throw new Error(`Projection generation lock has an active lease until ${state.lease.expiresAt}`);
    }
    throw new Error("Projection generation lock owner is unknown; use --force only after confirming no generator is running");
  }

  const current = projectionLockState(state.resolvedRoot, { now });
  if (current.status !== "held" || current.owner?.token !== state.owner?.token) {
    throw new Error("Projection generation lock ownership changed during recovery");
  }
  rmSync(state.path, { recursive: true, force: true });
  return { status: "recovered", forced: Boolean(force), previous };
}

function acquireProjectionLock(root, { leaseMs, now }) {
  const path = join(root, PROJECTION_LOCK_NAME);
  try {
    mkdirSync(path);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`projection generation lock is held: ${root}; recover it with dspec generated unlock --root <dir>`);
    }
    throw error;
  }
  const acquiredAt = projectionTimestamp(now);
  const owner = {
    schemaVersion: PROJECTION_LOCK_SCHEMA_VERSION,
    token: randomUUID(),
    pid: process.pid,
    hostname: hostname(),
    acquiredAt,
    heartbeatAt: acquiredAt,
    leaseMs,
  };
  try {
    writeFileSync(join(path, PROJECTION_LOCK_OWNER_NAME), projectionStableJson(owner), { flag: "wx" });
  } catch (error) {
    rmSync(path, { recursive: true, force: true });
    throw error;
  }
  return { path, token: owner.token };
}

function assertProjectionLockOwnership(lock) {
  if (readProjectionLockOwner(lock.path)?.token !== lock.token) {
    throw new Error("Projection generation lock ownership changed during transaction");
  }
}

function releaseProjectionLock(lock) {
  if (!existsSync(lock.path)) return;
  assertProjectionLockOwnership(lock);
  rmSync(lock.path, { recursive: true, force: true });
}

function renewProjectionLockLease(lock, now) {
  const owner = readProjectionLockOwner(lock.path);
  if (owner?.token !== lock.token) {
    throw new Error("Projection generation lock ownership changed during lease renewal");
  }
  writeFileSync(
    join(lock.path, PROJECTION_LOCK_OWNER_NAME),
    projectionStableJson({ ...owner, heartbeatAt: projectionTimestamp(now) }),
  );
}

export function applyProjectionTransaction(actions, {
  root = process.cwd(),
  beforeCommit = () => {},
  leaseMs = PROJECTION_LOCK_LEASE_MS,
  now = () => new Date().toISOString(),
} = {}) {
  const resolvedRoot = resolve(root);
  if (!Number.isInteger(leaseMs) || leaseMs <= 0) {
    throw new TypeError(`Projection lock leaseMs must be a positive integer: ${leaseMs}`);
  }
  mkdirSync(resolvedRoot, { recursive: true });
  const lock = acquireProjectionLock(resolvedRoot, { leaseMs, now });
  try {
    const ordered = actions.slice().sort((left, right) => left.path.localeCompare(right.path));
    verifyPreconditions(ordered, resolvedRoot);
    const changed = ordered.filter((action) => action.action !== "unchanged");
    if (changed.length === 0) return { status: "committed", writes: 0, removes: 0 };

    const transactionRoot = mkdtempSync(join(resolvedRoot, ".dspec-transaction-"));
    const staged = new Map();
    const applied = [];
    try {
      for (const [index, action] of changed.entries()) {
        if (!["create", "update"].includes(action.action)) continue;
        renewProjectionLockLease(lock, now);
        const path = join(transactionRoot, "staged", String(index));
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, action.desiredContent);
        if (projectionDigest(readFileSync(path, "utf8")) !== action.afterDigest) {
          throw new Error(`projection transaction staging verification failed: ${action.path}`);
        }
        staged.set(action.path, path);
      }

      for (const [index, action] of changed.entries()) {
        renewProjectionLockLease(lock, now);
        beforeCommit(action, index);
        assertProjectionLockOwnership(lock);
        renewProjectionLockLease(lock, now);
        const target = resolve(resolvedRoot, action.path);
        const backup = join(transactionRoot, "backup", String(index));
        const entry = { action, target, backup, backedUp: false };
        applied.push(entry);
        if (existsSync(target)) {
          mkdirSync(dirname(backup), { recursive: true });
          renameSync(target, backup);
          entry.backedUp = true;
        }
        if (["create", "update"].includes(action.action)) {
          mkdirSync(dirname(target), { recursive: true });
          renameSync(staged.get(action.path), target);
        }
      }

      for (const action of changed) {
        const content = currentContent(resolve(resolvedRoot, action.path));
        const digest = content === null ? null : projectionDigest(content);
        if (digest !== action.afterDigest) throw new Error(`projection transaction commit verification failed: ${action.path}`);
      }

      return {
        status: "committed",
        writes: changed.filter((action) => ["create", "update"].includes(action.action)).length,
        removes: changed.filter((action) => action.action === "remove").length,
      };
    } catch (error) {
      const rollbackErrors = rollback(applied);
      if (rollbackErrors.length > 0) {
        throw new Error(`${error.message}; projection rollback failed: ${rollbackErrors.join("; ")}`);
      }
      throw error;
    } finally {
      rmSync(transactionRoot, { recursive: true, force: true });
    }
  } finally {
    releaseProjectionLock(lock);
  }
}
