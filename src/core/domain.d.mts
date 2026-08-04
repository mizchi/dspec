export type DomainCompilerReport = {
  errors: string[];
  [key: string]: unknown;
};

export function domainCodegenIr(model: unknown): DomainCompilerReport;
export function domainRelationshipGraph(model: unknown): DomainCompilerReport;
export function renderDomainRelationshipMarkdown(report: unknown): string;
export function renderDomainRelationshipMermaid(report: unknown): string;
export function renderDomainTypescript(model: unknown): string;
