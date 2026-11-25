import {
  NON_ENGLISH_DIACRITICS_REGEX,
  NON_ENGLISH_SPANISH_KEYWORDS_REGEX,
} from "../constants.js";

export interface MarkdownHeading {
  readonly level: number;
  readonly text: string;
  readonly line: number;
}

export interface MarkdownTableRow {
  readonly cells: readonly string[];
  readonly line: number;
}

export interface MarkdownTable {
  readonly headers: readonly string[];
  readonly rows: readonly MarkdownTableRow[];
  readonly startLine: number;
}

export interface NonEnglishMatch {
  readonly line: number;
  readonly token: string;
}

export interface NonEnglishScanOptions {
  readonly ignoreManagedBlocks?: boolean;
  readonly ignoreFences?: boolean;
  readonly lineOffset?: number;
}

const MANAGED_BLOCK_REGEX =
  /<!--\s*BEGIN:([A-Za-z0-9_-]+)\s*-->[\s\S]*?<!--\s*END:\1\s*-->(?:\n[ \t]*\n?[ \t]*---[ \t]*(?=\n|$))?/g;

const OUTPUT_CONTRACT_REGEX =
  /\b(spec_ready|done|blocked|APPROVED|CHANGES_REQUESTED|pr)\s*->\s*(specs\/<name>\/|progress\/(?:spec|impl|review|pr)_<name>\.md)/g;

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function stripManagedBlocks(markdown: string): string {
  const normalized = normalizeLineEndings(markdown);
  const withoutBlocks = normalized.replace(MANAGED_BLOCK_REGEX, "");
  return withoutBlocks.replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");
}

export function stripInlineCode(text: string): string {
  return text.replace(/`+[^`]*`+/g, "");
}

export function computeManagedBlockLineSet(
  lines: readonly string[],
): ReadonlySet<number> {
  const managedLines = new Set<number>();
  let activeBlockName: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (activeBlockName === null) {
      const beginMatch = /<!--\s*BEGIN:([A-Za-z0-9_-]+)\s*-->/.exec(line);
      if (beginMatch?.[1] !== undefined) {
        activeBlockName = beginMatch[1];
        managedLines.add(index);
        if (new RegExp(`<!--\\s*END:${activeBlockName}\\s*-->`).test(line)) {
          activeBlockName = null;
        }
      }
    } else {
      managedLines.add(index);
      if (new RegExp(`<!--\\s*END:${activeBlockName}\\s*-->`).test(line)) {
        activeBlockName = null;
      }
    }
  }

  return managedLines;
}

function isFenceToggle(line: string): string | null {
  const trimmed = line.trim();
  const match = /^(`{3,}|~{3,})/.exec(trimmed);
  return match?.[1] ?? null;
}

export function findNonEnglishMatches(
  content: string,
  options: NonEnglishScanOptions = {},
): readonly NonEnglishMatch[] {
  const ignoreManagedBlocks = options.ignoreManagedBlocks ?? false;
  const ignoreFences = options.ignoreFences ?? true;
  const lineOffset = options.lineOffset ?? 0;

  const lines = normalizeLineEndings(content).split("\n");
  const skippedLines = ignoreManagedBlocks
    ? computeManagedBlockLineSet(lines)
    : new Set<number>();

  const matches: NonEnglishMatch[] = [];
  let activeFenceChar: string | null = null;
  let activeFenceLength = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (skippedLines.has(index)) {
      continue;
    }

    const line = lines[index] ?? "";
    if (ignoreFences) {
      const fence = isFenceToggle(line);
      if (fence !== null) {
        const fenceChar = fence[0] ?? "`";
        if (activeFenceChar === null) {
          activeFenceChar = fenceChar;
          activeFenceLength = fence.length;
        } else if (
          activeFenceChar === fenceChar &&
          fence.length >= activeFenceLength &&
          line.trim().slice(fence.length).trim().length === 0
        ) {
          activeFenceChar = null;
          activeFenceLength = 0;
        }
        continue;
      }

      if (activeFenceChar !== null) {
        continue;
      }
    }

    const cleaned = stripInlineCode(line);
    const diacriticMatch = NON_ENGLISH_DIACRITICS_REGEX.exec(cleaned);
    if (diacriticMatch !== null) {
      matches.push({
        line: index + 1 + lineOffset,
        token: diacriticMatch[0],
      });
      continue;
    }

    const keywordMatch = NON_ENGLISH_SPANISH_KEYWORDS_REGEX.exec(cleaned);
    if (keywordMatch !== null) {
      matches.push({
        line: index + 1 + lineOffset,
        token: keywordMatch[0],
      });
    }
  }

  return matches;
}

export function extractMarkdownHeadings(
  markdown: string,
): readonly MarkdownHeading[] {
  const lines = normalizeLineEndings(markdown).split("\n");
  const headings: MarkdownHeading[] = [];
  let activeFenceChar: string | null = null;
  let activeFenceLength = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fence = isFenceToggle(line);

    if (fence !== null) {
      const fenceChar = fence[0] ?? "`";
      if (activeFenceChar === null) {
        activeFenceChar = fenceChar;
        activeFenceLength = fence.length;
      } else if (
        activeFenceChar === fenceChar &&
        fence.length >= activeFenceLength &&
        line.trim().slice(fence.length).trim().length === 0
      ) {
        activeFenceChar = null;
        activeFenceLength = 0;
      }
      continue;
    }

    if (activeFenceChar !== null) {
      continue;
    }

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match !== null) {
      const hashes = match[1] ?? "";
      const text = match[2]?.trim() ?? "";
      headings.push({
        level: hashes.length,
        text,
        line: index + 1,
      });
    }
  }

  return headings;
}

function splitTableCells(line: string): readonly string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return null;
  }
  const inner = trimmed.slice(1, -1);
  return inner.split("|").map((cell) => cell.trim());
}

function isTableSeparatorRow(cells: readonly string[]): boolean {
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")))
  );
}

export function extractMarkdownTables(
  markdown: string,
): readonly MarkdownTable[] {
  const lines = normalizeLineEndings(markdown).split("\n");
  const tables: MarkdownTable[] = [];
  let activeFenceChar: string | null = null;
  let activeFenceLength = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fence = isFenceToggle(line);

    if (fence !== null) {
      const fenceChar = fence[0] ?? "`";
      if (activeFenceChar === null) {
        activeFenceChar = fenceChar;
        activeFenceLength = fence.length;
      } else if (
        activeFenceChar === fenceChar &&
        fence.length >= activeFenceLength &&
        line.trim().slice(fence.length).trim().length === 0
      ) {
        activeFenceChar = null;
        activeFenceLength = 0;
      }
      continue;
    }

    if (activeFenceChar !== null) {
      continue;
    }

    const headerCells = splitTableCells(line);
    const nextLine = lines[index + 1];
    if (headerCells === null || nextLine === undefined) {
      continue;
    }

    const separatorCells = splitTableCells(nextLine);
    if (
      separatorCells === null ||
      separatorCells.length !== headerCells.length ||
      !isTableSeparatorRow(separatorCells)
    ) {
      continue;
    }

    const startLine = index + 1;
    const rows: MarkdownTableRow[] = [];
    let rowIndex = index + 2;
    while (rowIndex < lines.length) {
      const rowCells = splitTableCells(lines[rowIndex] ?? "");
      if (rowCells === null) {
        break;
      }
      rows.push({
        cells: rowCells,
        line: rowIndex + 1,
      });
      rowIndex += 1;
    }

    tables.push({
      headers: headerCells,
      rows,
      startLine,
    });
    index = rowIndex - 1;
  }

  return tables;
}

export function extractOutputContracts(markdown: string): readonly string[] {
  const normalized = normalizeLineEndings(markdown);
  const matches = new Set<string>();

  for (const match of normalized.matchAll(OUTPUT_CONTRACT_REGEX)) {
    const token = match[1];
    const target = match[2];
    if (token !== undefined && target !== undefined) {
      matches.add(`${token} -> ${target}`);
    }
  }

  return [...matches].sort();
}
