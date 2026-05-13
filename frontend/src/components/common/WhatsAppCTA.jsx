import React, { useMemo } from "react";
import { normalizeE164 } from "../../utils/phone";

function buildWaLink(phoneE164, text = "") {
  const p = phoneE164.replace(/\+/g, "");
  const q = text ? `&text=${encodeURIComponent(text)}` : "";
  return `https://api.whatsapp.com/send?phone=${p}${q}`;
}

export default function WhatsAppCTA({ phone, text = "", className = "", size = "md" }) {
  const normalized = useMemo(() => normalizeE164(phone), [phone]);
  const disabled = !normalized;

  const btnCls = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm md:text-base";
  const style =
    "inline-flex items-center gap-2 rounded-xl border border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-green-500/40 disabled:opacity-50 disabled:cursor-not-allowed";

  const onClick = (e) => {
    if (disabled) {
      e.preventDefault();
      alert("Numéro WhatsApp invalide ou manquant.");
    }
  };

  const href = disabled ? "#" : buildWaLink(normalized, text);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className={`${style} ${btnCls} ${className}`}
      title={disabled ? "Numéro WhatsApp manquant" : `Contacter via WhatsApp (${normalized})`}
    >
      <span role="img" aria-label="whatsapp">💬</span>
      <span>WhatsApp</span>
    </a>
  );
}
