// src/firebase/firebase.js

// Import the functions you need from the SDKs you need
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  // enableMultiTabIndexedDbPersistence,   // ⬅️ optionnel (voir plus bas)
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdjGVkMnAhbaTY2MLbUZrfkq_X7GBkCkU",
  authDomain: "plateforme-consulting.firebaseapp.com",
  projectId: "plateforme-consulting",
  storageBucket: "plateforme-consulting.appspot.com",
  messagingSenderId: "365462800363",
  appId: "1:365462800363:web:c74f7d0e806dac6713bbae",
};

// ✅ Singleton: réutilise l'app existante s'il y en a déjà une
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// ⚙️ Firestore robuste (dev/proxy/StrictMode)
// - experimentalForceLongPolling: évite les soucis de websockets derrière certains réseaux
// - useFetchStreams: false => contourne des problèmes avec fetch streaming sur certains navigateurs
let db;
try {
  db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
  });
} catch (e) {
  // Si Firestore a déjà été initialisé (hot reload), on récupère l'instance existante
  db = getFirestore(app);
}

// (OPTIONNEL) Persistance IndexedDB multi-onglets
// À activer si tu veux que les données restent dispo hors-ligne et se sync en arrière-plan.
// Attention: ne l'active que si tu n'as pas d’autre gestion de cache et que tu es OK avec les quotas.
// try {
//   await enableMultiTabIndexedDbPersistence(db);
// } catch (e) {
//   console.warn("IndexedDB persistence not enabled:", e?.message || e);
// }

// Auth & Storage (singletons)
export const auth = getAuth(app);
export const storage = getStorage(app);
export { db };

// Log utile en dev
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  console.log("[Firebase] projectId =", app.options.projectId);
  console.log("[Firebase] storageBucket =", app.options.storageBucket);
}
