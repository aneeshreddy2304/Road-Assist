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

export const getMechanicDashboard = (id, params) =>
  API.get(`/mechanics/${id}/dashboard`, { params });

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
export const getVehicleQuickNotes = (id) => API.get(`/vehicles/${id}/quick-notes`);
export const addVehicleQuickNote = (id, data) => API.post(`/vehicles/${id}/quick-notes`, data);

// --- Vehicle Care ---
export const getVehicleCare = (vehicleId) => API.get(`/vehicle-care/vehicles/${vehicleId}`);
export const addVehicleCheckin = (vehicleId, data) => API.post(`/vehicle-care/vehicles/${vehicleId}/checkins`, data);
export const addServiceRecord = (vehicleId, data) => API.post(`/vehicle-care/vehicles/${vehicleId}/service-records`, data);
export const getOwnerNotifications = () => API.get("/vehicle-care/notifications");
export const markNotificationRead = (id, data = { read: true }) => API.patch(`/vehicle-care/notifications/${id}`, data);
export const downloadServiceInvoice = (recordId) => API.get(`/vehicle-care/service-records/${recordId}/invoice`, { responseType: "blob" });

// --- Owner directory, service scheduling, and direct parts orders ---
export const getOwnerDirectoryProviders = (params) => API.get("/owner-marketplace/providers", { params });
export const getOwnerMarketplaceParts = (params) => API.get("/owner-marketplace/parts", { params });
export const createOwnerPartOrder = (data) => API.post("/owner-marketplace/orders", data);
export const getOwnerPartOrders = () => API.get("/owner-marketplace/orders");
export const createProviderBooking = (data) => API.post("/owner-marketplace/bookings", data);
export const getProviderBookings = () => API.get("/owner-marketplace/bookings");

// --- Full Wingman workspace profiles and recorded billing ---
export const getOwnerWorkspaceProfile = () => API.get("/workspace/owner-profile");
export const updateOwnerWorkspaceProfile = (data) => API.put("/workspace/owner-profile", data);
export const getBusinessWorkspaceProfile = () => API.get("/workspace/business-profile");
export const updateBusinessWorkspaceProfile = (data) => API.put("/workspace/business-profile", data);
export const getRecordedInvoices = () => API.get("/workspace/invoices");
export const createRecordedInvoice = (data) => API.post("/workspace/invoices", data);
export const updateRecordedInvoiceStatus = (id, data) => API.patch(`/workspace/invoices/${id}/status`, data);

// --- Service Requests ---
export const createRequest      = (data)   => API.post("/requests", data);
export const listRequests       = (params) => API.get("/requests", { params });
export const getOwnerHistory    = ()   => API.get("/requests/history/owner");
export const getRequest         = (id)     => API.get(`/requests/${id}`);
export const getRequestHistory  = (id)     => API.get(`/requests/${id}/history`);
export const updateRequestStatus= (id, data) => API.patch(`/requests/${id}/status`, data);
export const getOpenRequests    = (params) => API.get("/requests/open", { params });

// --- Appointments ---
export const getMechanicAvailability = (params) => API.get("/appointments/availability", { params });
export const createAppointment = (data) => API.post("/appointments", data);
export const listAppointments = () => API.get("/appointments");
export const updateAppointmentStatus = (id, data) => API.patch(`/appointments/${id}/status`, data);

// --- Chat ---
export const getMessageThread = (params) => API.get("/messages/thread", { params });
export const sendMessage = (data) => API.post("/messages/thread", data);
export const getMessageInbox = () => API.get("/messages/inbox");
export const deleteMessageThread = (params) => API.delete("/messages/thread", { params });

// --- Reviews ---
export const submitReview = (data) => API.post("/reviews", data);

// --- Alerts ---
export const getAlerts    = ()   => API.get("/alerts");
export const resolveAlert = (id) => API.patch(`/alerts/${id}/resolve`);

// --- Admin ---
export const getAnalytics      = (params)   => API.get("/admin/analytics", { params });
export const getAllMechanics    = ()   => API.get("/admin/mechanics");
export const getAllWarehouses   = ()   => API.get("/admin/warehouses");
export const approveMechanicRegistration = (id) => API.patch(`/admin/mechanics/${id}/approve`);
export const declineMechanicRegistration = (id) => API.patch(`/admin/mechanics/${id}/decline`);
export const approveWarehouseRegistration = (id) => API.patch(`/admin/warehouses/${id}/approve`);
export const declineWarehouseRegistration = (id) => API.patch(`/admin/warehouses/${id}/decline`);
export const deactivateMechanic= (id) => API.patch(`/admin/mechanics/${id}/deactivate`);
export const deactivateWarehouse = (id) => API.patch(`/admin/warehouses/${id}/deactivate`);
export const getAllOwners      = ()   => API.get("/admin/owners");
export const deactivateOwner   = (id) => API.patch(`/admin/owners/${id}/deactivate`);
export const searchAdminWorkItem = (query) => API.get("/admin/lookup", { params: { query } });

// --- Warehouses ---
export const getWarehouseMarketplace = (params) => API.get("/warehouses/marketplace", { params });
export const getWarehouseDetail = (warehouseId) => API.get(`/warehouses/marketplace/${warehouseId}`);
export const searchWarehouseParts = (params) => API.get("/warehouses/marketplace/parts", { params });
export const getMyWarehouseProfile = () => API.get("/warehouses/me");
export const getWarehouseInventory = () => API.get("/warehouses/inventory");
export const addWarehousePart = (data) => API.post("/warehouses/inventory", data);
export const updateWarehousePart = (id, data) => API.patch(`/warehouses/inventory/${id}`, data);
export const getWarehouseOrders = () => API.get("/warehouses/orders");
export const getWarehouseOrderDetail = (orderRef) => API.get(`/warehouses/orders/${encodeURIComponent(orderRef)}`);
export const createWarehouseOrder = (data) => API.post("/warehouses/orders", data);
export const createWarehouseOrderGroup = (data) => API.post("/warehouses/orders/group", data);
export const updateWarehouseOrder = (id, data) => API.patch(`/warehouses/orders/${id}`, data);
export const updateWarehouseOrderGroup = (orderRef, data) => API.patch(`/warehouses/orders/group/${encodeURIComponent(orderRef)}`, data);
export const getWarehouseInbox = () => API.get("/warehouses/messages/inbox");
export const getWarehouseThread = (params) => API.get("/warehouses/messages/thread", { params });
export const sendWarehouseMessage = (data) => API.post("/warehouses/messages/thread", data);
export const deleteWarehouseThread = (params) => API.delete("/warehouses/messages/thread", { params });
