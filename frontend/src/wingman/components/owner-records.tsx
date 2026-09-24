"use client";
import { useEffect, useState } from "react";
import { Badge, Modal } from "./prototype-shared";
import {
  getOwnerWorkspaceProfile,
  updateOwnerWorkspaceProfile,
} from "../../api/endpoints";

export const pastVisits = [
  {
    id: "APT-1982",
    date: "July 12, 2026",
    service: "Oil change & inspection",
    vehicle: "2021 Toyota RAV4",
    provider: "Sunset Auto Care",
    technician: "Alex Morgan",
    mileage: 41600,
    notes: "Oil and filter replaced. Tires rotated and brakes inspected.",
    items: [
      ["Synthetic oil and filter", 49],
      ["Oil change labor", 40],
      ["Tire rotation", 35],
      ["Brake inspection", 25],
    ] as [string, number][],
  },
  {
    id: "APT-1840",
    date: "April 4, 2026",
    service: "Scheduled maintenance",
    vehicle: "2019 Subaru Outback",
    provider: "Golden Gate Motors",
    technician: "Sam Rivera",
    mileage: 64000,
    notes: "Scheduled inspection completed and cabin air filter replaced.",
    items: [
      ["Scheduled maintenance labor", 165],
      ["Cabin air filter and installation", 50],
    ] as [string, number][],
  },
];

export function Billing({
  items,
  reference,
}: {
  items: [string, number][];
  reference: string;
}) {
  const total = items.reduce((sum, [, price]) => sum + price, 0);
  return (
    <section className="history-billing">
      <div className="between">
        <h3>Billing details</h3>
        <Badge>Paid · Demo</Badge>
      </div>
      <p className="muted">
        {reference} · Illustrative receipt, not proof of payment.
      </p>
      {items.map(([label, price]) => (
        <div className="between" key={label}>
          <span>{label}</span>
          <strong>${price.toFixed(2)}</strong>
        </div>
      ))}
      <hr />
      <div className="between">
        <span>Subtotal</span>
        <strong>${total.toFixed(2)}</strong>
      </div>
      <div className="between">
        <span>Recorded tax / fees</span>
        <span>$0.00</span>
      </div>
      <div className="between">
        <strong>Total</strong>
        <strong>${total.toFixed(2)}</strong>
      </div>
      <div className="between">
        <span>Balance due</span>
        <span>$0.00</span>
      </div>
      <p className="muted">
        Payment recorded at provider. Wingman does not process payments.
      </p>
    </section>
  );
}

export function AppointmentHistory() {
  const [selected, setSelected] = useState<(typeof pastVisits)[number] | null>(
    null,
  );
  return (
    <section className="appointment-history">
      <h3 className="list-heading">Past appointments</h3>
      {pastVisits.map((a) => (
        <article className="panel appointment-card" key={a.id}>
          <div>
            <div className="between">
              <h2>{a.service}</h2>
              <Badge tone="gray">Completed</Badge>
            </div>
            <p>
              {a.provider} · {a.vehicle}
            </p>
            <p>
              {a.date} · {a.id}
            </p>
            <div className="between">
              <strong>
                ${a.items.reduce((sum, [, value]) => sum + value, 0).toFixed(2)}{" "}
                · Paid
              </strong>
              <button className="text-button" onClick={() => setSelected(a)}>
                Details & billing
              </button>
            </div>
          </div>
        </article>
      ))}
      {selected && (
        <Modal
          title="Appointment details"
          subtitle={selected.id}
          wide
          onClose={() => setSelected(null)}
        >
          <dl className="history-details">
            {[
              ["Service", selected.service],
              ["Date", selected.date],
              ["Provider", selected.provider],
              ["Technician", selected.technician],
              ["Vehicle", selected.vehicle],
              ["Mileage", `${selected.mileage.toLocaleString()} mi`],
              ["Service mode", "Shop visit"],
              ["Status", "Completed"],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <h3>Work completed</h3>
          <p>{selected.notes}</p>
          <Billing items={selected.items} reference={`INV-${selected.id}`} />
        </Modal>
      )}
    </section>
  );
}

type OwnerVehicle = {
  id: number;
  year: number;
  make: string;
  model: string;
  backendId?: string;
};

export function OwnerProfile({
  vehicles,
  onGarage,
  notify,
}: {
  vehicles: OwnerVehicle[];
  onGarage: () => void;
  notify: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false),
    [saved, setSaved] = useState(false),
    [profile, setProfile] = useState<any>(null);
  const authenticated = Boolean(localStorage.getItem("token"));
  useEffect(() => {
    if (!authenticated) return;
    getOwnerWorkspaceProfile()
      .then(({ data }) => setProfile(data))
      .catch(() => notify("Your profile could not be loaded."));
  }, [authenticated, notify]);
  if (authenticated && !profile)
    return (
      <div className="panel business-profile">
        <p>Loading your profile…</p>
      </div>
    );
  const p = profile || {
    name: "Jordan Ellis",
    display_name: "Jordan Ellis",
    email: "jordan@wingman.example",
    phone: "415-555-0100",
    street_address: "",
    city: "San Francisco",
    state: "California",
    postal_code: "94122",
    preferred_language: "English",
  };
  return (
    <form
      key={`${p.user_id || "demo"}-${editing}`}
      className={`panel business-profile form-grid ${editing ? "profile-editing" : ""}`}
      onChange={() => setSaved(false)}
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          if (authenticated) {
            const { data: updated } = await updateOwnerWorkspaceProfile({
              display_name: String(data.get("display_name") || ""),
              street_address: String(data.get("street_address") || ""),
              city: String(data.get("city") || ""),
              state: String(data.get("state") || ""),
              postal_code: String(data.get("postal_code") || ""),
              preferred_language: String(
                data.get("preferred_language") || "English",
              ),
              emergency_contact_name: String(data.get("emergency_name") || ""),
              emergency_contact_relationship: String(
                data.get("emergency_relationship") || "",
              ),
              emergency_contact_phone: String(
                data.get("emergency_phone") || "",
              ),
              default_vehicle_id:
                String(data.get("default_vehicle") || "") || null,
              preferred_service_mode: String(data.get("service_mode") || ""),
              preferred_appointment_time: String(
                data.get("appointment_time") || "",
              ),
              accessibility_notes: String(data.get("notes") || ""),
              notify_request_updates: Boolean(data.get("notify_requests")),
              notify_appointment_reminders: Boolean(
                data.get("notify_appointments"),
              ),
              notify_vehicle_care: Boolean(data.get("notify_care")),
              notify_messages: Boolean(data.get("notify_messages")),
              notify_order_updates: Boolean(data.get("notify_orders")),
            });
            setProfile(updated);
          }
          setSaved(true);
          setEditing(false);
          notify("Profile saved.");
        } catch (error: any) {
          notify(
            error?.response?.data?.detail || "Your profile could not be saved.",
          );
        }
      }}
    >
      <div className="between profile-heading">
        <div>
          <span className="overline">Your account</span>
          <h2>Profile details</h2>
        </div>
        {!editing && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            Edit profile
          </button>
        )}
      </div>
      <fieldset disabled={!editing}>
        <legend>Personal information</legend>
        <div className="form-columns">
          <label>
            Account name
            <input disabled value={p.name || ""} />
          </label>
          <label>
            Display name
            <input
              name="display_name"
              defaultValue={p.display_name || p.name || ""}
            />
          </label>
          <label>
            Email
            <input type="email" disabled value={p.email || ""} />
          </label>
          <label>
            Phone
            <input type="tel" disabled value={p.phone || ""} />
          </label>
          <label>
            Preferred language
            <select
              name="preferred_language"
              defaultValue={p.preferred_language || "English"}
            >
              <option>English</option>
              <option>Spanish</option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset disabled={!editing}>
        <legend>Home address</legend>
        <div className="form-columns">
          <label>
            Street address
            <input
              name="street_address"
              defaultValue={p.street_address || ""}
              placeholder="Street and number"
            />
          </label>
          <label>
            City
            <input name="city" defaultValue={p.city || ""} />
          </label>
          <label>
            State
            <input name="state" defaultValue={p.state || ""} />
          </label>
          <label>
            ZIP code
            <input
              name="postal_code"
              defaultValue={p.postal_code || ""}
              pattern="[0-9]{5}(-[0-9]{4})?"
            />
          </label>
        </div>
      </fieldset>
      <fieldset disabled={!editing}>
        <legend>Emergency contact</legend>
        <div className="form-columns">
          <label>
            Contact name
            <input
              name="emergency_name"
              defaultValue={p.emergency_contact_name || ""}
            />
          </label>
          <label>
            Relationship
            <input
              name="emergency_relationship"
              defaultValue={p.emergency_contact_relationship || ""}
            />
          </label>
          <label>
            Contact phone
            <input
              name="emergency_phone"
              type="tel"
              defaultValue={p.emergency_contact_phone || ""}
            />
          </label>
        </div>
      </fieldset>
      <fieldset disabled={!editing}>
        <legend>Vehicles</legend>
        <label>
          Default vehicle
          <select
            name="default_vehicle"
            defaultValue={p.default_vehicle_id || ""}
          >
            <option value="">No default</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.backendId || ""}>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </option>
            ))}
          </select>
        </label>
        {editing && (
          <button type="button" className="secondary" onClick={onGarage}>
            Manage vehicles
          </button>
        )}
      </fieldset>
      <fieldset disabled={!editing}>
        <legend>Service preferences</legend>
        <div className="form-columns">
          <label>
            Preferred service mode
            <select
              name="service_mode"
              defaultValue={p.preferred_service_mode || "No preference"}
            >
              <option>No preference</option>
              <option>Mobile service</option>
              <option>Shop visit</option>
            </select>
          </label>
          <label>
            Preferred appointment time
            <select
              name="appointment_time"
              defaultValue={p.preferred_appointment_time || "No preference"}
            >
              <option>No preference</option>
              <option>Morning</option>
              <option>Afternoon</option>
            </select>
          </label>
        </div>
        <label>
          Accessibility or service notes
          <textarea
            name="notes"
            defaultValue={p.accessibility_notes || ""}
            placeholder="Optional instructions for your provider"
          />
        </label>
      </fieldset>
      <fieldset disabled={!editing}>
        <legend>In-app notifications</legend>
        {[
          ["notify_requests", "Request updates", p.notify_request_updates],
          [
            "notify_appointments",
            "Appointment reminders",
            p.notify_appointment_reminders,
          ],
          ["notify_care", "Vehicle Care reminders", p.notify_vehicle_care],
          ["notify_messages", "Messages", p.notify_messages],
          ["notify_orders", "Order updates", p.notify_order_updates],
        ].map(([name, label, checked]: any) => (
          <label className="checkbox-label" key={name}>
            <input
              name={name}
              type="checkbox"
              defaultChecked={checked !== false}
            />
            {label}
          </label>
        ))}
        <p className="muted">
          Notifications are delivered inside Wingman. Email and SMS are not
          enabled.
        </p>
      </fieldset>
      {editing && (
        <div className="button-row">
          <button className="primary">Save edits</button>
          <button
            type="button"
            className="secondary"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      )}
      {saved && (
        <span role="status" className="saved-state">
          Saved
        </span>
      )}
    </form>
  );
}
