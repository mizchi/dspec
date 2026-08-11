type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

type VocabularyTerm = Identified & {
  kind?: string | null;
};

export type IntentAccessPolicy = Identified & {
  overrides?: Array<string | null>;
  priority: number;
  process: string;
  subject: string;
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function checkUniqueIdentifiers(errors: string[], label: string, identifiers: readonly unknown[]): void {
  const seen = new Set<unknown>();
  for (const identifier of identifiers) {
    if (seen.has(identifier)) errors.push(`duplicate ${label}: ${identifier}`);
    seen.add(identifier);
  }
}

export function intentAccessPolicies(intent: unknown): IntentAccessPolicy[] {
  return list<IntentAccessPolicy>(record(intent)?.accessPolicies);
}

export function validateIntentAccessPolicyReferences(
  processesValue: unknown,
  vocabularyValue: unknown,
  accessPoliciesValue: unknown,
): string[] {
  const errors: string[] = [];
  const processes = list<Identified>(processesValue);
  const vocabulary = list<VocabularyTerm>(vocabularyValue);
  const accessPolicies = list<IntentAccessPolicy>(accessPoliciesValue);
  const processesById = new Map(processes.map((process) => [process.id, process]));
  const vocabularyById = new Map(vocabulary.map((term) => [term.id, term]));

  for (const policy of accessPolicies) {
    if (!processesById.has(policy.process)) {
      errors.push(`unknown intent access policy process: ${policy.id} -> ${policy.process}`);
    }
    const subject = vocabularyById.get(policy.subject);
    if (!subject || !["actor", "role"].includes(subject.kind ?? "")) {
      errors.push(`intent access policy subject must be an actor or role: ${policy.id} -> ${policy.subject}`);
    }
    checkUniqueIdentifiers(
      errors,
      `intent access policy override in ${policy.id}`,
      list<string | null>(policy.overrides),
    );
  }

  return errors;
}

export function validateIntentAccessPolicyPrecedence(accessPoliciesValue: unknown): string[] {
  const errors: string[] = [];
  const accessPolicies = list<IntentAccessPolicy>(accessPoliciesValue);
  const accessPoliciesById = new Map(accessPolicies.map((policy) => [policy.id, policy]));
  const accessPolicyPriorities = new Map<string, IntentAccessPolicy[]>();
  for (const policy of accessPolicies) {
    const priorityKey = `${policy.process}\u0000${policy.subject}\u0000${policy.priority}`;
    accessPolicyPriorities.set(
      priorityKey,
      [...(accessPolicyPriorities.get(priorityKey) ?? []), policy],
    );
  }

  for (const [priorityKey, policies] of accessPolicyPriorities) {
    if (policies.length < 2) continue;
    const [process, subject, priority] = priorityKey.split("\u0000");
    errors.push(`ambiguous intent access policy precedence: ${process} -> ${subject} at priority ${priority}`);
  }
  for (const policy of accessPolicies) {
    for (const overriddenId of list<string | null>(policy.overrides)) {
      const overridden = accessPoliciesById.get(overriddenId);
      if (!overridden) {
        errors.push(`unknown intent access policy override: ${policy.id} -> ${overriddenId}`);
        continue;
      }
      if (overridden.id === policy.id) {
        errors.push(`intent access policy cannot override itself: ${policy.id}`);
      }
      if (overridden.process !== policy.process || overridden.subject !== policy.subject) {
        errors.push(`intent access policy override target differs in process or subject: ${policy.id} -> ${overridden.id}`);
      }
      if (policy.priority <= overridden.priority) {
        errors.push(`intent access policy override must have higher priority: ${policy.id} -> ${overridden.id}`);
      }
    }
  }

  return errors;
}
