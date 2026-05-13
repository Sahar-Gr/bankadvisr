// Lightweight validation + normalization helpers


export function trimStr(v = "") {
return (v ?? "").toString().trim();
}


export function validateName(v) {
const s = trimStr(v);
return s.length >= 2; // simple: at least 2 chars
}


export function normalizeE164(input) {
if (!input) return "";
const s = input.replace(/\s+/g, ""); // remove spaces
return s;
}


export function validateE164(input) {
if (!input) return true; // optional field; treat empty as valid
const s = normalizeE164(input);
// Strict E.164: leading + then 7..15 digits
return /^\+\d{7,15}$/.test(s);
}


export function isDirtyClient(original, edited) {
if (!original || !edited) return false;
const nom0 = trimStr(original.nom);
const prenom0 = trimStr(original.prenom);
const wa0 = normalizeE164(original.numeroWhatsApp || "");
const active0 = !!original.active;


const nom1 = trimStr(edited.nom);
const prenom1 = trimStr(edited.prenom);
const wa1 = normalizeE164(edited.numeroWhatsApp || "");
const active1 = !!edited.active;


return nom0 !== nom1 || prenom0 !== prenom1 || wa0 !== wa1 || active0 !== active1;
}