import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar      from "./components/Navbar";

import Login       from "./pages/Login";
import Register    from "./pages/Register";
import Search      from "./pages/Search";
import MechanicProfile from "./pages/MechanicProfile";
import MyRequests  from "./pages/MyRequests";
import Vehicles    from "./pages/Vehicles";
import Dashboard   from "./pages/Dashboard";
import Inventory   from "./pages/Inventory";
import Jobs        from "./pages/Jobs";
import Admin       from "./pages/Admin";
import Warehouse   from "./pages/Warehouse";

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AuthRoute({ children }) {
  const { user } = useAuth();
  if (user) {
    if (user.role === "mechanic") return <Navigate to="/dashboard" replace />;
    if (user.role === "admin")    return <Navigate to="/admin" replace />;
    if (user.role === "warehouse") return <Navigate to="/warehouse" replace />;
    return <Navigate to="/search" replace />;
  }
  return children;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user)                    return <Navigate to="/login" replace />;
  if (user.role === "mechanic") return <Navigate to="/dashboard" replace />;
  if (user.role === "admin")    return <Navigate to="/admin" replace />;
  if (user.role === "warehouse") return <Navigate to="/warehouse" replace />;
  return <Navigate to="/search" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/login"       element={<AuthRoute><Login /></AuthRoute>} />
          <Route path="/register"    element={<AuthRoute><Register /></AuthRoute>} />
          <Route path="/search"      element={<Protected roles={["owner"]}><Search /></Protected>} />
          <Route path="/mechanics/:mechanicId" element={<Protected roles={["owner"]}><MechanicProfile /></Protected>} />
          <Route path="/my-requests" element={<Protected roles={["owner"]}><MyRequests /></Protected>} />
          <Route path="/vehicles"    element={<Protected roles={["owner"]}><Vehicles /></Protected>} />
          <Route path="/dashboard"   element={<Protected roles={["mechanic"]}><Dashboard /></Protected>} />
          <Route path="/inventory"   element={<Protected roles={["mechanic"]}><Inventory /></Protected>} />
          <Route path="/jobs"        element={<Protected roles={["mechanic"]}><Jobs /></Protected>} />
          <Route path="/admin"       element={<Protected roles={["admin"]}><Admin /></Protected>} />
          <Route path="/warehouse"   element={<Protected roles={["warehouse"]}><Warehouse /></Protected>} />
          <Route path="/"            element={<RootRedirect />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
