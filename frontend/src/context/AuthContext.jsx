import { createContext, useContext, useState, useEffect } from "react";
import { getMe, login as apiLogin, register as apiRegister } from "../api/endpoints";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  useEffect(() => {
    if (!token) return;

    getMe()
      .then((res) => {
        const merged = {
          ...(JSON.parse(localStorage.getItem("user") || "{}")),
          ...res.data,
          id: res.data.id,
          role: res.data.role,
        };
        localStorage.setItem("user", JSON.stringify(merged));
        setUser(merged);
      })
      .catch(() => {
        logout();
      });
  }, [token]);

  const login = async (email, password) => {
    const res = await apiLogin({ email, password });
    const { access_token, role, user_id, name } = res.data;
    const userData = { id: user_id, name, role };
    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const register = async (payload) => {
    const res = await apiRegister(payload);
    const { access_token, role, user_id, name } = res.data;
    if (access_token) {
      const userData = { id: user_id, name, role };
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      return { ...userData, ...res.data };
    }
    return res.data;
  };

  const refreshUser = async () => {
    if (!token) return null;
    const res = await getMe();
    const nextUser = {
      ...(user || {}),
      ...res.data,
      id: res.data.id,
      role: res.data.role,
    };
    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
