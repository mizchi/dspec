import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { projectionDigest } from "../src/core/projection.mjs";
import {
  applyProjectionTransaction,
  inspectProjectionLock,
  recoverProjectionLock,
} from "../src/projection-filesystem.mjs";

function writeAction(action, path, before, after) {
  return {
    action,
    afterDigest: after === null ? null : projectionDigest(after),
    beforeDigest: before === null ? null : projectionDigest(before),
    desiredContent: after,
    kind: "artifact",
    path,
    projectionId: "transaction-fixture",
    reason: action === "create" ? "missing" : "content-drift",
  };
}

test("commits a staged Projection transaction", () => {
  const root = mkdtempSync(join(tmpdir(), "dspec-projection-transaction-"));
  try {
    writeFileSync(join(root, "update.md"), "before\n");
    writeFileSync(join(root, "remove.md"), "remove\n");
    const actions = [
      writeAction("update", "update.md", "before\n", "after\n"),
      writeAction("create", "create.md", null, "created\n"),
      writeAction("remove", "remove.md", "remove\n", null),
    ];

    const result = applyProjectionTransaction(actions, { root });
    assert.deepEqual(result, { status: "committed", writes: 2, removes: 1 });
    assert.equal(readFileSync(join(root, "update.md"), "utf8"), "after\n");
    assert.equal(readFileSync(join(root, "create.md"), "utf8"), "created\n");
    assert.equal(existsSync(join(root, "remove.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rolls back every committed path when a Projection transaction fails", () => {
  const root = mkdtempSync(join(tmpdir(), "dspec-projection-rollback-"));
  try {
    writeFileSync(join(root, "first.md"), "first-before\n");
    writeFileSync(join(root, "second.md"), "second-before\n");
    writeFileSync(join(root, "b-remove.md"), "remove-before\n");
    const actions = [
      writeAction("create", "a-create.md", null, "created\n"),
      writeAction("remove", "b-remove.md", "remove-before\n", null),
      writeAction("update", "first.md", "first-before\n", "first-after\n"),
      writeAction("update", "second.md", "second-before\n", "second-after\n"),
    ];

    assert.throws(
      () => applyProjectionTransaction(actions, {
        root,
        beforeCommit(_action, index) {
          if (index === 2) throw new Error("injected commit failure");
        },
      }),
      /injected commit failure/,
    );
    assert.equal(readFileSync(join(root, "first.md"), "utf8"), "first-before\n");
    assert.equal(readFileSync(join(root, "second.md"), "utf8"), "second-before\n");
    assert.equal(readFileSync(join(root, "b-remove.md"), "utf8"), "remove-before\n");
    assert.equal(existsSync(join(root, "a-create.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("serializes Projection transactions and releases the lock after failure", () => {
  const root = mkdtempSync(join(tmpdir(), "dspec-projection-lock-"));
  try {
    const actions = [writeAction("create", "created.md", null, "created\n")];
    let rejectedConcurrentTransaction = false;

    assert.throws(
      () => applyProjectionTransaction(actions, {
        root,
        beforeCommit() {
          assert.throws(
            () => applyProjectionTransaction(actions, { root }),
            /projection generation lock is held/,
          );
          rejectedConcurrentTransaction = true;
          throw new Error("injected failure after lock contention");
        },
      }),
      /injected failure after lock contention/,
    );
    assert.equal(rejectedConcurrentTransaction, true);
    assert.equal(existsSync(join(root, ".dspec-projection.lock")), false);
    assert.equal(existsSync(join(root, "created.md")), false);

    assert.deepEqual(
      applyProjectionTransaction(actions, { root }),
      { status: "committed", writes: 1, removes: 0 },
    );
    assert.equal(readFileSync(join(root, "created.md"), "utf8"), "created\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("records Projection lock ownership and recovers only stale owners", () => {
  const root = mkdtempSync(join(tmpdir(), "dspec-projection-lock-owner-"));
  try {
    const actions = [writeAction("create", "created.md", null, "created\n")];
    assert.throws(
      () => applyProjectionTransaction(actions, {
        root,
        beforeCommit() {
          const inspection = inspectProjectionLock(root);
          assert.equal(inspection.status, "held");
          assert.equal(inspection.liveness, "alive");
          assert.equal(inspection.owner.pid, process.pid);
          assert.equal(inspection.owner.hostname, hostname());
          assert.match(inspection.owner.acquiredAt, /^\d{4}-\d{2}-\d{2}T/);
          assert.match(inspection.owner.heartbeatAt, /^\d{4}-\d{2}-\d{2}T/);
          assert.equal(inspection.owner.leaseMs, 900_000);
          assert.equal(inspection.lease.status, "active");
          assert.throws(() => recoverProjectionLock(root), /live owner/);
          throw new Error("stop after ownership inspection");
        },
      }),
      /stop after ownership inspection/,
    );
    assert.deepEqual(inspectProjectionLock(root), {
      status: "absent",
      path: ".dspec-projection.lock",
      owner: null,
      liveness: "absent",
      lease: { status: "absent", expiresAt: null },
    });

    const lock = join(root, ".dspec-projection.lock");
    mkdirSync(lock);
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({
      schemaVersion: "2.0",
      token: "stale-owner-token",
      pid: 2_147_483_647,
      hostname: hostname(),
      acquiredAt: "2026-07-15T00:00:00.000Z",
      heartbeatAt: "2026-07-15T00:00:00.000Z",
      leaseMs: 900_000,
    }, null, 2)}\n`);

    assert.equal(inspectProjectionLock(root).liveness, "dead");
    const recovered = recoverProjectionLock(root);
    assert.equal(recovered.status, "recovered");
    assert.equal(recovered.forced, false);
    assert.equal(recovered.previous.liveness, "dead");
    assert.equal(existsSync(lock), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("protects active foreign Projection leases and recovers expired leases", () => {
  const root = mkdtempSync(join(tmpdir(), "dspec-projection-foreign-lease-"));
  const lock = join(root, ".dspec-projection.lock");
  try {
    mkdirSync(lock);
    writeFileSync(join(lock, "owner.json"), `${JSON.stringify({
      schemaVersion: "2.0",
      token: "foreign-owner-token",
      pid: 42,
      hostname: "foreign-build-host",
      acquiredAt: "2026-07-15T00:00:00.000Z",
      heartbeatAt: "2026-07-15T00:00:00.000Z",
      leaseMs: 60_000,
    }, null, 2)}\n`);

    const active = inspectProjectionLock(root, { now: "2026-07-15T00:00:30.000Z" });
    assert.equal(active.liveness, "unknown");
    assert.deepEqual(active.lease, {
      status: "active",
      expiresAt: "2026-07-15T00:01:00.000Z",
    });
    assert.throws(
      () => recoverProjectionLock(root, { now: "2026-07-15T00:00:30.000Z" }),
      /active lease/,
    );

    const expired = recoverProjectionLock(root, { now: "2026-07-15T00:01:01.000Z" });
    assert.equal(expired.status, "recovered");
    assert.equal(expired.forced, false);
    assert.equal(expired.previous.lease.status, "expired");
    assert.equal(existsSync(lock), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("renews Projection leases while staging and committing", () => {
  const root = mkdtempSync(join(tmpdir(), "dspec-projection-lease-renewal-"));
  const times = [
    "2026-07-15T00:00:00.000Z",
    "2026-07-15T00:00:20.000Z",
    "2026-07-15T00:00:40.000Z",
    "2026-07-15T00:00:50.000Z",
  ];
  try {
    applyProjectionTransaction(
      [writeAction("create", "created.md", null, "created\n")],
      {
        root,
        leaseMs: 60_000,
        now: () => times.shift(),
        beforeCommit() {
          const inspection = inspectProjectionLock(root, { now: "2026-07-15T00:00:45.000Z" });
          assert.equal(inspection.owner.acquiredAt, "2026-07-15T00:00:00.000Z");
          assert.equal(inspection.owner.heartbeatAt, "2026-07-15T00:00:40.000Z");
          assert.deepEqual(inspection.lease, {
            status: "active",
            expiresAt: "2026-07-15T00:01:40.000Z",
          });
        },
      },
    );
    assert.equal(readFileSync(join(root, "created.md"), "utf8"), "created\n");
    assert.equal(inspectProjectionLock(root).status, "absent");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
