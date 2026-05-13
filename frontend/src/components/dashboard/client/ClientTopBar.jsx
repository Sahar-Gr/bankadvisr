import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, FolderKanban, CalendarClock, LogOut } from "lucide-react";
import ThemeToggle from "../../ThemeToggle";

export default function ClientTopBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    // Vide le localStorage et redirige
    localStorage.clear();
    navigate("/login", { replace: true });
    // On force un rafraîchissement complet pour réinitialiser les états globaux
    window.location.reload();
  };

  const navItems = [
    { to: "/client-dashboard", label: "Accueil", icon: <LayoutGrid size={18} /> },
    { to: "/client-dashboard/projets", label: "Projets", icon: <FolderKanban size={18} /> },
    { to: "/client-dashboard/rdv", label: "Rendez-vous", icon: <CalendarClock size={18} /> },
  ];

  return (
    <header className="border-b border-border-soft bg-bg-page/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-brand text-xl">
          BankAdvisr
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to || (item.to !== "/client-dashboard" && location.pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    active 
                      ? "bg-brand/10 text-brand border border-brand/20" 
                      : "text-text-secondary hover:bg-bg-muted hover:text-text-primary"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="h-6 w-[1px] bg-border-soft hidden md:block" />

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button 
              onClick={handleLogout} 
              className="p-2 text-text-secondary hover:text-danger hover:bg-danger/5 rounded-lg transition-all"
              title="Déconnexion"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}