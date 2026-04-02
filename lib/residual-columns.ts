/**
 * Auto-detect data type from a sample of values.
 */
export function detectDataType(values: string[]): "currency" | "boolean" | "date" | "text" {
  const nonEmpty = values.filter(v => v != null && String(v).trim() !== "").map(v => String(v).trim());
  if (nonEmpty.length === 0) return "text";

  // Boolean: all values are true/false/yes/no/0/1
  const boolValues = new Set(["true", "false", "yes", "no", "0", "1", "y", "n"]);
  if (nonEmpty.every(v => boolValues.has(v.toLowerCase()))) return "boolean";

  // Currency / number: all values look like numbers (with optional $ , . - ())
  const currencyRe = /^[($\s-]*\d[\d,]*\.?\d*[)\s%]*$/;
  if (nonEmpty.every(v => currencyRe.test(v.replace(/[$]/g, "")))) {
    // If any value has $ or looks like money, it's currency
    if (nonEmpty.some(v => v.includes("$") || (parseFloat(v.replace(/[$,()]/g, "")) >= 1 && v.includes(".")))) return "currency";
    return "currency"; // default numeric to currency for residual context
  }

  // Date: common date patterns
  const dateRe = /^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}$|^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}$/;
  if (nonEmpty.every(v => dateRe.test(v))) return "date";

  return "text";
}

/**
 * Format a raw value for display based on its detected data type.
 */
export function formatColumnValue(value: string | null | undefined, dataType: string): string {
  if (value == null || String(value).trim() === "") return "\u2014";
  const v = String(value).trim();

  switch (dataType) {
    case "currency": {
      const cleaned = v.replace(/[$,]/g, "").replace(/[()]/g, m => m === "(" ? "-" : "");
      const num = parseFloat(cleaned);
      if (isNaN(num)) return v;
      return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    case "boolean": {
      const lower = v.toLowerCase();
      if (["true", "yes", "1", "y"].includes(lower)) return "Yes";
      if (["false", "no", "0", "n"].includes(lower)) return "No";
      return v;
    }
    case "date": {
      try {
        const d = new Date(v);
        return isNaN(d.getTime()) ? v : d.toLocaleDateString();
      } catch {
        return v;
      }
    }
    default:
      return v;
  }
}

/**
 * Convert a CSV column name to a human-readable display name.
 */
export function toDisplayName(csvColumnName: string): string {
  return csvColumnName
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → spaces
    .replace(/[_\-]+/g, " ")              // underscores/hyphens → spaces
    .replace(/\b\w/g, c => c.toUpperCase()) // capitalize words
    .trim();
}
