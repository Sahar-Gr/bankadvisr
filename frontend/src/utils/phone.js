// src/utils/phone.js
export function normalizeE164(raw = "") {
  if (!raw) return "";
  let s = String(raw).trim().replace(/\s+/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  s = s.replace(/[^\d+]/g, "");
  if (!s.startsWith("+")) return "";
  const digits = s.replace(/\D/g, "");
  if (digits.length < 8) return "";
  return s;
}

export function onlyDigitsPhone(raw = "") {
  return String(raw || "").replace(/\D+/g, "");
}
