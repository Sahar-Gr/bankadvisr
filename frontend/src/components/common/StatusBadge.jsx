import { normalizeStatus, STATUS_LABELS } from "../../utils/statuts";

const STATUS_STYLE = {
  NOUVEAU: {
    emoji: "🟢",
    cls: "bg-blue-600/15 text-blue-400 dark:text-blue-700",
  },
  DOCS_MANQUANTS: {
    emoji: "🟡",
    cls: "bg-yellow-600/15 text-yellow-400 dark:text-yellow-700",
  },
  EN_ANALYSE: {
    emoji: "🟠",
    cls: "bg-orange-600/15 text-orange-400 dark:text-orange-700",
  },
  DEPOSE_BANQUE: {
    emoji: "🔵",
    cls: "bg-sky-600/15 text-sky-400 dark:text-sky-700",
  },
  EN_ATTENTE: {
    emoji: "🟣",
    cls: "bg-purple-600/15 text-purple-400 dark:text-purple-700",
  },
  ACCEPTE: {
    emoji: "✅",
    cls: "bg-green-600/15 text-green-400 dark:text-green-700",
  },
  REFUSE: {
    emoji: "❌",
    cls: "bg-red-600/15 text-red-400 dark:text-red-700",
  },
  CLOTURE: {
    emoji: "⚫",
    cls: "bg-gray-600/15 text-gray-400 dark:text-gray-700",
  },
};

export default function StatusBadge({ value, className = "" }) {
  const status = normalizeStatus(value);
  const label = STATUS_LABELS[status] || status;
  const style = STATUS_STYLE[status] || STATUS_STYLE.NOUVEAU;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.cls} ${className}`}
    >
      <span aria-hidden>{style.emoji}</span>
      {label}
    </span>
  );
}
console.log("STATUSBADGE RENDERED", value);
