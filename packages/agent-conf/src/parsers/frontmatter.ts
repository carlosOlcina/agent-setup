import { normalizeLineEndings } from "./markdown.js";

export type FrontmatterScalar = string | boolean | number;
export type FrontmatterValue = FrontmatterScalar | readonly string[];

export interface FrontmatterParseError {
  readonly message: string;
  readonly line: number;
}

export interface FrontmatterParseSuccess {
  readonly ok: true;
  readonly data: Readonly<Record<string, FrontmatterValue>>;
  readonly body: string;
  readonly bodyStartLine: number;
}

export interface FrontmatterParseFailure {
  readonly ok: false;
  readonly error: FrontmatterParseError;
}

export type FrontmatterParseResult =
  FrontmatterParseSuccess | FrontmatterParseFailure;

function stripBom(content: string): string {
  return content.startsWith("\uFEFF") ? content.slice(1) : content;
}

function parseQuotedString(
  raw: string,
  quote: "'" | '"',
  lineNumber: number,
): { ok: true; value: string } | FrontmatterParseFailure {
  if (raw.length < 2 || !raw.endsWith(quote)) {
    return {
      ok: false,
      error: {
        message: `Unterminated ${quote === '"' ? "double" : "single"}-quoted YAML string.`,
        line: lineNumber,
      },
    };
  }

  const inner = raw.slice(1, -1);
  if (quote === "'") {
    return { ok: true, value: inner.replace(/''/g, "'") };
  }

  let result = "";
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char === "\\") {
      const next = inner[index + 1];
      if (next === undefined) {
        return {
          ok: false,
          error: {
            message: "Trailing escape backslash in YAML string.",
            line: lineNumber,
          },
        };
      }
      if (next === "n") {
        result += "\n";
      } else if (next === "t") {
        result += "\t";
      } else if (next === "r") {
        result += "\r";
      } else if (next === '"' || next === "\\") {
        result += next;
      } else {
        result += `\\${next}`;
      }
      index += 1;
    } else if (char === '"') {
      return {
        ok: false,
        error: {
          message: "Unescaped double quote inside YAML string.",
          line: lineNumber,
        },
      };
    } else {
      result += char ?? "";
    }
  }

  return { ok: true, value: result };
}

function parseInlineArray(
  raw: string,
  lineNumber: number,
): { ok: true; value: readonly string[] } | FrontmatterParseFailure {
  if (!raw.endsWith("]")) {
    return {
      ok: false,
      error: {
        message: "Unterminated inline YAML array.",
        line: lineNumber,
      },
    };
  }

  const inner = raw.slice(1, -1).trim();
  if (inner.length === 0) {
    return { ok: true, value: [] };
  }

  const items: string[] = [];
  for (const part of inner.split(",")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        error: {
          message: "Empty element in inline YAML array.",
          line: lineNumber,
        },
      };
    }
    if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
      const parsed = parseQuotedString(
        trimmed,
        trimmed[0] as '"' | "'",
        lineNumber,
      );
      if (!parsed.ok) {
        return parsed;
      }
      items.push(parsed.value);
    } else {
      items.push(trimmed);
    }
  }

  return { ok: true, value: items };
}

function parseScalarValue(
  raw: string,
  lineNumber: number,
): { ok: true; value: FrontmatterValue } | FrontmatterParseFailure {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"')) {
    return parseQuotedString(trimmed, '"', lineNumber);
  }
  if (trimmed.startsWith("'")) {
    return parseQuotedString(trimmed, "'", lineNumber);
  }
  if (trimmed.startsWith("[")) {
    return parseInlineArray(trimmed, lineNumber);
  }
  if (trimmed === "true") {
    return { ok: true, value: true };
  }
  if (trimmed === "false") {
    return { ok: true, value: false };
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return { ok: true, value: Number(trimmed) };
  }
  return { ok: true, value: trimmed };
}

export function parseYamlFrontmatter(content: string): FrontmatterParseResult {
  const normalized = normalizeLineEndings(stripBom(content));
  const lines = normalized.split("\n");

  if (lines[0]?.trim() !== "---") {
    return {
      ok: false,
      error: {
        message: "Missing opening YAML frontmatter delimiter '---'.",
        line: 1,
      },
    };
  }

  let closingLineIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === "---") {
      closingLineIndex = index;
      break;
    }
  }

  if (closingLineIndex === -1) {
    return {
      ok: false,
      error: {
        message: "Missing closing YAML frontmatter delimiter '---'.",
        line: 1,
      },
    };
  }

  const data: Record<string, FrontmatterValue> = {};
  let activeListKey: string | null = null;
  let activeList: string[] | null = null;

  for (let index = 1; index < closingLineIndex; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index] ?? "";

    if (rawLine.includes("\t")) {
      return {
        ok: false,
        error: {
          message: "Tabs are not permitted in YAML frontmatter indentation.",
          line: lineNumber,
        },
      };
    }

    const trimmed = rawLine.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const listMatch = /^\s+-\s+(.+)$/.exec(rawLine);
    if (listMatch !== null) {
      if (activeListKey === null || activeList === null) {
        return {
          ok: false,
          error: {
            message: "YAML list item found without a preceding list key.",
            line: lineNumber,
          },
        };
      }
      const rawItem = listMatch[1]?.trim() ?? "";
      const parsedItem = parseScalarValue(rawItem, lineNumber);
      if (!parsedItem.ok) {
        return parsedItem;
      }
      if (Array.isArray(parsedItem.value)) {
        return {
          ok: false,
          error: {
            message: "Nested arrays are not supported in agent frontmatter.",
            line: lineNumber,
          },
        };
      }
      activeList.push(String(parsedItem.value));
      continue;
    }

    activeListKey = null;
    activeList = null;

    if (/^\s+/.test(rawLine)) {
      return {
        ok: false,
        error: {
          message: "Unexpected indentation in YAML frontmatter.",
          line: lineNumber,
        },
      };
    }

    const colonIndex = rawLine.indexOf(":");
    if (colonIndex <= 0) {
      return {
        ok: false,
        error: {
          message: "Invalid YAML key-value syntax; expected 'key: value'.",
          line: lineNumber,
        },
      };
    }

    const key = rawLine.slice(0, colonIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) {
      return {
        ok: false,
        error: {
          message: `Invalid YAML key "${key}".`,
          line: lineNumber,
        },
      };
    }

    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return {
        ok: false,
        error: {
          message: `Duplicate YAML key "${key}".`,
          line: lineNumber,
        },
      };
    }

    const rawValue = rawLine.slice(colonIndex + 1).trim();
    if (rawValue.length === 0) {
      const items: string[] = [];
      data[key] = items;
      activeListKey = key;
      activeList = items;
      continue;
    }

    const parsedValue = parseScalarValue(rawValue, lineNumber);
    if (!parsedValue.ok) {
      return parsedValue;
    }
    data[key] = parsedValue.value;
  }

  const body = lines.slice(closingLineIndex + 1).join("\n");
  return {
    ok: true,
    data,
    body,
    bodyStartLine: closingLineIndex + 2,
  };
}
