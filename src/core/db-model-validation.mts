type UnknownRecord = Record<string, unknown>;

type Identified = {
  id?: string | null;
};

export type DbModelColumn = Identified & {
  references?: string | null;
};

export type DbModelTable = Identified & {
  columns?: DbModelColumn[];
  primaryKey?: string[];
  tenantColumn?: string | null;
};

export type DbModelInvariant = Identified & {
  tables?: string[];
};

export type DbModelTransaction = Identified & {
  idempotencyKey?: string | null;
  preserves?: string[];
  reads?: string[];
  writes?: string[];
};

export type DbMigrationMapping = Identified & {
  invariants?: string[];
};

export type DbModelMigration = Identified & {
  fromTables?: string[];
  mappings?: DbMigrationMapping[];
  preserves?: string[];
  toTables?: string[];
};

export type DbPattern = {
  invariants?: DbModelInvariant[];
  migrations?: DbModelMigration[];
  tables?: DbModelTable[];
  transactions?: DbModelTransaction[];
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

export function dbPattern(model: unknown): DbPattern | null {
  const patterns = record(record(model)?.patterns);
  const db = record(patterns?.db);
  return db ? db as DbPattern : null;
}

export function dbTables(db: DbPattern | null | undefined): DbModelTable[] {
  return list<DbModelTable>(db?.tables);
}

export function dbInvariants(db: DbPattern | null | undefined): DbModelInvariant[] {
  return list<DbModelInvariant>(db?.invariants);
}

export function dbTransactions(db: DbPattern | null | undefined): DbModelTransaction[] {
  return list<DbModelTransaction>(db?.transactions);
}

export function dbMigrations(db: DbPattern | null | undefined): DbModelMigration[] {
  return list<DbModelMigration>(db?.migrations);
}

export function dbColumnRefParts(ref: unknown): { tableId: string; columnId: string } | null {
  const parts = String(ref).split(".");
  return parts.length === 2 ? { tableId: parts[0], columnId: parts[1] } : null;
}

export function dbTableMap(db: DbPattern | null | undefined): Map<string | null | undefined, DbModelTable> {
  return new Map(dbTables(db).map((table) => [table.id, table]));
}

export function dbInvariantMap(db: DbPattern | null | undefined): Map<string | null | undefined, DbModelInvariant> {
  return new Map(dbInvariants(db).map((invariant) => [invariant.id, invariant]));
}

export function dbColumnIds(table: DbModelTable): Set<string | null | undefined> {
  return new Set(list<DbModelColumn>(table.columns).map((column) => column.id));
}

function validateDbColumnRef(
  errors: string[],
  db: DbPattern,
  context: string,
  ref: unknown,
): void {
  const parts = dbColumnRefParts(ref);
  if (!parts) {
    errors.push(`invalid db column reference: ${context} -> ${ref}`);
    return;
  }
  const table = dbTableMap(db).get(parts.tableId);
  if (!table) {
    errors.push(`unknown db column reference table: ${context} -> ${ref}`);
    return;
  }
  if (!dbColumnIds(table).has(parts.columnId)) {
    errors.push(`unknown db column reference column: ${context} -> ${ref}`);
  }
}

export function validateDbModel(model: unknown): string[] {
  const errors: string[] = [];
  const db = dbPattern(model);
  if (!db) return errors;

  const tables = dbTables(db);
  const invariants = dbInvariants(db);
  const transactions = dbTransactions(db);
  const migrations = dbMigrations(db);
  checkUnique(errors, "db table id", tables);
  checkUnique(errors, "db invariant id", invariants);
  checkUnique(errors, "db transaction id", transactions);
  checkUnique(errors, "db migration id", migrations);

  const tableIds = new Set(tables.map((table) => table.id));
  const invariantIds = new Set(invariants.map((invariant) => invariant.id));

  for (const table of tables) {
    checkUnique(errors, `db column id in ${table.id}`, list<DbModelColumn>(table.columns));
    const columnIds = dbColumnIds(table);
    for (const columnId of list<string>(table.primaryKey)) {
      if (!columnIds.has(columnId)) {
        errors.push(`unknown db primary key column: ${table.id} -> ${columnId}`);
      }
    }
    if (table.tenantColumn && !columnIds.has(table.tenantColumn)) {
      errors.push(`unknown db tenant column: ${table.id} -> ${table.tenantColumn}`);
    }
    for (const column of list<DbModelColumn>(table.columns)) {
      if (column.references) {
        validateDbColumnRef(errors, db, `${table.id}.${column.id}`, column.references);
      }
    }
  }

  for (const invariant of invariants) {
    for (const tableId of list<string>(invariant.tables)) {
      if (!tableIds.has(tableId)) {
        errors.push(`unknown db invariant table: ${invariant.id} -> ${tableId}`);
      }
    }
  }

  for (const transaction of transactions) {
    for (const tableId of list<string>(transaction.reads)) {
      if (!tableIds.has(tableId)) {
        errors.push(`unknown db transaction read table: ${transaction.id} -> ${tableId}`);
      }
    }
    for (const tableId of list<string>(transaction.writes)) {
      if (!tableIds.has(tableId)) {
        errors.push(`unknown db transaction write table: ${transaction.id} -> ${tableId}`);
      }
    }
    for (const invariantId of list<string>(transaction.preserves)) {
      if (!invariantIds.has(invariantId)) {
        errors.push(`unknown db transaction invariant: ${transaction.id} -> ${invariantId}`);
      }
    }
    if (transaction.idempotencyKey) {
      validateDbColumnRef(
        errors,
        db,
        `${transaction.id}.idempotencyKey`,
        transaction.idempotencyKey,
      );
    }
  }

  for (const migration of migrations) {
    const mappings = list<DbMigrationMapping>(migration.mappings);
    checkUnique(errors, `db migration mapping id in ${migration.id}`, mappings);
    for (const tableId of list<string>(migration.fromTables)) {
      if (!tableIds.has(tableId)) {
        errors.push(`unknown db migration source table: ${migration.id} -> ${tableId}`);
      }
    }
    for (const tableId of list<string>(migration.toTables)) {
      if (!tableIds.has(tableId)) {
        errors.push(`unknown db migration target table: ${migration.id} -> ${tableId}`);
      }
    }
    for (const invariantId of list<string>(migration.preserves)) {
      if (!invariantIds.has(invariantId)) {
        errors.push(`unknown db migration invariant: ${migration.id} -> ${invariantId}`);
      }
    }
    const preservedInvariantIds = new Set(list<string>(migration.preserves));
    for (const mapping of mappings) {
      for (const invariantId of list<string>(mapping.invariants)) {
        if (!invariantIds.has(invariantId)) {
          errors.push(`unknown db migration mapping invariant: ${migration.id}.${mapping.id} -> ${invariantId}`);
        } else if (!preservedInvariantIds.has(invariantId)) {
          errors.push(`db migration mapping invariant is not preserved: ${migration.id}.${mapping.id} -> ${invariantId}`);
        }
      }
    }
  }

  return errors;
}
