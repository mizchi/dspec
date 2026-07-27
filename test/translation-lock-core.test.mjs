import assert from "node:assert/strict";
import test from "node:test";

import {
  TRANSLATION_LOCK_SCHEMA_VERSION,
  createTranslationLock,
  translationCheck,
  translationSnapshot,
} from "../src/core/translation-lock.mjs";

function fixtureDocument() {
  return {
    model: {
      id: "password-policy",
      version: "0.1.0",
      primaryLocale: "ja",
      locales: ["ja", "en"],
      name: { default: "パスワード方針", labels: { ja: "パスワード方針", en: "Password policy" } },
      vocabulary: [{
        id: "account.password",
        text: { default: "パスワード", labels: { ja: "パスワード", en: "password" } },
      }],
      i18n: {
        requiredLocales: ["ja", "en"],
        glossary: [{ term: "account.password", labels: { ja: "パスワード", en: "password" } }],
      },
      rules: [{
        id: "PASSWORD-MIN-LENGTH",
        text: { default: "8文字未満のパスワードを拒否する", labels: { ja: "8文字未満のパスワードを拒否する", en: "Reject passwords shorter than eight characters" } },
        mustNot: [{
          expr: "accept(password.length < 8)",
          text: { default: "短いパスワードを受け入れない", labels: { ja: "短いパスワードを受け入れない", en: "Do not accept short passwords" } },
        }],
      }],
      decisions: [],
    },
  };
}

test("materializes deterministic source-to-translation bindings from localized spec text", () => {
  const snapshot = translationSnapshot(fixtureDocument());
  const lock = createTranslationLock(snapshot);

  assert.equal(snapshot.status, "pass");
  assert.equal(lock.translationLockSchemaVersion, TRANSLATION_LOCK_SCHEMA_VERSION);
  assert.deepEqual(snapshot.targetLocales, ["en"]);
  assert.deepEqual(lock, createTranslationLock(translationSnapshot(fixtureDocument())));
  assert.deepEqual(lock.entries.map((entry) => entry.key), [
    "model.name#en",
    "rule:PASSWORD-MIN-LENGTH.mustNot[0].text#en",
    "rule:PASSWORD-MIN-LENGTH.text#en",
    "term:account.password.text#en",
  ]);
  assert.ok(lock.entries.every((entry) => entry.sourceHash.startsWith("sha256:") && entry.translationHash.startsWith("sha256:")));
});

test("reports source, translation, and glossary changes independently", () => {
  const document = fixtureDocument();
  const lock = createTranslationLock(translationSnapshot(document));

  document.model.rules[0].text.labels.ja = "10文字未満のパスワードを拒否する";
  document.model.vocabulary[0].text.labels.en = "secret";
  document.model.i18n.glossary[0].labels.en = "secret";

  const report = translationCheck(document, lock);

  assert.equal(report.status, "fail");
  assert.deepEqual(report.drift.map((entry) => ({ kind: entry.kind, key: entry.key })), [
    { kind: "source-content", key: "rule:PASSWORD-MIN-LENGTH.text#en" },
    { kind: "translation-content", key: "term:account.password.text#en" },
    { kind: "terminology-content", key: "i18n.glossary" },
  ]);
  assert.deepEqual(report.errors, []);
});

test("keeps a missing required translation explicit instead of falling back", () => {
  const document = fixtureDocument();
  delete document.model.rules[0].mustNot[0].text.labels.en;

  const snapshot = translationSnapshot(document);

  assert.equal(snapshot.status, "fail");
  assert.deepEqual(snapshot.errors, [
    "translation target is missing: rule:PASSWORD-MIN-LENGTH.mustNot[0].text#en",
  ]);
});

test("uses stable ids instead of array positions for open-ended pattern text", () => {
  const document = fixtureDocument();
  document.model.patterns = {
    catalog: {
      entries: [
        { id: "second", text: { default: "二番目", labels: { ja: "二番目", en: "second" } } },
        { id: "first", text: { default: "最初", labels: { ja: "最初", en: "first" } } },
      ],
    },
  };
  const before = createTranslationLock(translationSnapshot(document));
  document.model.patterns.catalog.entries.reverse();
  const after = createTranslationLock(translationSnapshot(document));

  assert.deepEqual(before, after);
  assert.ok(before.entries.some((entry) => entry.key === "model.patterns.catalog.entries[first].text#en"));
});
