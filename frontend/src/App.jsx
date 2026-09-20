import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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

  return (
    <div className={`min-h-screen ${isPublicPage ? "wingman-public-shell" : "wingman-workspace-shell"}`}>
      {!isPublicPage && <Navbar />}
        <Routes>
          <Route path="/"            element={<Landing />} />
          <Route path="/login"       element={<AuthRoute><Login /></AuthRoute>} />
          <Route path="/register"    element={<AuthRoute><Register /></AuthRoute>} />
          <Route path="/search"      element={<Protected roles={["owner"]}><Navigate to="/explore" replace /></Protected>} />
          <Route path="/explore"     element={<Protected roles={["owner"]}><OwnerDirectory /></Protected>} />
          <Route path="/mechanics/:mechanicId" element={<Protected roles={["owner"]}><MechanicProfile /></Protected>} />
          <Route path="/my-requests" element={<Protected roles={["owner"]}><MyRequests /></Protected>} />
          <Route path="/vehicles"    element={<Protected roles={["owner"]}><Vehicles /></Protected>} />
          <Route path="/vehicles/:vehicleId/care" element={<Protected roles={["owner"]}><VehicleCare /></Protected>} />
          <Route path="/profile" element={<Protected roles={["owner", "mechanic", "warehouse"]}><WorkspaceProfile /></Protected>} />
          <Route path="/billing" element={<Protected roles={["owner", "mechanic"]}><Billing /></Protected>} />
          <Route path="/workspace" element={<Protected roles={["owner", "mechanic", "warehouse", "admin"]}><WorkspaceHome /></Protected>} />
          <Route path="/operations/mechanic" element={<Protected roles={["mechanic"]}><RoleWorkspace role="mechanic" /></Protected>} />
          <Route path="/operations/warehouse" element={<Protected roles={["warehouse"]}><RoleWorkspace role="warehouse" /></Protected>} />
          <Route path="/operations/admin" element={<Protected roles={["admin"]}><RoleWorkspace role="admin" /></Protected>} />
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
