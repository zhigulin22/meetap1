const DEFAULT_BOOTSTRAP_PHONES = ["89606001071"];

function normalizePhone(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}

export function isBootstrapAdminPhone(phone: string | null | undefined) {
  const envList = String(process.env.ADMIN_BOOTSTRAP_PHONES ?? "")
    .split(",")
    .map((x) => normalizePhone(x))
    .filter(Boolean);

  const allowed = new Set<string>([...DEFAULT_BOOTSTRAP_PHONES.map(normalizePhone), ...envList]);
  const current = normalizePhone(phone);
  return Boolean(current) && allowed.has(current);
}
