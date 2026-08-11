export type DbColumnType = "id" | "bool" | "datetime" | "decimal" | "int" | "string";

export type DbColumn = {
  id: string;
  type: DbColumnType;
  nullable: boolean;
  unique: boolean;
  references?: string;
};

export type DbTable = {
  id: string;
  columns: DbColumn[];
  primaryKey: string[];
};

export type DbSchema = {
  tables: DbTable[];
};

type SqlIdentifier = {
  raw: string;
  rest: string;
  value: string;
};

type ParsedColumn = {
  column: DbColumn;
  primaryKey: string[];
};

type TableConstraint =
  | { kind: "primaryKey" | "unique"; columns: string[] }
  | { kind: "foreignKey"; columns: string[]; reference: string | null };

type Quote = "'" | "\"" | "`" | null;

export class DbSchemaImportError extends Error {
  override name = "DbSchemaImportError";
}

function byId(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

export function stripSqlComments(sql: string): string {
  let output = "";
  let quote: Quote = null;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (quote) {
      output += char;
      if (quote === "'" && char === "'" && next === "'") {
        output += next;
        index += 1;
        continue;
      }
      if (quote === "\"" && char === "\"" && next === "\"") {
        output += next;
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      output += char;
      continue;
    }
    if (char === "-" && next === "-") {
      while (index < sql.length && sql[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    output += char;
  }
  return output;
}

export function splitSqlTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: Quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];
    if (quote) {
      current += char;
      if (quote === "'" && char === "'" && next === "'") {
        current += next;
        index += 1;
        continue;
      }
      if (quote === "\"" && char === "\"" && next === "\"") {
        current += next;
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      if (current.trim().length > 0) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

function splitSqlStatements(sql: string): string[] {
  return splitSqlTopLevel(stripSqlComments(sql), ";");
}

export function splitSqlList(body: string): string[] {
  return splitSqlTopLevel(body, ",");
}

function readSqlIdentifier(input: string): SqlIdentifier | null {
  const source = input.trimStart();
  if (source.length === 0) return null;
  const offset = input.length - source.length;
  const first = source[0];
  if (first === "\"" || first === "`") {
    let value = "";
    for (let index = 1; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (char === first && next === first) {
        value += first;
        index += 1;
        continue;
      }
      if (char === first) {
        return {
          raw: source.slice(0, index + 1),
          rest: source.slice(index + 1),
          value,
        };
      }
      value += char;
    }
    return null;
  }
  if (first === "[") {
    const end = source.indexOf("]");
    if (end === -1) return null;
    return {
      raw: source.slice(0, end + 1),
      rest: source.slice(end + 1),
      value: source.slice(1, end),
    };
  }
  const match = source.match(/^([A-Za-z_][A-Za-z0-9_$]*|\S+)/);
  if (!match) return null;
  return {
    raw: input.slice(offset, offset + match[1].length),
    rest: source.slice(match[1].length),
    value: match[1],
  };
}

function splitQualifiedSqlIdentifier(identifier: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: Quote = null;
  for (let index = 0; index < identifier.length; index += 1) {
    const char = identifier[index];
    const next = identifier[index + 1];
    if (quote) {
      current += char;
      if (quote === "\"" && char === "\"" && next === "\"") {
        current += next;
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === "\"" || char === "`") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ".") {
      if (current.trim().length > 0) parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

export function normalizeSqlIdentifier(identifier: string): string {
  const input = String(identifier).trim();
  const parts = splitQualifiedSqlIdentifier(input);
  const leaf = parts.length > 0 ? parts[parts.length - 1] : input;
  const parsed = readSqlIdentifier(leaf);
  if (parsed) return parsed.value;
  if ((leaf.startsWith("\"") && leaf.endsWith("\"")) || (leaf.startsWith("`") && leaf.endsWith("`"))) {
    return leaf.slice(1, -1);
  }
  if (leaf.startsWith("[") && leaf.endsWith("]")) return leaf.slice(1, -1);
  return leaf;
}

function sqlConstraintKeyword(token: string): boolean {
  return /^(not|null|default|primary|unique|references|check|collate|generated|constraint|identity|comment|encode|compress)$/i.test(token);
}

function sqlTypeText(rest: string): string {
  const tokens: string[] = [];
  for (const token of rest.trim().split(/\s+/)) {
    const normalized = token.replace(/\(.*/, "");
    if (sqlConstraintKeyword(normalized)) break;
    tokens.push(token);
  }
  return tokens.join(" ");
}

function inferDbColumnType(
  columnId: string,
  sqlType: string,
  { primaryKey = false, references = null }: { primaryKey?: boolean; references?: string | null } = {},
): DbColumnType {
  const normalized = sqlType.toUpperCase();
  if (primaryKey || references || columnId === "id" || columnId.endsWith("_id")) return "id";
  if (/\b(BOOL|BOOLEAN)\b/.test(normalized)) return "bool";
  if (/\b(DATE|DATETIME|TIME|TIMESTAMP)\b/.test(normalized)) return "datetime";
  if (/\b(DECIMAL|NUMERIC|REAL|DOUBLE|FLOAT|MONEY)\b/.test(normalized)) return "decimal";
  if (/\b(INT|INTEGER|BIGINT|SMALLINT|TINYINT|SERIAL)\b/.test(normalized)) return "int";
  return "string";
}

function parseColumnReferences(rest: string): string | null {
  const match = rest.match(/\breferences\s+([^\s(]+)(?:\s*\(\s*([^)]+?)\s*\))?/i);
  if (!match) return null;
  const table = normalizeSqlIdentifier(match[1]);
  const column = match[2] ? normalizeSqlIdentifier(match[2]) : "id";
  return `${table}.${column}`;
}

function parenthesizedIdentifierList(definition: string): string[] {
  const match = definition.match(/\(([\s\S]*?)\)/);
  if (!match) return [];
  return splitSqlList(match[1]).map(normalizeSqlIdentifier).filter(Boolean);
}

function parseDbSchemaColumn(definition: string): ParsedColumn | null {
  const parsed = readSqlIdentifier(definition);
  if (!parsed) return null;
  const id = normalizeSqlIdentifier(parsed.value);
  const rest = parsed.rest.trim();
  const primaryKey = /\bprimary\s+key\b/i.test(rest);
  const references = parseColumnReferences(rest);
  const column: DbColumn = {
    id,
    type: inferDbColumnType(id, sqlTypeText(rest), { primaryKey, references }),
    nullable: !primaryKey && !/\bnot\s+null\b/i.test(rest),
    unique: primaryKey || /\bunique\b/i.test(rest),
  };
  if (references) column.references = references;
  return { column, primaryKey: primaryKey ? [id] : [] };
}

function parseDbSchemaConstraint(definition: string): TableConstraint | null {
  let body = definition.trim();
  if (/^constraint\b/i.test(body)) {
    const parsed = readSqlIdentifier(body.replace(/^constraint\b/i, ""));
    if (!parsed) return null;
    body = parsed.rest.trim();
  }
  if (/^primary\s+key\b/i.test(body)) {
    return { kind: "primaryKey", columns: parenthesizedIdentifierList(body) };
  }
  if (/^unique\b/i.test(body)) {
    return { kind: "unique", columns: parenthesizedIdentifierList(body) };
  }
  if (/^foreign\s+key\b/i.test(body)) {
    return {
      kind: "foreignKey",
      columns: parenthesizedIdentifierList(body),
      reference: parseColumnReferences(body),
    };
  }
  return null;
}

function isDbSchemaTableConstraint(definition: string): boolean {
  return /^(constraint|primary\s+key|unique|foreign\s+key|check)\b/i.test(definition.trim());
}

function parseCreateTableStatement(statement: string): DbTable | null {
  const match = statement.match(/^\s*create\s+(?:temporary\s+|temp\s+)?table\s+(?:if\s+not\s+exists\s+)?(.+?)\s*\(([\s\S]*)\)\s*$/i);
  if (!match) return null;
  const table: DbTable = {
    id: normalizeSqlIdentifier(match[1]),
    columns: [],
    primaryKey: [],
  };
  const primaryKey = new Set<string>();
  const uniqueColumns = new Set<string>();
  const references = new Map<string, string>();

  for (const part of splitSqlList(match[2])) {
    if (isDbSchemaTableConstraint(part)) {
      const constraint = parseDbSchemaConstraint(part);
      if (constraint?.kind === "primaryKey") {
        constraint.columns.forEach((column) => primaryKey.add(column));
      }
      if (constraint?.kind === "unique") {
        constraint.columns.forEach((column) => uniqueColumns.add(column));
      }
      if (constraint?.kind === "foreignKey" && constraint.columns.length === 1 && constraint.reference) {
        references.set(constraint.columns[0], constraint.reference);
      }
      continue;
    }
    const parsed = parseDbSchemaColumn(part);
    if (!parsed) continue;
    parsed.primaryKey.forEach((column) => primaryKey.add(column));
    table.columns.push(parsed.column);
  }

  table.primaryKey = [...primaryKey];
  for (const column of table.columns) {
    if (primaryKey.has(column.id)) {
      column.type = "id";
      column.nullable = false;
      column.unique = true;
    }
    if (uniqueColumns.has(column.id)) column.unique = true;
    const reference = references.get(column.id);
    if (!column.references && reference) {
      column.references = reference;
      column.type = "id";
    }
  }
  return table;
}

export function importDbSchema(sql: string): DbSchema {
  const tables = splitSqlStatements(sql)
    .map(parseCreateTableStatement)
    .filter((table): table is DbTable => table !== null)
    .sort(byId);
  if (tables.length === 0) {
    throw new DbSchemaImportError("db schema import found no CREATE TABLE statements");
  }
  return { tables };
}

function pklString(value: string): string {
  return JSON.stringify(value);
}

function pushPklField(lines: string[], indent: string, field: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (typeof value === "boolean" || typeof value === "number") {
    lines.push(`${indent}${field} = ${value}`);
    return;
  }
  lines.push(`${indent}${field} = ${pklString(String(value))}`);
}

function pushPklListing(lines: string[], indent: string, field: string, values: readonly string[]): void {
  if (values.length === 0) return;
  lines.push(`${indent}${field} {`);
  for (const value of values) lines.push(`${indent}  ${pklString(value)}`);
  lines.push(`${indent}}`);
}

export function emitDbSchemaPkl(db: DbSchema): string {
  const lines = ["tables {"];
  for (const table of db.tables) {
    lines.push("  new d.DbTable {");
    pushPklField(lines, "    ", "id", table.id);
    pushPklListing(lines, "    ", "primaryKey", table.primaryKey);
    lines.push("    columns {");
    for (const column of table.columns) {
      lines.push("      new d.DbColumn {");
      pushPklField(lines, "        ", "id", column.id);
      pushPklField(lines, "        ", "type", column.type);
      pushPklField(lines, "        ", "nullable", column.nullable);
      pushPklField(lines, "        ", "unique", column.unique);
      pushPklField(lines, "        ", "references", column.references);
      lines.push("      }");
    }
    lines.push("    }");
    lines.push("  }");
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}
