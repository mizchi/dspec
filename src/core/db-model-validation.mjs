function record(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function list(value) {
    return Array.isArray(value) ? value : [];
}
function checkUnique(errors, label, items) {
    const seen = new Set();
    for (const item of items) {
        if (!item?.id)
            continue;
        if (seen.has(item.id))
            errors.push(`duplicate ${label}: ${item.id}`);
        seen.add(item.id);
    }
}
export function dbPattern(model) {
    const patterns = record(record(model)?.patterns);
    const db = record(patterns?.db);
    return db ? db : null;
}
export function dbTables(db) {
    return list(db?.tables);
}
export function dbInvariants(db) {
    return list(db?.invariants);
}
export function dbTransactions(db) {
    return list(db?.transactions);
}
export function dbMigrations(db) {
    return list(db?.migrations);
}
export function dbColumnRefParts(ref) {
    const parts = String(ref).split(".");
    return parts.length === 2 ? { tableId: parts[0], columnId: parts[1] } : null;
}
export function dbTableMap(db) {
    return new Map(dbTables(db).map((table) => [table.id, table]));
}
export function dbInvariantMap(db) {
    return new Map(dbInvariants(db).map((invariant) => [invariant.id, invariant]));
}
export function dbColumnIds(table) {
    return new Set(list(table.columns).map((column) => column.id));
}
function validateDbColumnRef(errors, db, context, ref) {
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
export function validateDbModel(model) {
    const errors = [];
    const db = dbPattern(model);
    if (!db)
        return errors;
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
        checkUnique(errors, `db column id in ${table.id}`, list(table.columns));
        const columnIds = dbColumnIds(table);
        for (const columnId of list(table.primaryKey)) {
            if (!columnIds.has(columnId)) {
                errors.push(`unknown db primary key column: ${table.id} -> ${columnId}`);
            }
        }
        if (table.tenantColumn && !columnIds.has(table.tenantColumn)) {
            errors.push(`unknown db tenant column: ${table.id} -> ${table.tenantColumn}`);
        }
        for (const column of list(table.columns)) {
            if (column.references) {
                validateDbColumnRef(errors, db, `${table.id}.${column.id}`, column.references);
            }
        }
    }
    for (const invariant of invariants) {
        for (const tableId of list(invariant.tables)) {
            if (!tableIds.has(tableId)) {
                errors.push(`unknown db invariant table: ${invariant.id} -> ${tableId}`);
            }
        }
    }
    for (const transaction of transactions) {
        for (const tableId of list(transaction.reads)) {
            if (!tableIds.has(tableId)) {
                errors.push(`unknown db transaction read table: ${transaction.id} -> ${tableId}`);
            }
        }
        for (const tableId of list(transaction.writes)) {
            if (!tableIds.has(tableId)) {
                errors.push(`unknown db transaction write table: ${transaction.id} -> ${tableId}`);
            }
        }
        for (const invariantId of list(transaction.preserves)) {
            if (!invariantIds.has(invariantId)) {
                errors.push(`unknown db transaction invariant: ${transaction.id} -> ${invariantId}`);
            }
        }
        if (transaction.idempotencyKey) {
            validateDbColumnRef(errors, db, `${transaction.id}.idempotencyKey`, transaction.idempotencyKey);
        }
    }
    for (const migration of migrations) {
        const mappings = list(migration.mappings);
        checkUnique(errors, `db migration mapping id in ${migration.id}`, mappings);
        for (const tableId of list(migration.fromTables)) {
            if (!tableIds.has(tableId)) {
                errors.push(`unknown db migration source table: ${migration.id} -> ${tableId}`);
            }
        }
        for (const tableId of list(migration.toTables)) {
            if (!tableIds.has(tableId)) {
                errors.push(`unknown db migration target table: ${migration.id} -> ${tableId}`);
            }
        }
        for (const invariantId of list(migration.preserves)) {
            if (!invariantIds.has(invariantId)) {
                errors.push(`unknown db migration invariant: ${migration.id} -> ${invariantId}`);
            }
        }
        const preservedInvariantIds = new Set(list(migration.preserves));
        for (const mapping of mappings) {
            for (const invariantId of list(mapping.invariants)) {
                if (!invariantIds.has(invariantId)) {
                    errors.push(`unknown db migration mapping invariant: ${migration.id}.${mapping.id} -> ${invariantId}`);
                }
                else if (!preservedInvariantIds.has(invariantId)) {
                    errors.push(`db migration mapping invariant is not preserved: ${migration.id}.${mapping.id} -> ${invariantId}`);
                }
            }
        }
    }
    return errors;
}
