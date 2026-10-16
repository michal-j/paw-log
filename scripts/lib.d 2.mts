export function parseCsv(text: string): string[][];
export function buildCatalogues(csvText: string): { en: Record<string, string>; pl: Record<string, string> };
export function buildTokensCss(tokens: unknown): string;
