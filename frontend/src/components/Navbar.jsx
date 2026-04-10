import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Wrench, LogOut, User, LayoutDashboard, Search } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-brand-600 text-lg">
          <Wrench size={20} />
          RoadAssist
        </Link>

        {/* Nav links */}
        {user && (
          <div className="flex items-center gap-1">
            {user.role === "owner" && (
              <>
                <NavLink to="/search" icon={<Search size={15} />} label="Find Mechanic" />
                <NavLink to="/my-requests" icon={<LayoutDashboard size={15} />} label="My Jobs" />
              </>
            )}
            {user.role === "mechanic" && (
              <>
                <NavLink to="/dashboard" icon={<LayoutDashboard size={15} />} label="Dashboard" />
                <NavLink to="/inventory" icon={<Wrench size={15} />} label="Inventory" />
                <NavLink to="/jobs" icon={<Search size={15} />} label="Jobs" />
              </>
            )}
            {user.role === "admin" && (
              <NavLink to="/admin" icon={<LayoutDashboard size={15} />} label="Admin" />
            )}

            <div className="ml-3 flex items-center gap-2 pl-3 border-l border-gray-200">
              <span className="text-sm text-gray-600 hidden sm:block">{user.name}</span>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        )}

        {!user && (
          <div className="flex items-center gap-2">
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5">Login</Link>
            <Link to="/register" className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

function NavLink({ to, icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors"
    >
      {icon}
      <span className="hidden sm:block">{label}</span>
    </Link>
  );
}
