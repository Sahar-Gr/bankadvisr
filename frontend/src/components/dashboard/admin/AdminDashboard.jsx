import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "../../ThemeToggle";
import {
  LayoutGrid,
  Users,
  FolderKanban,
  CalendarDays,
  LogOut,
  BriefcaseBusiness,
  CalendarClock,
} from "lucide-react";

const Tile = ({ to, title, desc, icon }) => (
  <Link to={to} className="app-card block p-6">
    <div className="mb-3" style={{ color: "var(--brand)" }}>
      {icon}
    </div>
    <h3 className="mb-2">{title}</h3>
    <div className="text-sm text-secondary">{desc}</div>
  </Link>
);

const KpiCard = ({ label, value, icon }) => (
  <div className="app-card p-5">
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-muted">{label}</p>
      <div style={{ color: "var(--brand)" }}>{icon}</div>
    </div>
    <h2 className="text-2xl font-bold">{value}</h2>
  </div>
);

const navItems = [
  { to: "/admin-dashboard", label: "Accueil" },
  { to: "/admin-dashboard/clients", label: "Clients" },
  { to: "/admin-dashboard/projects", label: "Projets" },
  { to: "/admin-dashboard/planning", label: "Planning" },
  { to: "/admin-dashboard/appointments", label: "Rendez-vous" },
];

const AdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/admin-dashboard";

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  return (
    <div className="page-shell min-h-screen">
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
                <h1 className="text-2xl font-bold">Tableau de bord Admin</h1>
                <p className="text-sm text-muted">Pilotage global de la plateforme</p>
              </div>
            </div>

            <nav className="ml-auto hidden items-center gap-2 lg:flex">
              {navItems.map((item) => {
                const active =
                  item.to === "/admin-dashboard"
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

            <div className="ml-4 flex items-center gap-3">
              <ThemeToggle />

              <button
                type="button"
                onClick={handleLogout}
                className="app-btn app-btn-danger"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 lg:hidden">
            {navItems.map((item) => {
              const active =
                item.to === "/admin-dashboard"
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

      <main className="page-container py-8">
        {isHome ? (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <KpiCard
                label="Clients"
                value="24"
                icon={<Users className="h-5 w-5" />}
              />
              <KpiCard
                label="Projets actifs"
                value="8"
                icon={<BriefcaseBusiness className="h-5 w-5" />}
              />
              <KpiCard
                label="RDV cette semaine"
                value="5"
                icon={<CalendarClock className="h-5 w-5" />}
              />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Tile
                to="clients"
                title="Liste des clients"
                desc="Créer, modifier, activer ou désactiver les comptes."
                icon={<Users className="h-6 w-6" />}
              />
              <Tile
                to="projects"
                title="Projets"
                desc="Créer un projet et suivre son avancement."
                icon={<FolderKanban className="h-6 w-6" />}
              />
              <Tile
                to="planning"
                title="Planning"
                desc="Gérer les créneaux des consultantes."
                icon={<CalendarDays className="h-6 w-6" />}
              />
              <Tile
                to="appointments"
                title="Rendez-vous"
                desc="Consulter et suivre les rendez-vous."
                icon={<CalendarDays className="h-6 w-6" />}
              />
            </div>
          </>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;