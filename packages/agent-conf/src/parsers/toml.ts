import { normalizeLineEndings } from "./markdown.js";

export type TomlPrimitive = string | number | boolean;
export type TomlValue = TomlPrimitive | readonly TomlValue[] | TomlTable;
export interface TomlTable {
  [key: string]: TomlValue;
}

export interface TomlParseError {
  readonly message: string;
  readonly line: number;
}

export interface TomlParseSuccess {
  readonly ok: true;
  readonly data: TomlTable;
}

export interface TomlParseFailure {
  readonly ok: false;
  readonly error: TomlParseError;
}

export type TomlParseResult = TomlParseSuccess | TomlParseFailure;

function stripBom(content: string): string {
  return content.startsWith("\uFEFF") ? content.slice(1) : content;
}

function isPlainObject(value: unknown): value is TomlTable {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripInlineComment(raw: string): string {
  let inDouble = false;
  let inSingle = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inDouble && char === "\\") {
      escaped = true;
      continue;
    }
    if (!inSingle && char === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inDouble && char === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inDouble && !inSingle && char === "#") {
      return raw.slice(0, index).trim();
    }
  }

  return raw.trim();
}

function unescapeBasicString(
  raw: string,
  lineNumber: number,
): { ok: true; value: string } | TomlParseFailure {
  let output = "";
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char !== "\\") {
      output += char ?? "";
      continue;
    }

    const next = raw[index + 1];
    if (next === undefined) {
      return {
        ok: false,
        error: {
          message: "Trailing backslash escape in TOML basic string.",
          line: lineNumber,
        },
      };
    }

    switch (next) {
      case "n":
        output += "\n";
        index += 1;
        break;
      case "r":
        output += "\r";
        index += 1;
        break;
      case "t":
        output += "\t";
        index += 1;
        break;
      case "b":
        output += "\b";
        index += 1;
        break;
      case "f":
        output += "\f";
        index += 1;
        break;
      case '"':
        output += '"';
        index += 1;
        break;
      case "\\":
        output += "\\";
        index += 1;
        break;
      case "\n": {
        index += 2;
        while (
          index < raw.length &&
          (raw[index] === " " || raw[index] === "\t" || raw[index] === "\n")
        ) {
          index += 1;
        }
        index -= 1;
        break;
      }
      default:
        return {
          ok: false,
          error: {
            message: `Invalid escape sequence "\\${next}" in TOML basic string.`,
            line: lineNumber,
          },
        };
    }
  }
  return { ok: true, value: output };
}

function parseSingleLineBasicString(
  raw: string,
  lineNumber: number,
): { ok: true; value: string } | TomlParseFailure {
  let escaped = false;
  let closingIndex = -1;

  for (let index = 1; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex === -1) {
    return {
      ok: false,
      error: {
        message: "Unterminated TOML double-quoted string.",
        line: lineNumber,
      },
    };
  }

  const trailing = raw.slice(closingIndex + 1).trim();
  if (trailing.length > 0 && !trailing.startsWith("#")) {
    return {
      ok: false,
      error: {
        message: "Unexpected trailing characters after TOML string.",
        line: lineNumber,
      },
    };
  }

  return unescapeBasicString(raw.slice(1, closingIndex), lineNumber);
}

function parseSingleLineLiteralString(
  raw: string,
  lineNumber: number,
): { ok: true; value: string } | TomlParseFailure {
  const closingIndex = raw.indexOf("'", 1);
  if (closingIndex === -1) {
    return {
      ok: false,
      error: {
        message: "Unterminated TOML literal string.",
        line: lineNumber,
      },
    };
  }

  const trailing = raw.slice(closingIndex + 1).trim();
  if (trailing.length > 0 && !trailing.startsWith("#")) {
    return {
      ok: false,
      error: {
        message: "Unexpected trailing characters after TOML literal string.",
        line: lineNumber,
      },
    };
  }

  return { ok: true, value: raw.slice(1, closingIndex) };
}

function parseInlineArray(
  raw: string,
  lineNumber: number,
): { ok: true; value: readonly TomlValue[] } | TomlParseFailure {
  const cleaned = stripInlineComment(raw);
  if (!cleaned.endsWith("]")) {
    return {
      ok: false,
      error: {
        message: "Unterminated TOML array.",
        line: lineNumber,
      },
    };
  }

  const inner = cleaned.slice(1, -1).trim();
  if (inner.length === 0) {
    return { ok: true, value: [] };
  }

  const elements: string[] = [];
  let current = "";
  let inDouble = false;
  let inSingle = false;
  let escaped = false;
  let depth = 0;

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (escaped) {
      current += char ?? "";
      escaped = false;
      continue;
    }
    if (inDouble && char === "\\") {
      current += char;
      escaped = true;
      continue;
    }
    if (!inSingle && char === '"') {
      inDouble = !inDouble;
      current += char;
      continue;
    }
    if (!inDouble && char === "'") {
      inSingle = !inSingle;
      current += char;
      continue;
    }
    if (!inDouble && !inSingle) {
      if (char === "[") {
        depth += 1;
      } else if (char === "]") {
        depth -= 1;
      } else if (char === "," && depth === 0) {
        elements.push(current.trim());
        current = "";
        continue;
      }
    }
    current += char ?? "";
  }

  if (current.trim().length > 0) {
    elements.push(current.trim());
  }

  const parsedItems: TomlValue[] = [];
  for (const element of elements) {
    if (element.length === 0) {
      continue;
    }
    const parsed = parseSingleLineValue(element, lineNumber);
    if (!parsed.ok) {
      return parsed;
    }
    parsedItems.push(parsed.value);
  }

  return { ok: true, value: parsedItems };
}

function parseSingleLineValue(
  raw: string,
  lineNumber: number,
): { ok: true; value: TomlValue } | TomlParseFailure {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: {
        message: "Missing TOML value after '='.",
        line: lineNumber,
      },
    };
  }

  if (trimmed.startsWith('"')) {
    return parseSingleLineBasicString(trimmed, lineNumber);
  }
  if (trimmed.startsWith("'")) {
    return parseSingleLineLiteralString(trimmed, lineNumber);
  }
  if (trimmed.startsWith("[")) {
    return parseInlineArray(trimmed, lineNumber);
  }

  const cleaned = stripInlineComment(trimmed);
  if (cleaned === "true") {
    return { ok: true, value: true };
  }
  if (cleaned === "false") {
    return { ok: true, value: false };
  }
  if (/^[+-]?\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?$/.test(cleaned)) {
    const numericValue = Number(cleaned.replace(/_/g, ""));
    if (!Number.isNaN(numericValue)) {
      return { ok: true, value: numericValue };
    }
  }

  return {
    ok: false,
    error: {
      message: `Invalid TOML value "${cleaned}".`,
      line: lineNumber,
    },
  };
}

function assignNestedKey(
  target: TomlTable,
  segments: readonly string[],
  value: TomlValue,
  lineNumber: number,
): TomlParseFailure | null {
  let cursor = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (segment === undefined || !/^[A-Za-z0-9_-]+$/.test(segment)) {
      return {
        ok: false,
        error: {
          message: `Invalid TOML key segment "${segment ?? ""}".`,
          line: lineNumber,
        },
      };
    }

    const existing = cursor[segment];
    if (existing === undefined) {
      const created: TomlTable = {};
      cursor[segment] = created;
      cursor = created;
    } else if (isPlainObject(existing)) {
      cursor = existing;
    } else {
      return {
        ok: false,
        error: {
          message: `Cannot redefine non-table TOML key "${segment}" as a table.`,
          line: lineNumber,
        },
      };
    }
  }

  const finalSegment = segments[segments.length - 1];
  if (finalSegment === undefined || !/^[A-Za-z0-9_-]+$/.test(finalSegment)) {
    return {
      ok: false,
      error: {
        message: `Invalid TOML key "${finalSegment ?? ""}".`,
        line: lineNumber,
      },
    };
  }

  if (Object.prototype.hasOwnProperty.call(cursor, finalSegment)) {
    return {
      ok: false,
      error: {
        message: `Duplicate TOML key "${finalSegment}".`,
        line: lineNumber,
      },
    };
  }

  cursor[finalSegment] = value;
  return null;
}

function resolveTable(
  root: TomlTable,
  segments: readonly string[],
  lineNumber: number,
): { ok: true; table: TomlTable } | TomlParseFailure {
  let cursor = root;

  for (const segment of segments) {
    if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
      return {
        ok: false,
        error: {
          message: `Invalid TOML table name segment "${segment}".`,
          line: lineNumber,
        },
      };
    }

    const existing = cursor[segment];
    if (existing === undefined) {
      const created: TomlTable = {};
      cursor[segment] = created;
      cursor = created;
    } else if (isPlainObject(existing)) {
      cursor = existing;
    } else {
      return {
        ok: false,
        error: {
          message: `TOML table "${segment}" conflicts with an existing non-table key.`,
          line: lineNumber,
        },
      };
    }
  }

  return { ok: true, table: cursor };
}

function findClosingTripleQuote(
  text: string,
  delimiter: '"""' | "'''",
): number {
  if (delimiter === "'''") {
    return text.indexOf(delimiter);
  }

  let escaped = false;
  for (let index = 0; index <= text.length - 3; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (text.slice(index, index + 3) === '"""') {
      return index;
    }
  }
  return -1;
}

export function parseToml(content: string): TomlParseResult {
  const normalized = normalizeLineEndings(stripBom(content));
  const lines = normalized.split("\n");
  const root: TomlTable = {};
  let currentTable: TomlTable = root;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed.startsWith("[")) {
      const header = stripInlineComment(trimmed);
      if (
        header.startsWith("[[") ||
        !header.endsWith("]") ||
        header.length <= 2
      ) {
        return {
          ok: false,
          error: {
            message: `Invalid TOML table header "${header}".`,
            line: lineNumber,
          },
        };
      }

      const tablePath = header.slice(1, -1).trim();
      const segments = tablePath.split(".").map((segment) => segment.trim());
      if (segments.length === 0 || segments.some((segment) => !segment)) {
        return {
          ok: false,
          error: {
            message: `Empty table segment in TOML header "${header}".`,
            line: lineNumber,
          },
        };
      }

      const resolved = resolveTable(root, segments, lineNumber);
      if (!resolved.ok) {
        return resolved;
      }
      currentTable = resolved.table;
      continue;
    }

    const equalsIndex = rawLine.indexOf("=");
    if (equalsIndex <= 0) {
      return {
        ok: false,
        error: {
          message: "Invalid TOML assignment; expected 'key = value'.",
          line: lineNumber,
        },
      };
    }

    const rawKey = rawLine.slice(0, equalsIndex).trim();
    const keySegments = rawKey.split(".").map((segment) => segment.trim());
    if (keySegments.length === 0 || keySegments.some((segment) => !segment)) {
      return {
        ok: false,
        error: {
          message: `Invalid TOML key "${rawKey}".`,
          line: lineNumber,
        },
      };
    }

    const rawValue = rawLine.slice(equalsIndex + 1).trim();

    if (rawValue.startsWith('"""') || rawValue.startsWith("'''")) {
      const delimiter: '"""' | "'''" = rawValue.startsWith('"""')
        ? '"""'
        : "'''";
      const startLine = lineNumber;
      const afterOpening = rawValue.slice(3);
      const inlineClose = findClosingTripleQuote(afterOpening, delimiter);

      let collected: string;
      let trailing: string;

      if (inlineClose !== -1) {
        collected = afterOpening.slice(0, inlineClose);
        trailing = afterOpening.slice(inlineClose + 3).trim();
      } else {
        const buffer: string[] = [];
        if (afterOpening.length > 0) {
          buffer.push(afterOpening);
        }
        let closed = false;
        trailing = "";

        while (index + 1 < lines.length) {
          index += 1;
          const nextLine = lines[index] ?? "";
          const closePos = findClosingTripleQuote(nextLine, delimiter);
          if (closePos !== -1) {
            buffer.push(nextLine.slice(0, closePos));
            trailing = nextLine.slice(closePos + 3).trim();
            closed = true;
            break;
          }
          buffer.push(nextLine);
        }

        if (!closed) {
          return {
            ok: false,
            error: {
              message: `Unterminated TOML multiline string (${delimiter}).`,
              line: startLine,
            },
          };
        }

        collected = buffer.join("\n");
      }

      if (trailing.length > 0 && !trailing.startsWith("#")) {
        return {
          ok: false,
          error: {
            message:
              "Unexpected trailing characters after TOML multiline string.",
            line: index + 1,
          },
        };
      }

      let finalString = collected;
      if (delimiter === '"""') {
        const unescaped = unescapeBasicString(collected, startLine);
        if (!unescaped.ok) {
          return unescaped;
        }
        finalString = unescaped.value;
      }

      const assignmentError = assignNestedKey(
        currentTable,
        keySegments,
        finalString,
        startLine,
      );
      if (assignmentError !== null) {
        return assignmentError;
      }
      continue;
    }

    if (
      rawValue.startsWith("[") &&
      !stripInlineComment(rawValue).endsWith("]")
    ) {
      const startLine = lineNumber;
      const parts: string[] = [stripInlineComment(rawValue)];
      let closed = false;

      while (index + 1 < lines.length) {
        index += 1;
        const nextChunk = stripInlineComment(lines[index] ?? "");
        if (nextChunk.length > 0) {
          parts.push(nextChunk);
        }
        if (nextChunk.endsWith("]")) {
          closed = true;
          break;
        }
      }

      if (!closed) {
        return {
          ok: false,
          error: {
            message: "Unterminated multiline TOML array.",
            line: startLine,
          },
        };
      }

      const parsedArray = parseInlineArray(parts.join(" "), startLine);
      if (!parsedArray.ok) {
        return parsedArray;
      }

      const assignmentError = assignNestedKey(
        currentTable,
        keySegments,
        parsedArray.value,
        startLine,
      );
      if (assignmentError !== null) {
        return assignmentError;
      }
      continue;
    }

    const parsedValue = parseSingleLineValue(rawValue, lineNumber);
    if (!parsedValue.ok) {
      return parsedValue;
    }

    const assignmentError = assignNestedKey(
      currentTable,
      keySegments,
      parsedValue.value,
      lineNumber,
    );
    if (assignmentError !== null) {
      return assignmentError;
    }
  }

  return { ok: true, data: root };
}
