// src/services/authUid.js
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";


let cached = { uid: null, loaded: false };

// Essaie de résoudre l’UID consultante depuis Firestore (même logique que l’admin).
async function fetchConsultanteUid(authUid) {
  try {
    const snap = await getDoc(doc(db, "users", authUid));
    if (snap.exists()) {
      const data = snap.data();
      // si tu stockes un mapping (ex: consultanteUid) on le prend, sinon on garde auth.uid
      return data.consultanteUid || data.uid || authUid;
    }
  } catch (e) {
    console.warn("fetchConsultanteUid error:", e);
  }
  return authUid;
}

/**
 * Retourne l’UID consultante (promesse).
 * - se met à jour quand l’état Auth change
 * - lit Firestore une seule fois et met en cache
 */
export function getConsultanteUid() {
  if (cached.loaded && cached.uid) return Promise.resolve(cached.uid);

  return new Promise((resolve) => {
    // si Auth déjà prêt
    if (auth.currentUser) {
      fetchConsultanteUid(auth.currentUser.uid).then((uid) => {
        cached = { uid, loaded: true };
        resolve(uid);
      });
      return;
    }

    // sinon on écoute le premier état
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const uid = await fetchConsultanteUid(user.uid);
        cached = { uid, loaded: true };
        resolve(uid);
      } else {
        cached = { uid: null, loaded: true };
        resolve(null);
      }
      unsub();
    });
  });
}
