import React from "react";
import { Navigate, Outlet } from "react-router-dom";

function isTokenValid() {
  const t = localStorage.getItem("token");
  if (!t) return false;
  try {
    const [, payload] = t.split(".");
    const { exp } = JSON.parse(atob(payload));
    return !exp || Date.now() < exp * 1000; // JWT exp (RFC 7519)
  } catch {
    return false;
  }
}

export default function ProtectedRoute() {
  return isTokenValid() ? <Outlet /> : <Navigate to="/login" replace />;
}
