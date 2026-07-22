export const DOMAIN_CODEGEN_IR_SCHEMA_VERSION = "1.0";
export const DOMAIN_RELATIONSHIP_GRAPH_SCHEMA_VERSION = "1.0";

const FIELD_TYPES = new Set([
  "string",
  "integer",
  "boolean",
  "decimal",
  "instant",
  "date",
  "identifier",
  "uuid",
  "value-object",
  "entity-reference",
  "enum",
]);

const SCALAR_TYPESCRIPT_TYPES = Object.freeze({
  string: "string",
  integer: "number",
  boolean: "boolean",
  // Decimal stays a string until an application deliberately selects a
  // decimal/money library. JavaScript number would silently lose precision.
  decimal: "string",
  instant: "string",
  date: "string",
  identifier: "string",
  uuid: "string",
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function byId(left, right) {
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}

function domain(model) {
  return model?.patterns?.domain ?? null;
}

function pascalCase(value) {
  return String(value ?? "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function camelCase(value) {
  const name = pascalCase(value);
  return name.length === 0 ? name : `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

function validTypescriptIdentifier(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function codeNameErrors(errors, owner, id, name) {
  if (!validTypescriptIdentifier(name)) {
    errors.push(`${owner} cannot be rendered as a TypeScript identifier: ${id}`);
  }
}

function uniqueIds(errors, owner, values) {
  const seen = new Set();
  for (const value of values) {
    const id = value?.id;
    if (!id) {
      errors.push(`${owner} id is missing`);
      continue;
    }
    if (seen.has(id)) errors.push(`duplicate ${owner} id: ${id}`);
    seen.add(id);
  }
}

function fieldMaps(domainModel) {
  return {
    aggregates: new Map(list(domainModel?.aggregates).map((entry) => [entry.id, entry])),
    entities: new Map(list(domainModel?.entities).map((entry) => [entry.id, entry])),
    enums: new Map(list(domainModel?.enums).map((entry) => [entry.id, entry])),
    valueObjects: new Map(list(domainModel?.valueObjects).map((entry) => [entry.id, entry])),
  };
}

function validateFields(errors, owner, fields, maps) {
  uniqueIds(errors, `domain field in ${owner}`, fields);
  const rendered = new Set();
  for (const field of fields) {
    if (!field?.id) continue;
    const name = camelCase(field.id);
    codeNameErrors(errors, `domain field in ${owner}`, field.id, name);
    if (rendered.has(name)) errors.push(`domain field code name collision in ${owner}: ${field.id} -> ${name}`);
    rendered.add(name);
    if (!FIELD_TYPES.has(field.type)) {
      errors.push(`unknown domain field type: ${owner}.${field.id} -> ${field.type ?? "missing"}`);
      continue;
    }
    const needsTarget = ["value-object", "entity-reference", "enum"].includes(field.type);
    if (needsTarget && !field.target) {
      errors.push(`domain field type requires target: ${owner}.${field.id} -> ${field.type}`);
      continue;
    }
    if (!needsTarget && field.target) {
      errors.push(`scalar domain field cannot have target: ${owner}.${field.id}`);
      continue;
    }
    if (field.type === "value-object" && !maps.valueObjects.has(field.target)) {
      errors.push(`unknown domain value object field target: ${owner}.${field.id} -> ${field.target}`);
    }
    if (field.type === "entity-reference" && !maps.entities.has(field.target)) {
      errors.push(`unknown domain entity reference field target: ${owner}.${field.id} -> ${field.target}`);
    }
    if (field.type === "enum" && !maps.enums.has(field.target)) {
      errors.push(`unknown domain enum field target: ${owner}.${field.id} -> ${field.target}`);
    }
  }
}

/**
 * Validate the DDD authoring surface. An absent catalog is valid so projects
 * can adopt it incrementally; `domainCodegenIr` requires a present catalog.
 */
export function validateDomainModel(model) {
  const errors = [];
  const domainModel = domain(model);
  if (!domainModel) return errors;

  const enums = list(domainModel.enums);
  const valueObjects = list(domainModel.valueObjects);
  const entities = list(domainModel.entities);
  const aggregates = list(domainModel.aggregates);
  const commands = list(domainModel.commands);
  const events = list(domainModel.events);
  const invariants = list(domainModel.invariants);
  const formalizations = list(domainModel.formalizations);
  const maps = fieldMaps(domainModel);
  const ruleIds = new Set(list(model?.rules).map((rule) => rule.id));

  uniqueIds(errors, "domain enum", enums);
  uniqueIds(errors, "domain value object", valueObjects);
  uniqueIds(errors, "domain entity", entities);
  uniqueIds(errors, "domain aggregate", aggregates);
  uniqueIds(errors, "domain command", commands);
  uniqueIds(errors, "domain event", events);
  uniqueIds(errors, "domain invariant", invariants);
  uniqueIds(errors, "domain formalization", formalizations);

  const renderedTypes = new Map();
  for (const [kind, entries] of [["enum", enums], ["value object", valueObjects], ["entity", entities], ["command", commands], ["event", events]]) {
    for (const entry of entries) {
      if (!entry?.id) continue;
      const name = pascalCase(entry.id);
      codeNameErrors(errors, `domain ${kind}`, entry.id, name);
      const owner = renderedTypes.get(name);
      if (owner) errors.push(`domain TypeScript name collision: ${owner} and ${kind}:${entry.id} -> ${name}`);
      else renderedTypes.set(name, `${kind}:${entry.id}`);
    }
  }

  for (const entry of enums) {
    if (!entry?.id) continue;
    if (list(entry.values).length === 0) errors.push(`domain enum has no values: ${entry.id}`);
    const values = new Set();
    for (const value of list(entry.values)) {
      if (values.has(value)) errors.push(`duplicate domain enum value: ${entry.id} -> ${value}`);
      values.add(value);
    }
  }

  for (const valueObject of valueObjects) {
    if (!valueObject?.id) continue;
    validateFields(errors, `value object ${valueObject.id}`, list(valueObject.fields), maps);
  }

  for (const entity of entities) {
    if (!entity?.id) continue;
    const fields = list(entity.fields);
    validateFields(errors, `entity ${entity.id}`, fields, maps);
    const identity = fields.find((field) => field.id === entity.identity);
    if (!identity) errors.push(`domain entity identity is not a field: ${entity.id} -> ${entity.identity ?? "missing"}`);
    else if (identity.collection === true) errors.push(`domain entity identity cannot be a collection: ${entity.id} -> ${entity.identity}`);
  }

  const aggregateMembers = new Map();
  for (const aggregate of aggregates) {
    if (!aggregate?.id) continue;
    codeNameErrors(errors, "domain aggregate", aggregate.id, pascalCase(aggregate.id));
    if (!maps.entities.has(aggregate.root)) {
      errors.push(`unknown domain aggregate root: ${aggregate.id} -> ${aggregate.root ?? "missing"}`);
    }
    const members = list(aggregate.members);
    if (!members.includes(aggregate.root)) {
      errors.push(`domain aggregate ${aggregate.id} must include its root ${aggregate.root ?? "missing"} in members`);
    }
    const memberIds = new Set();
    for (const member of members) {
      if (memberIds.has(member)) errors.push(`duplicate domain aggregate member: ${aggregate.id} -> ${member}`);
      memberIds.add(member);
      if (!maps.entities.has(member)) errors.push(`unknown domain aggregate member: ${aggregate.id} -> ${member}`);
      const owner = aggregateMembers.get(member);
      if (owner && owner !== aggregate.id) errors.push(`domain entity belongs to multiple aggregates: ${member} -> ${owner}, ${aggregate.id}`);
      else aggregateMembers.set(member, aggregate.id);
    }
  }

  for (const command of commands) {
    if (!command?.id) continue;
    if (!maps.aggregates.has(command.aggregate)) errors.push(`unknown domain command aggregate: ${command.id} -> ${command.aggregate ?? "missing"}`);
    validateFields(errors, `command ${command.id}`, list(command.fields), maps);
  }
  for (const event of events) {
    if (!event?.id) continue;
    if (!maps.aggregates.has(event.aggregate)) errors.push(`unknown domain event aggregate: ${event.id} -> ${event.aggregate ?? "missing"}`);
    validateFields(errors, `event ${event.id}`, list(event.fields), maps);
  }
  for (const invariant of invariants) {
    if (!invariant?.id) continue;
    if (invariant.aggregate && !maps.aggregates.has(invariant.aggregate)) {
      errors.push(`unknown domain invariant aggregate: ${invariant.id} -> ${invariant.aggregate}`);
    }
    if (!ruleIds.has(invariant.rule)) errors.push(`unknown domain invariant rule: ${invariant.id} -> ${invariant.rule ?? "missing"}`);
  }
  for (const formalization of formalizations) {
    if (!formalization?.id) continue;
    if (!ruleIds.has(formalization.rule)) errors.push(`unknown domain formalization rule: ${formalization.id} -> ${formalization.rule ?? "missing"}`);
    if (!formalization.target?.path) errors.push(`domain formalization target is missing: ${formalization.id}`);
  }

  return errors.sort();
}

function typescriptFieldType(field, identityFieldId = null, identityType = null) {
  let type = field.id === identityFieldId ? identityType : SCALAR_TYPESCRIPT_TYPES[field.type];
  if (field.type === "value-object") type = pascalCase(field.target);
  if (field.type === "entity-reference") type = `${pascalCase(field.target)}Id`;
  if (field.type === "enum") type = pascalCase(field.target);
  return field.collection === true ? `${type}[]` : type;
}

function irFields(fields) {
  return list(fields).map((field) => ({
    id: field.id,
    name: camelCase(field.id),
    type: field.type,
    target: field.target ?? null,
    required: field.required !== false,
    collection: field.collection === true,
  }));
}

/**
 * Compile typed domain declarations to the stable, language-neutral surface
 * consumed by built-in and external code generators.
 */
export function domainCodegenIr(model) {
  const domainModel = domain(model);
  const errors = domainModel ? validateDomainModel(model) : ["domain model has no Domain catalog"];
  const empty = {
    enums: [],
    valueObjects: [],
    entities: [],
    aggregates: [],
    commands: [],
    events: [],
  };
  if (errors.length > 0) {
    return {
      schemaVersion: DOMAIN_CODEGEN_IR_SCHEMA_VERSION,
      status: "fail",
      model: { id: model?.id ?? null, version: model?.version ?? null },
      summary: { enums: 0, valueObjects: 0, entities: 0, aggregates: 0, commands: 0, events: 0, invariants: 0, formalizations: 0 },
      types: empty,
      invariants: [],
      formalizations: [],
      errors,
    };
  }

  const invariantByAggregate = new Map();
  const invariants = list(domainModel.invariants).slice().sort(byId).map((entry) => ({
    id: entry.id,
    aggregate: entry.aggregate ?? null,
    rule: entry.rule,
  }));
  for (const invariant of invariants) {
    if (!invariant.aggregate) continue;
    invariantByAggregate.set(invariant.aggregate, [...(invariantByAggregate.get(invariant.aggregate) ?? []), invariant]);
  }
  const types = {
    enums: list(domainModel.enums).slice().sort(byId).map((entry) => ({
      id: entry.id,
      name: pascalCase(entry.id),
      values: list(entry.values).slice().sort(),
    })),
    valueObjects: list(domainModel.valueObjects).slice().sort(byId).map((entry) => ({
      id: entry.id,
      name: pascalCase(entry.id),
      fields: irFields(entry.fields),
    })),
    entities: list(domainModel.entities).slice().sort(byId).map((entry) => ({
      id: entry.id,
      name: pascalCase(entry.id),
      identity: entry.identity,
      identityType: `${pascalCase(entry.id)}Id`,
      fields: irFields(entry.fields),
    })),
    aggregates: list(domainModel.aggregates).slice().sort(byId).map((entry) => ({
      id: entry.id,
      name: pascalCase(entry.id),
      root: entry.root,
      rootName: pascalCase(entry.root),
      members: list(entry.members).slice().sort(),
      invariants: list(invariantByAggregate.get(entry.id)).slice().sort(byId),
    })),
    commands: list(domainModel.commands).slice().sort(byId).map((entry) => ({
        id: entry.id,
        name: pascalCase(entry.id),
        functionName: camelCase(entry.id),
        aggregate: entry.aggregate,
        aggregateName: pascalCase(entry.aggregate),
        fields: irFields(entry.fields),
      })),
    events: list(domainModel.events).slice().sort(byId).map((entry) => ({
        id: entry.id,
        name: pascalCase(entry.id),
        aggregate: entry.aggregate,
        aggregateName: pascalCase(entry.aggregate),
        fields: irFields(entry.fields),
      })),
  };
  const formalizations = list(domainModel.formalizations).slice().sort(byId).map((entry) => ({
    id: entry.id,
    rule: entry.rule,
    kind: entry.kind,
    assurance: entry.assurance,
    assumptions: list(entry.assumptions).slice().sort(),
    target: {
      kind: entry.target.kind,
      path: entry.target.path,
      symbol: entry.target.symbol ?? null,
    },
  }));
  return {
    schemaVersion: DOMAIN_CODEGEN_IR_SCHEMA_VERSION,
    status: "pass",
    model: { id: model.id, version: model.version },
    summary: {
      enums: types.enums.length,
      valueObjects: types.valueObjects.length,
      entities: types.entities.length,
      aggregates: types.aggregates.length,
      commands: types.commands.length,
      events: types.events.length,
      invariants: list(domainModel.invariants).length,
      formalizations: formalizations.length,
    },
    types,
    invariants,
    formalizations,
    errors: [],
  };
}

function relationshipArtifactId(reference) {
  const symbol = reference?.symbol ? `#${reference.symbol}` : "";
  return `artifact/${reference?.kind ?? "unknown"}/${reference?.path ?? "missing"}${symbol}`;
}

function relationshipTargetId(field) {
  if (field?.type === "value-object") return `domain/value-object/${field.target}`;
  if (field?.type === "entity-reference") return `domain/entity/${field.target}`;
  if (field?.type === "enum") return `domain/enum/${field.target}`;
  return null;
}

function relationshipFieldId(collection, declaration, field) {
  return `domain/field/${collection}/${declaration.id}/${field.id}`;
}

function sortedEntries(entries) {
  return [...entries].sort((left, right) => `${left.from}\u0000${left.relation}\u0000${left.to}`.localeCompare(`${right.from}\u0000${right.relation}\u0000${right.to}`));
}

function countBy(values, property) {
  const counts = new Map();
  for (const value of values) counts.set(value[property], (counts.get(value[property]) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * Project the DDD catalog and its normative evidence into a stable graph.
 * The graph records declared relationships; it does not claim semantic
 * equivalence between a Rule and an implementation artifact.
 */
export function domainRelationshipGraph(model) {
  const domainModel = domain(model);
  const errors = domainModel ? validateDomainModel(model) : ["domain model has no Domain catalog"];
  const nodes = new Map();
  const edges = [];
  const addNode = (id, kind, label) => {
    const existing = nodes.get(id);
    if (!existing || (existing.kind.startsWith("unresolved-") && !kind.startsWith("unresolved-"))) {
      nodes.set(id, { id, kind, label });
    }
    return id;
  };
  const addEdge = (from, relation, to) => edges.push({ from, relation, to });
  const ruleById = new Map(list(model?.rules).map((rule) => [rule.id, rule]));
  const termById = new Map(list(model?.vocabulary).map((term) => [term.id, term]));
  const domainDeclarations = [
    { collection: "enums", kind: "enum", prefix: "domain/enum" },
    { collection: "valueObjects", kind: "value-object", prefix: "domain/value-object" },
    { collection: "entities", kind: "entity", prefix: "domain/entity" },
    { collection: "aggregates", kind: "aggregate", prefix: "domain/aggregate" },
    { collection: "commands", kind: "command", prefix: "domain/command" },
    { collection: "events", kind: "event", prefix: "domain/event" },
    { collection: "invariants", kind: "invariant", prefix: "domain/invariant" },
    { collection: "formalizations", kind: "formalization", prefix: "domain/formalization" },
  ];

  const ruleNode = (ruleId) => {
    const rule = ruleById.get(ruleId);
    return addNode(`rule/${ruleId}`, rule ? "rule" : "unresolved-rule", `Rule ${ruleId}`);
  };
  const artifactNode = (reference) => {
    const id = relationshipArtifactId(reference);
    const symbol = reference?.symbol ? `#${reference.symbol}` : "";
    return addNode(id, "artifact", `${reference?.kind ?? "unknown"} ${reference?.path ?? "missing"}${symbol}`);
  };
  const domainTargetNode = (kind, target) => {
    const id = `domain/${kind}/${target ?? "missing"}`;
    if (!nodes.has(id)) addNode(id, "unresolved-domain-target", `Unresolved ${kind} ${target ?? "missing"}`);
    return id;
  };

  for (const rule of list(model?.rules).slice().sort(byId)) {
    const ruleId = ruleNode(rule.id);
    for (const termId of list(rule.terms).slice().sort()) {
      const term = termById.get(termId);
      const termNode = addNode(`term/${termId}`, term ? "term" : "unresolved-term", `Term ${termId}`);
      addEdge(ruleId, "uses-term", termNode);
    }
    for (const check of list(rule.checks).slice().sort((left, right) => `${left.backend}\u0000${left.ref}`.localeCompare(`${right.backend}\u0000${right.ref}`))) {
      const checkNode = addNode(`check/${check.backend}/${encodeURIComponent(check.ref)}`, "check", `${check.backend} ${check.ref}`);
      addEdge(ruleId, "has-check", checkNode);
    }
    for (const reference of list(rule.implementedBy).slice().sort((left, right) => relationshipArtifactId(left).localeCompare(relationshipArtifactId(right)))) {
      addEdge(ruleId, "implemented-by", artifactNode(reference));
    }
  }

  for (const { collection, kind, prefix } of domainDeclarations) {
    for (const declaration of list(domainModel?.[collection]).slice().sort(byId)) {
      const declarationId = addNode(`${prefix}/${declaration.id}`, kind, `${kind} ${declaration.id}`);
      for (const field of list(declaration.fields).slice().sort(byId)) {
        const fieldId = addNode(relationshipFieldId(collection, declaration, field), "field", `${declaration.id}.${field.id}: ${field.type}`);
        addEdge(declarationId, "declares-field", fieldId);
        const targetId = relationshipTargetId(field);
        if (targetId) {
          const kind = field.type === "value-object" ? "value-object" : field.type === "entity-reference" ? "entity" : "enum";
          addEdge(fieldId, "references", domainTargetNode(kind, field.target));
        }
      }
      if (collection === "aggregates") {
        addEdge(declarationId, "root", domainTargetNode("entity", declaration.root));
        for (const member of list(declaration.members).slice().sort()) addEdge(declarationId, "member", domainTargetNode("entity", member));
      }
      if (collection === "commands" || collection === "events") {
        addEdge(declarationId, "targets-aggregate", domainTargetNode("aggregate", declaration.aggregate));
      }
      if (collection === "invariants") {
        if (declaration.aggregate) addEdge(declarationId, "invariant-of", domainTargetNode("aggregate", declaration.aggregate));
        addEdge(declarationId, "states-rule", ruleNode(declaration.rule));
      }
      if (collection === "formalizations") {
        addEdge(declarationId, "checks-rule", ruleNode(declaration.rule));
        addEdge(declarationId, "uses-artifact", artifactNode(declaration.target));
      }
    }
  }

  const sortedNodes = [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const sortedEdges = sortedEntries(edges);
  return {
    schemaVersion: DOMAIN_RELATIONSHIP_GRAPH_SCHEMA_VERSION,
    status: errors.length === 0 ? "pass" : "fail",
    model: { id: model?.id ?? null, version: model?.version ?? null },
    summary: {
      nodes: sortedNodes.length,
      edges: sortedEdges.length,
      nodesByKind: countBy(sortedNodes, "kind"),
      edgesByRelation: countBy(sortedEdges, "relation"),
    },
    nodes: sortedNodes,
    edges: sortedEdges,
    errors,
  };
}

function mermaidLabel(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", " ");
}

/** Render the graph as a portable Mermaid flowchart. */
export function renderDomainRelationshipMermaid(graph) {
  const ids = new Map(graph.nodes.map((node, index) => [node.id, `N${index}`]));
  const lines = ["flowchart LR"];
  for (const node of graph.nodes) lines.push(`  ${ids.get(node.id)}[\"${mermaidLabel(node.label)}\"]`);
  for (const edge of graph.edges) lines.push(`  ${ids.get(edge.from)} -->|${mermaidLabel(edge.relation)}| ${ids.get(edge.to)}`);
  return `${lines.join("\n")}\n`;
}

/** Render the same relationship graph as a reviewable Markdown document. */
export function renderDomainRelationshipMarkdown(graph) {
  const lines = [
    `# Specification Relationships ${graph.model.id ?? "unknown"}`,
    "",
    `- version: \`${graph.model.version ?? "unknown"}\``,
    `- status: \`${graph.status}\``,
    `- nodes: \`${graph.summary.nodes}\``,
    `- relationships: \`${graph.summary.edges}\``,
    "",
  ];
  if (graph.errors.length > 0) {
    lines.push("## Validation errors", "");
    for (const error of graph.errors) lines.push(`- ${error}`);
    lines.push("");
  }
  lines.push("## Relationship ledger", "", "| From | Relation | To |", "| --- | --- | --- |");
  for (const edge of graph.edges) lines.push(`| \`${edge.from}\` | \`${edge.relation}\` | \`${edge.to}\` |`);
  lines.push("", "## Diagram", "", "```mermaid", renderDomainRelationshipMermaid(graph).trimEnd(), "```", "");
  return lines.join("\n");
}

function renderInterface(lines, name, fields, identityFieldId = null, identityType = null) {
  lines.push(`export interface ${name} {`);
  for (const field of fields) {
    lines.push(`  ${field.name}${field.required ? "" : "?"}: ${typescriptFieldType(field, identityFieldId, identityType)};`);
  }
  lines.push("}", "");
}

/** Render a deliberately incomplete TypeScript domain-layer scaffold. */
export function renderDomainTypescript(model) {
  const ir = domainCodegenIr(model);
  if (ir.status === "fail") throw new Error(ir.errors.join("\n"));
  const lines = [
    "/*",
    ` * Generated by dspec from ${ir.model.id}@${ir.model.version}.`,
    " * This file owns types and ports only. Implement domain decisions in the application layer.",
    " */",
    "",
  ];
  for (const entry of ir.types.enums) {
    lines.push(`export type ${entry.name} = ${entry.values.map((value) => JSON.stringify(value)).join(" | ")};`, "");
  }
  for (const entry of ir.types.valueObjects) renderInterface(lines, entry.name, entry.fields);
  for (const entry of ir.types.entities) {
    lines.push(`export type ${entry.identityType} = string & { readonly __brand: ${JSON.stringify(entry.identityType)} };`, "");
    renderInterface(lines, entry.name, entry.fields, entry.identity, entry.identityType);
  }
  for (const entry of ir.types.commands) {
    const aggregate = ir.types.aggregates.find((candidate) => candidate.id === entry.aggregate);
    const root = ir.types.entities.find((candidate) => candidate.id === aggregate?.root);
    renderInterface(lines, entry.name, entry.fields, root?.identity, root?.identityType);
  }
  for (const entry of ir.types.events) {
    const aggregate = ir.types.aggregates.find((candidate) => candidate.id === entry.aggregate);
    const root = ir.types.entities.find((candidate) => candidate.id === aggregate?.root);
    renderInterface(lines, entry.name, entry.fields, root?.identity, root?.identityType);
  }
  for (const aggregate of ir.types.aggregates) {
    lines.push(`export interface ${aggregate.rootName}Repository {`);
    lines.push(`  findById(id: ${aggregate.rootName}Id): Promise<${aggregate.rootName} | null>;`);
    lines.push(`  save(entity: ${aggregate.rootName}): Promise<void>;`);
    lines.push("}", "");
  }
  for (const command of ir.types.commands) {
    const aggregate = ir.types.aggregates.find((entry) => entry.id === command.aggregate);
    const rules = list(aggregate?.invariants).map((invariant) => invariant.rule);
    lines.push(`export function ${command.functionName}(command: ${command.name}): ${command.aggregateName} {`);
    lines.push(`  // TODO: enforce domain invariants: ${rules.length > 0 ? rules.join(", ") : "none declared"}`);
    lines.push("  void command;");
    lines.push('  throw new Error("Domain constructor is a generated scaffold; implement it in the application layer");');
    lines.push("}", "");
  }
  if (ir.formalizations.length > 0) {
    lines.push("export const formalizationLinks = [");
    for (const link of ir.formalizations) {
      lines.push(`  ${JSON.stringify(link)},`);
    }
    lines.push("] as const;", "");
  }
  return `${lines.join("\n")}\n`;
}
