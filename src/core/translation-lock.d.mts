export const TRANSLATION_LOCK_SCHEMA_VERSION: "1.0";

export type TranslationModelIdentity = {
  id: string | null;
  version: string | null;
  primaryLocale: string | null;
  targetLocales: string[];
};

export type TranslationEntry = {
  key: string;
  sourceHash: string;
  translationHash: string;
};

export type TranslationSnapshot = {
  translationSchemaVersion: string;
  status: "pass" | "fail";
  model: TranslationModelIdentity;
  targetLocales: string[];
  entries: TranslationEntry[];
  terminologyHash: string;
  errors: string[];
};

export type TranslationLock = {
  translationLockSchemaVersion: string;
  model: TranslationModelIdentity;
  entries: TranslationEntry[];
  terminologyHash: string;
};

export type TranslationDrift = {
  kind: string;
  key: string;
};

export type TranslationCheckReport = {
  translationSchemaVersion: string;
  status: "pass" | "fail";
  model: TranslationModelIdentity;
  drift: TranslationDrift[];
  entries: TranslationEntry[];
  errors: string[];
};

export function translationSnapshot(document: unknown): TranslationSnapshot;
export function createTranslationLock(snapshot: TranslationSnapshot): TranslationLock;
export function translationCheck(document: unknown, lock: unknown): TranslationCheckReport;
