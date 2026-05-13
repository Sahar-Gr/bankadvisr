// src/components/dashboard/consultante/ConsultanteDashboard.jsx
import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "../../ThemeToggle";
import {
  LayoutGrid,
  Users,
  FolderKanban,
  CalendarDays,
  LogOut,
  CalendarClock,
} from "lucide-react";

// Composant pour les tuiles de l'accueil
const Tile = ({ to, title, desc, icon }) => (
  <Link to={to} className="app-card block p-6">
    <div className="mb-3" style={{ color: "var(--brand)" }}>
      {icon}
    </div>
    <h3 className="mb-2 text-lg font-bold">{title}</h3>
    <div className="text-sm text-secondary">{desc}</div>
  </Link>
);

const navItems = [
  { to: "/consultante-dashboard", label: "Accueil" },
  { to: "/consultante-dashboard/clients", label: "Clients" },
  { to: "/consultante-dashboard/projets", label: "Projets" },
  { to: "/consultante-dashboard/planning", label: "Planning" },
  { to: "/consultante-dashboard/rdv", label: "Rendez-vous" },
];

export default function ConsultanteDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  // Vérifie si on est sur la page d'accueil de la consultante
  const isHome = location.pathname === "/consultante-dashboard" || location.pathname === "/consultante-dashboard/";

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  return (
    <div className="page-shell min-h-screen">
      {/* HEADER FAÇON ADMIN */}
      <header
        className="border-b"
        style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
      >
        <div className="page-container">
          <div className="flex min-h-[76px] items-center gap-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: "rgba(212, 175, 55, 0.10)",
                  border: "1px solid rgba(212, 175, 55, 0.20)",
                  color: "var(--brand)",
                }}
              >
                <LayoutGrid className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-bold">Espace Consultante</h1>
                <p className="text-sm text-muted">Gestion de vos dossiers et rendez-vous</p>
              </div>
            </div>

            {/* Navigation Desktop */}
            <nav className="ml-auto hidden items-center gap-2 lg:flex">
              {navItems.map((item) => {
                const active =
                  item.to === "/consultante-dashboard"
                    ? location.pathname === item.to
                    : location.pathname.startsWith(item.to);

                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="rounded-xl px-4 py-2 text-sm font-medium transition"
                    style={{
                      color: active ? "var(--text-primary)" : "var(--text-secondary)",
                      background: active ? "var(--bg-muted)" : "transparent",
                      border: active
                        ? "1px solid var(--border-strong)"
                        : "1px solid transparent",
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Actions (Thème + Déconnexion) */}
            <div className="ml-4 flex items-center gap-3">
              <ThemeToggle />

              <button
                type="button"
                onClick={handleLogout}
                className="app-btn app-btn-danger"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>

          {/* Navigation Mobile */}
          <div className="flex gap-2 overflow-x-auto pb-4 lg:hidden">
            {navItems.map((item) => {
              const active =
                item.to === "/consultante-dashboard"
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition"
                  style={{
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    background: active ? "var(--bg-muted)" : "transparent",
                    border: active
                      ? "1px solid var(--border-strong)"
                      : "1px solid transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="page-container py-8">
        {isHome ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 animate-fade-in">
            <Tile
              to="clients"
              title="Mes Clients"
              desc="Consulter les coordonnées et informations."
              icon={<Users className="h-6 w-6" />}
            />
            <Tile
              to="projets"
              title="Mes Projets"
              desc="Suivre l'avancement et les documents."
              icon={<FolderKanban className="h-6 w-6" />}
            />
            <Tile
              to="planning"
              title="Mon Planning"
              desc="Gérer mes disponibilités."
              icon={<CalendarDays className="h-6 w-6" />}
            />
            <Tile
              to="rdv"
              title="Rendez-vous"
              desc="Consulter mes réunions à venir."
              icon={<CalendarClock className="h-6 w-6" />}
            />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}