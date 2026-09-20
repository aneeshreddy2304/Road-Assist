import { useEffect, useState } from "react";
import { Building2, Check, ChevronLeft, LoaderCircle, Save, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import {
  getBusinessWorkspaceProfile,
  getOwnerWorkspaceProfile,
  updateBusinessWorkspaceProfile,
  updateMe,
  updateOwnerWorkspaceProfile,
} from "../api/endpoints";
import { useAuth } from "../context/AuthContext";

const ownerDefaults = {
  name: "", phone: "", street_address: "", city: "", state: "", postal_code: "",
  display_name: "", preferred_language: "English", emergency_contact_name: "",
  emergency_contact_relationship: "", emergency_contact_phone: "",
  preferred_service_mode: "no_preference", preferred_appointment_time: "no_preference",
  accessibility_notes: "", notify_request_updates: true, notify_appointment_reminders: true,
  notify_vehicle_care: true, notify_messages: true, notify_order_updates: true,
};

const businessDefaults = {
  business_name: "", business_category: "", contact_person: "", website_url: "", description: "",
  street_address: "", city: "", state: "California", postal_code: "", service_modes: [],
  service_radius_miles: 15, areas_served: "", holiday_hours: "", offered_services: [],
  makes_serviced: "", vehicle_types_supported: "", powertrains_supported: "",
  languages_spoken: "English", facilities: [], accepts_new_work: true,
  appointments_required: false, walk_ins_accepted: false, warranty_or_returns_policy: "",
  arrival_or_pickup_instructions: "", accepted_payment_methods: "", fulfillment_minimum_order: 0,
  fulfillment_processing_time: "",
};

const toggleOptions = {
  owner: [
    ["notify_request_updates", "Request updates"], ["notify_appointment_reminders", "Appointment reminders"],
    ["notify_vehicle_care", "Vehicle Care reminders"], ["notify_messages", "Messages"],
    ["notify_order_updates", "Order updates"],
  ],
  business: [["accepts_new_work", "Accepting new work"], ["appointments_required", "Appointments required"], ["walk_ins_accepted", "Walk-ins accepted"]],
};

function textList(value) { return Array.isArray(value) ? value.join(", ") : ""; }
function toList(value) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

export default function WorkspaceProfile() {
  const { user, refreshUser } = useAuth();
  const isOwner = user?.role === "owner";
  const [form, setForm] = useState(isOwner ? ownerDefaults : businessDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const result = isOwner ? await getOwnerWorkspaceProfile() : await getBusinessWorkspaceProfile();
        if (!active) return;
        const data = result.data;
        const saved = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null));
        setForm({
          ...(isOwner ? ownerDefaults : businessDefaults),
          ...saved,
          service_modes: textList(data.service_modes), offered_services: textList(data.offered_services), facilities: textList(data.facilities),
        });
      } catch (error) {
        if (active) setMessage(error.response?.data?.detail || "We could not load this profile.");
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [isOwner]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      await updateMe({ name: form.name, phone: form.phone || null, street_address: form.street_address || null, city: form.city || null, state: form.state || null, postal_code: form.postal_code || null });
      if (isOwner) {
        const { name, phone, street_address, city, state, postal_code, ...workspace } = form;
        await updateOwnerWorkspaceProfile(workspace);
      } else {
        const payload = { ...form, website_url: form.website_url || null, service_modes: toList(form.service_modes || ""), offered_services: toList(form.offered_services || ""), facilities: toList(form.facilities || "") };
        delete payload.name; delete payload.phone;
        await updateBusinessWorkspaceProfile(payload);
      }
      await refreshUser(); setMessage("Profile saved.");
    } catch (error) { setMessage(error.response?.data?.detail || "We could not save the profile."); }
    finally { setSaving(false); }
  };

  if (loading) return <main className="wingman-profile-page"><div className="wingman-profile-loading"><LoaderCircle className="animate-spin" /> Loading workspace profile…</div></main>;
  const roleLabel = isOwner ? "Owner" : user?.role === "warehouse" ? "Warehouse" : "Mechanic";
  return <main className="wingman-profile-page">
    <div className="wingman-profile-wrap">
      <Link to={isOwner ? "/explore" : user?.role === "warehouse" ? "/warehouse" : "/dashboard"} className="wingman-back"><ChevronLeft size={17} /> Back to workspace</Link>
      <header className="wingman-profile-hero"><span className="wingman-profile-icon">{isOwner ? <UserRound size={23} /> : <Building2 size={23} />}</span><div><p>{roleLabel} workspace</p><h1>{isOwner ? "Your profile and preferences" : "Your business profile"}</h1><span>Everything here is visible only where it helps the right Wingman workflow.</span></div></header>
      <form className="wingman-profile-form" onSubmit={submit}>
        <ProfileSection title={isOwner ? "Personal information" : "Business information"}>
          {isOwner ? <><Input label="Full name" value={form.name} onChange={(v) => set("name", v)} /><Input label="Display name" value={form.display_name} onChange={(v) => set("display_name", v)} /><Input label="Phone" value={form.phone} onChange={(v) => set("phone", v)} /><Select label="Preferred language" value={form.preferred_language} onChange={(v) => set("preferred_language", v)} options={["English", "Spanish"]} /></> : <><Input label="Business name" value={form.business_name} onChange={(v) => set("business_name", v)} /><Input label="Business category" value={form.business_category} onChange={(v) => set("business_category", v)} /><Input label="Contact person" value={form.contact_person} onChange={(v) => set("contact_person", v)} /><Input label="Website" type="url" value={form.website_url} onChange={(v) => set("website_url", v)} /><TextArea label="Business description" value={form.description} onChange={(v) => set("description", v)} /></>}
        </ProfileSection>
        <ProfileSection title="Address">
          <Input label="Street address" value={form.street_address} onChange={(v) => set("street_address", v)} wide /><Input label="City" value={form.city} onChange={(v) => set("city", v)} /><Input label="State" value={form.state} onChange={(v) => set("state", v)} /><Input label="ZIP code" value={form.postal_code} onChange={(v) => set("postal_code", v)} />
        </ProfileSection>
        {isOwner ? <><ProfileSection title="Emergency contact"><Input label="Contact name" value={form.emergency_contact_name} onChange={(v) => set("emergency_contact_name", v)} /><Input label="Relationship" value={form.emergency_contact_relationship} onChange={(v) => set("emergency_contact_relationship", v)} /><Input label="Contact phone" value={form.emergency_contact_phone} onChange={(v) => set("emergency_contact_phone", v)} /></ProfileSection><ProfileSection title="Service preferences"><Select label="Preferred service mode" value={form.preferred_service_mode} onChange={(v) => set("preferred_service_mode", v)} options={["no_preference", "mobile_service", "shop_visit"]} /><Select label="Preferred appointment time" value={form.preferred_appointment_time} onChange={(v) => set("preferred_appointment_time", v)} options={["no_preference", "morning", "afternoon"]} /><TextArea label="Accessibility or service notes" value={form.accessibility_notes} onChange={(v) => set("accessibility_notes", v)} wide /></ProfileSection><ToggleSection title="In-app notifications" items={toggleOptions.owner} form={form} set={set} /></> : <><ProfileSection title="Service area and capabilities"><Input label="Service modes, separated by commas" value={form.service_modes} onChange={(v) => set("service_modes", v)} /><Input label="Service radius, miles" type="number" value={form.service_radius_miles} onChange={(v) => set("service_radius_miles", Number(v))} /><Input label="Areas served" value={form.areas_served} onChange={(v) => set("areas_served", v)} wide /><Input label="Services or products, separated by commas" value={form.offered_services} onChange={(v) => set("offered_services", v)} wide /><Input label="Facilities, separated by commas" value={form.facilities} onChange={(v) => set("facilities", v)} wide /></ProfileSection><ProfileSection title="Policies"><TextArea label="Warranty or returns policy" value={form.warranty_or_returns_policy} onChange={(v) => set("warranty_or_returns_policy", v)} /><TextArea label="Arrival or pickup instructions" value={form.arrival_or_pickup_instructions} onChange={(v) => set("arrival_or_pickup_instructions", v)} /><Input label="Accepted payment methods" value={form.accepted_payment_methods} onChange={(v) => set("accepted_payment_methods", v)} /></ProfileSection><ToggleSection title="Booking and availability" items={toggleOptions.business} form={form} set={set} /></>}
        <div className="wingman-profile-save"><button disabled={saving} className="wingman-save-button">{saving ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}{saving ? "Saving" : "Save changes"}</button>{message ? <span className={message === "Profile saved." ? "wingman-save-success" : "wingman-save-error"}>{message === "Profile saved." ? <Check size={16} /> : null}{message}</span> : null}</div>
      </form>
    </div>
  </main>;
}

function ProfileSection({ title, children }) { return <section className="wingman-profile-section"><h2>{title}</h2><div className="wingman-profile-grid">{children}</div></section>; }
function ToggleSection({ title, items, form, set }) { return <section className="wingman-profile-section"><h2>{title}</h2><div className="wingman-toggle-list">{items.map(([key, label]) => <label key={key}><span>{label}</span><input type="checkbox" checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked)} /><i /></label>)}</div></section>; }
function Input({ label, value, onChange, type = "text", wide = false }) { return <label className={wide ? "wide" : ""}><span>{label}</span><input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>; }
function TextArea({ label, value, onChange, wide = false }) { return <label className={wide ? "wide" : ""}><span>{label}</span><textarea rows="3" value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></label>; }
function Select({ label, value, onChange, options }) { return <label><span>{label}</span><select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option value={option} key={option}>{option.replaceAll("_", " ")}</option>)}</select></label>; }
