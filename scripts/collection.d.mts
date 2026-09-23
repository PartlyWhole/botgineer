import type { Block, ErrorType, Glossary, Misconception, Stage } from '../src/collection/model'
export function blocks(md: string): Block[]
export function errorTypes(text: string): ErrorType[]
export function idsIn(text: string, own?: string | null): string[]
export function parseStage(file: string, md: string): Stage
export function parseGlossary(md: string): Glossary
export function parseMisconceptions(md: string): Misconception[]
export function parseAll(): { stages: Stage[]; glossary: Glossary; misconceptions: Misconception[] }
export const slug: (text: string) => string
export function parseSummaries(md: string): Map<number, string>
