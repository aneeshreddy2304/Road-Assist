-- RoadAssist security hardening
-- The FastAPI backend connects with the database owner role. Enabling RLS
-- blocks accidental access through Supabase's public API unless a deliberate
-- policy is added later.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_messages ENABLE ROW LEVEL SECURITY;
