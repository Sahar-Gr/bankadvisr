import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";

// Dashboards
import AdminDashboard from "./components/dashboard/admin/AdminDashboard";
import ConsultanteDashboard from "./components/dashboard/consultante/ConsultanteDashboard";
import ClientDashboard from "./components/dashboard/client/ClientDashboard";

// Admin pages
import ClientList from "./components/dashboard/admin/ClientList";
import ProjectList from "./components/dashboard/admin/ProjectList";
import ProjectDetails from "./components/dashboard/admin/ProjectDetails";
import PlanningManager from "./components/dashboard/admin/PlanningManager";
import AppointmentManager from "./components/dashboard/admin/AppointmentManager";

// Consultante pages
import ClientListConsultante from "./components/dashboard/consultante/ClientLists";
import ProjectsList from "./components/dashboard/consultante/ProjectsList";
import ProjectDetailsConsultante from "./components/dashboard/consultante/ProjectDetailsConsultante";
import Appointments from "./components/dashboard/consultante/Appointments";
import Planning from "./components/dashboard/consultante/Planning";

// Client pages
import ProjectListClient from "./components/dashboard/client/ProjectListClient";
import ProjectDetailsClient from "./components/dashboard/client/ProjectDetailsClient";
import ClientAppointment from "./components/dashboard/client/ClientAppointment";

// Auth
import Login from "./components/auth/login";

// Toast provider
import { ToastProvider } from "./components/ui/Toast";

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            {/* ADMIN */}
            <Route path="/admin-dashboard" element={<AdminDashboard />}>
              <Route path="clients" element={<ClientList />} />
              <Route path="projects" element={<ProjectList />} />
              <Route path="projects/:id" element={<ProjectDetails />} />
              <Route path="planning" element={<PlanningManager />} />
              <Route path="appointments" element={<AppointmentManager />} />
            </Route>

            {/* CONSULTANTE */}
            <Route path="/consultante-dashboard" element={<ConsultanteDashboard />}>
              <Route path="clients" element={<ClientListConsultante />} />
              <Route path="projets" element={<ProjectsList />} />
              <Route path="projets/:id" element={<ProjectDetailsConsultante />} />
              <Route path="rdv" element={<Appointments />} />
              <Route path="planning" element={<Planning />} />
            </Route>

            {/* CLIENT */}
            <Route path="/client-dashboard" element={<ClientDashboard />} />
            <Route path="/client-dashboard/projets" element={<ProjectListClient />} />
            <Route path="/client-dashboard/projets/:id" element={<ProjectDetailsClient />} />
            <Route path="/client-dashboard/rdv" element={<ClientAppointment />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}