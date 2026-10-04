import type { ErrorCode, Scalar, TransformStep, ValueType } from "./types";
export class TransformError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}
export const CATALOG: Record<
  string,
  {
    input: ValueType | "any" | "array" | "none";
    output: ValueType | "same" | "value";
    description: string;
  }
> = {
  trim: {
    input: "string",
    output: "string",
    description: "Trim and collapse whitespace",
  },
  lowercase: {
    input: "string",
    output: "string",
    description: "Normalize casing",
  },
  uppercase: {
    input: "string",
    output: "string",
    description: "Normalize casing",
  },
  null_if_empty: {
    input: "string",
    output: "string",
    description: "Treat empty values as null",
  },
  split_name: {
    input: "string",
    output: "string",
    description: "Split First Last or Last, First",
  },
  strip_prefix: {
    input: "string",
    output: "string",
    description: "Remove an explicit prefix",
  },
  to_integer: {
    input: "string",
    output: "integer",
    description: "Parse a safe base-10 integer",
  },
  parse_date: {
    input: "string",
    output: "date",
    description: "Parse explicit date formats in priority order",
  },
  date_to_timestamp: {
    input: "date",
    output: "timestamp",
    description: "Convert date to UTC midnight",
  },
  map_values: {
    input: "string",
    output: "string",
    description: "Map using an explicit dictionary",
  },
  country_to_iso2: {
    input: "string",
    output: "string",
    description: "Convert supported country aliases",
  },
  currency_to_cents: {
    input: "string",
    output: "integer",
    description: "Parse currency using integer arithmetic",
  },
  phone_to_e164: {
    input: "string",
    output: "string",
    description: "Normalize a supported phone format",
  },
  yes_no_to_boolean: {
    input: "string",
    output: "boolean",
    description: "Convert Y/N, yes/no, true/false, 1/0",
  },
  default_if_null: {
    input: "any",
    output: "value",
    description: "Provide a default for null values",
  },
  constant: {
    input: "none",
    output: "value",
    description: "Set an explicit constant",
  },
  concat: {
    input: "array",
    output: "string",
    description: "Join multiple source fields",
  },
};
const COUNTRIES: Record<string, string> = {
  india: "IN",
  in: "IN",
  usa: "US",
  us: "US",
  "u.s.": "US",
  "united states": "US",
  "united states of america": "US",
  uk: "GB",
  gb: "GB",
  "united kingdom": "GB",
  deutschland: "DE",
  germany: "DE",
  de: "DE",
  france: "FR",
  fr: "FR",
  canada: "CA",
  ca: "CA",
  australia: "AU",
  au: "AU",
  japan: "JP",
  jp: "JP",
  china: "CN",
  cn: "CN",
  brazil: "BR",
  br: "BR",
  singapore: "SG",
  sg: "SG",
  spain: "ES",
  es: "ES",
  italy: "IT",
  it: "IT",
  netherlands: "NL",
  nl: "NL",
  "new zealand": "NZ",
  nz: "NZ",
  "south africa": "ZA",
  za: "ZA",
};
export function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return (
    d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!
  );
}
function parseDate(value: string, formats: string[]): string {
  for (const format of formats) {
    let result = "";
    if (format === "YYYY-MM-DD") result = value;
    else if (format === "DD Mon YYYY") {
      const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(value);
      if (match) {
        const month =
          [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
          ].indexOf(match[2]!.toLowerCase()) + 1;
        result = `${match[3]}-${String(month).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
      }
    } else {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
      if (match) {
        const [month, day] =
          format === "MM/DD/YYYY"
            ? [match[1]!, match[2]!]
            : [match[2]!, match[1]!];
        result = `${match[3]}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }
    if (validDate(result)) return result;
  }
  throw new TransformError(
    "PARSE_DATE_FAILED",
    `Cannot parse date using ${formats.join(", ")}`,
  );
}
export function applyStep(
  step: TransformStep,
  value: Scalar | Scalar[],
): Scalar {
  if (step.op === "constant") return step.value;
  if (step.op === "default_if_null")
    return value === null ? step.value : (value as Scalar);
  if (step.op === "concat") {
    if (!Array.isArray(value))
      throw new TransformError(
        "TYPE_MISMATCH",
        "concat requires multiple source values",
      );
    if (value.some((v) => v !== null && typeof v !== "string"))
      throw new TransformError("TYPE_MISMATCH", "concat requires strings");
    return value.filter((v) => v !== null).join(step.separator);
  }
  if (value === null) return null;
  if (typeof value !== "string")
    throw new TransformError("TYPE_MISMATCH", `${step.op} requires a string`);
  switch (step.op) {
    case "trim":
      return value.trim().replace(/\s+/g, " ");
    case "lowercase":
      return value.toLowerCase();
    case "uppercase":
      return value.toUpperCase();
    case "null_if_empty":
      return value.trim() === "" ? null : value;
    case "split_name": {
      const name = value.trim().replace(/\s+/g, " ");
      if (!name) return null;
      if (name.includes(",")) {
        const [last, ...first] = name.split(",");
        return (
          (step.part === "first" ? first.join(",").trim() : last!.trim()) ||
          null
        );
      }
      const [first, ...last] = name.split(" ");
      return step.part === "first" ? first! : last.join(" ") || null;
    }
    case "strip_prefix":
      if (!value.startsWith(step.prefix))
        throw new TransformError(
          "INVALID_FORMAT",
          "Expected prefix is missing",
        );
      return value.slice(step.prefix.length);
    case "to_integer": {
      if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
        throw new TransformError(
          "PARSE_NUMBER_FAILED",
          "Expected a safe base-10 integer",
        );
      return Number(value);
    }
    case "parse_date":
      return parseDate(value.trim(), step.formats);
    case "date_to_timestamp":
      if (!validDate(value))
        throw new TransformError("PARSE_DATE_FAILED", "Expected an ISO date");
      return `${value}T00:00:00.000Z`;
    case "map_values": {
      const entry = Object.entries(step.mapping).find(([key]) =>
        step.caseInsensitive
          ? key.toLowerCase() === value.toLowerCase()
          : key === value,
      );
      if (entry) return entry[1];
      if (step.fallback === "null") return null;
      if (step.fallback === "keep") return value;
      throw new TransformError(
        "UNKNOWN_VALUE",
        "Value has no supported mapping",
      );
    }
    case "country_to_iso2": {
      const alias = value.trim().toLowerCase();
      const country = Object.hasOwn(COUNTRIES, alias)
        ? COUNTRIES[alias]
        : undefined;
      if (!country)
        throw new TransformError("UNKNOWN_VALUE", "Unsupported country alias");
      return country;
    }
    case "currency_to_cents": {
      const text = value.trim().replace(/^[$£€₹]/, "");
      if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text))
        throw new TransformError(
          "PARSE_NUMBER_FAILED",
          "Expected currency with at most two decimal places",
        );
      const negative = text.startsWith("-");
      const [whole, fraction = ""] = text.replace(/[-,]/g, "").split(".");
      const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
      if (cents > 2147483647n)
        throw new TransformError(
          "OUT_OF_RANGE",
          "Amount exceeds target integer range",
        );
      return Number(negative ? -cents : cents);
    }
    case "phone_to_e164": {
      const phone = value.trim();
      if (!/^[+\d() .-]+$/.test(phone))
        throw new TransformError(
          "INVALID_FORMAT",
          "Phone contains unsupported characters",
        );
      const digits = phone.replace(/\D/g, "");
      if (phone.startsWith("+") && /^\+[1-9]\d{7,14}$/.test(`+${digits}`))
        return `+${digits}`;
      const dial = { US: "1", IN: "91", GB: "44", DE: "49" }[
        step.defaultCountry
      ];
      const local =
        step.defaultCountry === "GB" || step.defaultCountry === "DE"
          ? digits.replace(/^0/, "")
          : digits;
      if (local.length === 10) return `+${dial}${local}`;
      if (
        step.defaultCountry === "US" &&
        digits.length === 11 &&
        digits.startsWith("1")
      )
        return `+${digits}`;
      throw new TransformError(
        "INVALID_FORMAT",
        "Cannot normalize this local phone number",
      );
    }
    case "yes_no_to_boolean":
      if (/^(y|yes|true|1)$/i.test(value)) return true;
      if (/^(n|no|false|0)$/i.test(value)) return false;
      throw new TransformError("UNKNOWN_VALUE", "Expected yes/no vocabulary");
    default:
      throw new TransformError("UNKNOWN_VALUE", "Unsupported transformation");
  }
}
