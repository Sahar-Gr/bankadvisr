import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../../ThemeToggle";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { useToast } from "../../ui/Toast";

import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase/firebase";
import {
  BriefcaseBusiness,
  Folder,
  Users,
  FileText,
  CalendarDays,
} from "lucide-react";

const API = "http://localhost:8080";

const features = [
  {
    icon: <Folder className="h-6 w-6" style={{ color: "var(--brand)" }} />,
    title: "Gestion des projets",
    text: "Suivi structuré des dossiers et de leur progression.",
  },
  {
    icon: <Users className="h-6 w-6" style={{ color: "var(--brand)" }} />,
    title: "Clients centralisés",
    text: "Vue claire des profils, états et interactions.",
  },
  {
    icon: <FileText className="h-6 w-6" style={{ color: "var(--brand)" }} />,
    title: "Documents organisés",
    text: "Séparation nette entre dépôts client et consultante.",
  },
  {
    icon: <CalendarDays className="h-6 w-6" style={{ color: "var(--brand)" }} />,
    title: "Rendez-vous",
    text: "Réservation et suivi des échanges à venir.",
  },
];

export default function Login() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      // 1. Auth Firebase
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // 2. Auth Backend Java
      const r = await axios.post(`${API}/auth/login`, { email, password });
      const token = r.data.message;
      const decoded = jwtDecode(token);
      
      // Normalisation du rôle en minuscules pour les tests IF
      const role = (decoded.role || "").toLowerCase();

      localStorage.setItem("token", token);
      localStorage.setItem("uid", uid);
      localStorage.setItem("role", role);

      // 3. Récupération optionnelle du nom d'affichage
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const u = snap.data() || {};
          const cached = `${u.prenom || ""} ${u.nom || ""}`.trim() || u.email || uid;
          localStorage.setItem(`client_display_name:${uid}`, cached);
        }
      } catch (fError) {
        console.warn("Firestore data sync skip", fError);
      }

      toast.success("Connexion réussie !");

      // Redirection dynamique selon le rôle exact
      if (role === "admin") navigate("/admin-dashboard");
      else if (role === "client") navigate("/client-dashboard");
      else if (role === "consultante") navigate("/consultante-dashboard");
      else {
        setErrorMsg("Rôle inconnu. Veuillez contacter le support.");
      }

    } catch (err) {
      setErrorMsg("Email ou mot de passe incorrect.");
      console.error(err);
    }
  };

  return (
    <div className="page-shell min-h-screen">
      <div className="page-container py-6">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>

        <div className="min-h-[calc(100vh-88px)] grid grid-cols-1 lg:grid-cols-2 items-start gap-10 lg:gap-16 pt-10 lg:pt-16">
          <div className="hidden lg:block">
            <div className="max-w-xl">
              <div
                className="mb-6 inline-flex items-center gap-3 rounded-full px-4 py-2"
                style={{
                  background: "rgba(212, 175, 55, 0.10)",
                  border: "1px solid rgba(212, 175, 55, 0.20)",
                  color: "var(--brand)",
                }}
              >
                <BriefcaseBusiness className="h-4 w-4" style={{ color: "var(--brand)" }} />
                <span className="text-sm font-semibold">Plateforme de consulting bancaire</span>
              </div>

              <h1 className="mb-5 text-5xl font-bold leading-tight tracking-tight text-text-primary">
                Gérez vos clients, projets et documents dans un espace unique.
              </h1>

              <p className="mb-8 text-lg leading-8 text-text-secondary">
                BankAdvisr centralise le suivi client, l’avancement des projets,
                les échanges documentaires et les rendez-vous dans une interface
                claire, structurée et professionnelle.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {features.map((item) => (
                  <div key={item.title} className="app-card p-5" style={{ background: "var(--feature-card-bg)", borderColor: "var(--border-soft)" }}>
                    <div className="mb-3">{item.icon}</div>
                    <h3 className="card-title mb-2">{item.title}</h3>
                    <p className="text-sm text-secondary leading-6">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="app-card w-full max-w-md p-8 sm:p-10">
              <div className="mb-8 text-center">
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(212, 175, 55, 0.12)", border: "1px solid rgba(212, 175, 55, 0.22)" }}
                >
                  <BriefcaseBusiness className="h-7 w-7" style={{ color: "var(--brand)" }} />
                </div>
                <h2 className="mb-2 text-4xl font-bold tracking-tight text-brand">BankAdvisr</h2>
                <h3 className="text-2xl font-semibold text-text-primary">Connexion</h3>
                <p className="mt-2 text-sm text-muted">Accédez à votre espace sécurisé.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-text-secondary">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="app-input"
                    placeholder="nom@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-medium text-text-secondary">Mot de passe</label>
                  <input
                    id="password"
                    type="password"
                    className="app-input"
                    placeholder="Votre mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="app-btn app-btn-primary w-full py-3 font-bold">Se connecter</button>

                {errorMsg && (
                  <p className="text-center text-sm font-medium text-danger">{errorMsg}</p>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}