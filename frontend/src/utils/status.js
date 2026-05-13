export const STATUS_LABELS = {
  NOUVEAU: "Nouveau",
  DOCS_MANQUANTS: "Docs manquants",
  EN_ANALYSE: "En analyse",
  DEPOSE_BANQUE: "Déposé banque",
  EN_ATTENTE: "En attente",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
  CLOTURE: "Clôturé",
};

export function normalizeStatus(raw) {
  if (!raw) return "NOUVEAU";

  // Legacy DB values
  const legacyMap = {
    en_cours: "EN_ANALYSE",
    "en_cours": "EN_ANALYSE",
  };

  const cleaned = String(raw).trim();
  return legacyMap[cleaned] || cleaned.toUpperCase();
}
