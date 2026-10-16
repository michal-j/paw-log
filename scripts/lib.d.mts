export function parseCsv(text: string): string[][];
export function buildCatalogues(csvText: string): { en: Record<string, string>; pl: Record<string, string> };
export function buildTokensCss(tokens: unknown): string;
export function mergeCatalogues(
  base: { en: Record<string, string>; pl: Record<string, string> },
  ...drafts: { en: Record<string, string>; pl: Record<string, string> }[]
): { en: Record<string, string>; pl: Record<string, string> };
