import React from "react";
import { buildWhatsAppLink } from "../utils/whatsapp";

export default function WhatsAppButton({
  phone,
  message,
  onLog,
  label = "Contacter",
}) {
  const href = buildWhatsAppLink(phone, message);
  const disabled = !phone;

  const handleClick = async (e) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    try {
      if (onLog) await onLog();
    } catch (err) {
      console.error("Erreur log WhatsApp:", err);
    }
  };

  return (
    <a
      href={disabled ? "#" : href}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      aria-disabled={disabled}
      title={
        disabled
          ? "Numéro WhatsApp indisponible"
          : "Contacter le client via WhatsApp"
      }
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:-translate-y-[1px] hover:shadow-md"
      }`}
      style={{
        borderColor: "rgba(45, 164, 78, 0.35)",
        color: "var(--success)",
        background: disabled ? "transparent" : "rgba(45, 164, 78, 0.08)",
      }}
    >
      <span>💬</span>
      <span>{label}</span>
    </a>
  );
}