import API from "./client";

// --- Auth ---
export const login    = (data) => API.post("/auth/login", data);
export const register = (data) => API.post("/auth/register", data);
export const getMe    = ()     => API.get("/auth/me");
export const updateMe = (data) => API.patch("/auth/me", data);

// --- Mechanics ---
export const getNearbyMechanics = (params) =>
  API.get("/mechanics/nearby", { params });

export const getMyMechanicProfile = () =>
  API.get("/mechanics/me");

export const getMechanicProfile = (id, params) =>
  API.get(`/mechanics/${id}`, { params });

export const getMechanicDashboard = (id) =>
  API.get(`/mechanics/${id}/dashboard`);

export const updateMyProfile = (data) =>
  API.patch("/mechanics/me", data);

// --- Parts ---
export const searchParts        = (params) => API.get("/parts/search", { params });
export const suggestParts      = (params) => API.get("/parts/suggest", { params });
export const getMechanicParts   = (id)     => API.get(`/parts/mechanic/${id}`);
export const addPart            = (data)   => API.post("/parts", data);
export const updatePart         = (id, data) => API.patch(`/parts/${id}`, data);
export const deletePart         = (id)     => API.delete(`/parts/${id}`);

// --- Vehicles ---
export const getMyVehicles = ()     => API.get("/vehicles");
export const addVehicle    = (data) => API.post("/vehicles", data);
export const updateVehicle = (id, data) => API.patch(`/vehicles/${id}`, data);
export const deleteVehicle = (id)   => API.delete(`/vehicles/${id}`);

// --- Service Requests ---
export const createRequest      = (data)   => API.post("/requests", data);
export const listRequests       = (params) => API.get("/requests", { params });
export const getOwnerHistory    = ()   => API.get("/requests/history/owner");
export const getRequest         = (id)     => API.get(`/requests/${id}`);
export const getRequestHistory  = (id)     => API.get(`/requests/${id}/history`);
export const updateRequestStatus= (id, data) => API.patch(`/requests/${id}/status`, data);
export const getOpenRequests    = (params) => API.get("/requests/open", { params });

// --- Reviews ---
export const submitReview = (data) => API.post("/reviews", data);

// --- Alerts ---
export const getAlerts    = ()   => API.get("/alerts");
export const resolveAlert = (id) => API.patch(`/alerts/${id}/resolve`);

// --- Admin ---
export const getAnalytics      = ()   => API.get("/admin/analytics");
export const getAllMechanics    = ()   => API.get("/admin/mechanics");
export const deactivateMechanic= (id) => API.patch(`/admin/mechanics/${id}/deactivate`);
