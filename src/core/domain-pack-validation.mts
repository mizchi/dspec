type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

type DomainPackHelper = Identified & {
  emitsTypedAst?: boolean | null;
  predicates?: Array<string | null>;
  returns?: string | null;
};

export type DomainPack = Identified & {
  helpers?: DomainPackHelper[];
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function checkUnique(errors: string[], label: string, items: readonly Identified[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) errors.push(`duplicate ${label}: ${item.id}`);
    seen.add(item.id);
  }
}

export function domainPacks(model: unknown): DomainPack[] {
  return list<DomainPack>(record(model)?.domainPacks);
}

export function validateDomainPacks(model: unknown): string[] {
  const errors: string[] = [];
  const packs = domainPacks(model);
  checkUnique(errors, "domain pack id", packs);

  for (const pack of packs) {
    const helperIds = new Set<string | null | undefined>();
    for (const helper of list<DomainPackHelper>(pack.helpers)) {
      if (helperIds.has(helper.id)) {
        errors.push(`duplicate domain pack helper id: ${pack.id}.${helper.id}`);
      }
      helperIds.add(helper.id);

      if (helper.returns === "rule" && !helper.emitsTypedAst) {
        errors.push(`domain pack rule helper must emit typed ast: ${pack.id}.${helper.id}`);
      }
      if (helper.emitsTypedAst && list<string | null>(helper.predicates).length === 0) {
        errors.push(`domain pack typed ast helper has no predicates: ${pack.id}.${helper.id}`);
      }
    }
  }

  return errors;
}
