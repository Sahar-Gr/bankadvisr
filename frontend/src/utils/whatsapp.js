// Construit le lien WhatsApp avec numéro + message
export function buildWhatsAppLink(phone, message) {
  const cleaned = String(phone || "").replace(/\D/g, ""); // supprime espaces/signes
  const text = encodeURIComponent(message || "");
  return cleaned ? `https://wa.me/${cleaned}?text=${text}` : "#";
}

// Message par défaut : consultante -> client
export const msgConsultanteToClient = ({ consultanteName, projectTitle, projectId }) =>
  `Bonjour, ici ${consultanteName}. À propos de: ${projectTitle} (ID: ${projectId}). Disponible pour un point ?`;

// Message par défaut : client -> consultante
export const msgClientToConsultante = ({ clientName, projectTitle, projectId }) =>
  `Bonjour, je suis ${clientName}. Sujet: ${projectTitle} (ID: ${projectId}). Pourrions-nous échanger ?`;
