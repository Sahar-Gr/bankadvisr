import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const getInitialTheme = () => {
    const saved = localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  };

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const isDark = theme === "dark";

  return (
    <button
  type="button"
  onClick={() => setTheme(isDark ? "light" : "dark")}
  className="app-btn app-btn-ghost min-w-[96px] rounded-xl px-4 py-2 text-sm font-medium"
  aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
  title={isDark ? "Passer au thème clair" : "Passer au thème sombre"}
>
  <span>{isDark ? "☀️" : "🌙"}</span>
  <span>{isDark ? "Clair" : "Sombre"}</span>
</button>
  );
}