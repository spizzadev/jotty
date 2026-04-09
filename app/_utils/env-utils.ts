export function isEnvEnabled(value: string | boolean | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;

  if (!value) return false;

  const lower = value.trim().toLowerCase();
  return lower !== "no" && lower !== "false" && lower !== "0";
}

// @deprecated SSO_MODE is deprecated, use AUTH_MODE instead
const _getAuthMode = (): string | undefined =>
  process.env.AUTH_MODE || process.env.SSO_MODE;

export { _getAuthMode as getAuthMode };

export function isDebugFlag(flag: string): boolean {
  const v = process.env.DEBUGGER;
  if (!v || typeof v !== "string") return false;
  const trimmed = v.trim();

  if (trimmed === "*") return true;

  const parts = trimmed.split(",").map((s) => s.trim().toLowerCase());
  return parts.includes(flag.toLowerCase());
}
