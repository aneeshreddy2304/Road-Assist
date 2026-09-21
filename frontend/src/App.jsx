import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar      from "./components/Navbar";

import Login       from "./pages/Login";
import Register    from "./pages/Register";
import MechanicProfile from "./pages/MechanicProfile";
import MyRequests  from "./pages/MyRequests";
import Vehicles    from "./pages/Vehicles";
import VehicleCare from "./pages/VehicleCare";
import OwnerDirectory from "./pages/OwnerDirectory";
import Dashboard   from "./pages/Dashboard";
import Inventory   from "./pages/Inventory";
import Jobs        from "./pages/Jobs";
import Admin       from "./pages/Admin";
import Warehouse   from "./pages/Warehouse";
import Landing     from "./pages/Landing";
import WorkspaceProfile from "./pages/WorkspaceProfile";
import Billing from "./pages/Billing";
import WorkspaceHome from "./pages/WorkspaceHome";
import RoleWorkspace from "./pages/RoleWorkspace";
import WingmanWorkspace from "./wingman/WingmanWorkspace";

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AuthRoute({ children }) {
  const { user } = useAuth();
  if (user) {
    return <Navigate to="/workspace" replace />;
  }
  return children;
}

function WorkspaceRouter() {
  const { user, logout } = useAuth();
  return <WingmanWorkspace role={user?.role || "owner"} userName={user?.name} onLogout={logout} />;
}

function WingmanRoute({ initialTab }) {
  const { user, logout } = useAuth();
  return <WingmanWorkspace role={user?.role || "owner"} initialTab={initialTab} userName={user?.name} onLogout={logout} />;
}

function DemoWingmanRoute() {
  const { role = "owner" } = useParams();
  const demoRole = ["owner", "mechanic", "warehouse", "admin"].includes(role) ? role : "owner";
  return <WingmanWorkspace role={demoRole} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const pathname = useLocation().pathname;
  const isPublicPage = pathname === "/" || pathname === "/login" || pathname === "/register";
  const usesWingmanWorkspace = !isPublicPage;

  return (
    <div className={`min-h-screen ${isPublicPage ? "wingman-public-shell" : "wingman-workspace-shell"}`}>
      {!isPublicPage && !usesWingmanWorkspace && <Navbar />}
        <Routes>
          <Route path="/"            element={<Landing />} />
          <Route path="/login"       element={<Login />} />
          <Route path="/register"    element={<AuthRoute><Register /></AuthRoute>} />
          <Route path="/search"      element={<Protected roles={["owner"]}><Navigate to="/explore" replace /></Protected>} />
          <Route path="/demo/:role"  element={<DemoWingmanRoute />} />
          <Route path="/explore"     element={<Protected roles={["owner"]}><WingmanRoute initialTab="Find help" /></Protected>} />
          <Route path="/mechanics/:mechanicId" element={<Protected roles={["owner"]}><WingmanRoute initialTab="Find help" /></Protected>} />
          <Route path="/my-requests" element={<Protected roles={["owner"]}><WingmanRoute initialTab="My requests" /></Protected>} />
          <Route path="/vehicles"    element={<Protected roles={["owner"]}><WingmanRoute initialTab="My garage" /></Protected>} />
          <Route path="/vehicles/:vehicleId/care" element={<Protected roles={["owner"]}><WingmanRoute initialTab="Vehicle Care" /></Protected>} />
          <Route path="/profile" element={<Protected roles={["owner", "mechanic", "warehouse"]}><WingmanRoute initialTab="Profile" /></Protected>} />
          <Route path="/billing" element={<Protected roles={["owner", "mechanic"]}><WingmanRoute initialTab={undefined} /></Protected>} />
          <Route path="/workspace" element={<Protected roles={["owner", "mechanic", "warehouse", "admin"]}><WorkspaceRouter /></Protected>} />
          <Route path="/operations/mechanic" element={<Protected roles={["mechanic"]}><WingmanRoute /></Protected>} />
          <Route path="/operations/warehouse" element={<Protected roles={["warehouse"]}><WingmanRoute /></Protected>} />
          <Route path="/operations/admin" element={<Protected roles={["admin"]}><WingmanRoute /></Protected>} />
          <Route path="/dashboard"   element={<Protected roles={["mechanic"]}><Navigate to="/operations/mechanic" replace /></Protected>} />
          <Route path="/inventory"   element={<Protected roles={["mechanic"]}><Navigate to="/operations/mechanic?tab=inventory" replace /></Protected>} />
          <Route path="/jobs"        element={<Protected roles={["mechanic"]}><Navigate to="/operations/mechanic?tab=jobs" replace /></Protected>} />
          <Route path="/admin"       element={<Protected roles={["admin"]}><Navigate to="/operations/admin" replace /></Protected>} />
          <Route path="/warehouse"   element={<Protected roles={["warehouse"]}><Navigate to="/operations/warehouse" replace /></Protected>} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
    </div>
  );
}
