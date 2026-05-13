// src/services/userService.js
const API = "http://localhost:8080/api";

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

function base64UrlDecode(str) {
  try {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    // certains navigateurs exigent decodeURIComponent(escape(...)) pour l’UTF-8
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return {};
  }
}

export function decodeJwtPayload(token) {
  if (!token || token.split(".").length !== 3) return {};
  return base64UrlDecode(token.split(".")[1]);
}

export function getUidFromToken() {
  const t = localStorage.getItem("token") || "";
  const p = decodeJwtPayload(t);
  // ajuste selon ce que met ton backend dans le JWT
  return p.sub || p.uid || p.userId || p.user_id || "";
}

export function getNameFromJwt() {
  const t = localStorage.getItem("token") || "";
  const p = decodeJwtPayload(t);
  const fromPairs =
    (p.prenom && p.nom && `${p.prenom} ${p.nom}`.trim()) ||
    (p.given_name && p.family_name && `${p.given_name} ${p.family_name}`.trim());
  return (p.name || fromPairs || "").trim();
}

export function getCachedNameFor(uid) {
  if (!uid) return "";
  return localStorage.getItem(`client_display_name:${uid}`) || "";
}
export function cacheNameFor(uid, name) {
  if (!uid || !name) return;
  localStorage.setItem(`client_display_name:${uid}`, name);
}

export async function fetchClientProfile() {
  // 1) /client/profile (si dispo)
  try {
    const r = await fetch(`${API}/client/profile`, authHeaders());
    if (r.ok) return await r.json();
  } catch {}
  // 2) /users/{uid} (fallback)
  try {
    const uid = getUidFromToken();
    if (!uid) return null;
    const r2 = await fetch(`${API}/users/${uid}`, authHeaders());
    if (r2.ok) return await r2.json();
  } catch {}
  return null;
}

/** Retourne un objet { uid, name } fiable, en essayant plusieurs sources. */
export async function resolveClientIdentity() {
  const uid = getUidFromToken();

  // A) JWT direct
  const jwtName = getNameFromJwt();
  if (jwtName) {
    cacheNameFor(uid, jwtName);
    return { uid, name: jwtName };
  }

  // B) cache localStorage
  const cached = getCachedNameFor(uid);
  if (cached) return { uid, name: cached };

  // C) API profil
  const prof = await fetchClientProfile();
  if (prof) {
    const n =
      `${prof.prenom || ""} ${prof.nom || ""}`.trim() ||
      prof.name ||
      prof.displayName ||
      prof.email ||
      "";
    if (n) cacheNameFor(uid, n);
    return { uid, name: n };
  }

  return { uid, name: "" };
}

/** À appeler au logout pour éviter le “collage” du nom précédent */
export function clearClientNameCache() {
  const uid = getUidFromToken();
  if (uid) localStorage.removeItem(`client_display_name:${uid}`);
}
