"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, LoaderCircle, Search, Send } from "lucide-react";
import {
  getWarehouseInbox,
  getWarehouseThread,
  sendWarehouseMessage,
} from "../../api/endpoints";
import OwnerMessages, { type MessageTarget } from "./owner-messages";

type WarehouseContact = {
  id: string;
  mechanicId?: string;
  warehouseId?: string;
  orderId?: string;
  name: string;
  subtitle: string;
  lastText: string;
  lastTime: string;
};

const initials = (name = "Wingman") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const when = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "";

function WarehouseMessages({ role }: { role: "mechanic" | "warehouse" }) {
  const [contacts, setContacts] = useState<WarehouseContact[]>([]);
  const [selected, setSelected] = useState<WarehouseContact | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getWarehouseInbox()
      .then(({ data }) => {
        if (!active) return;
        setContacts(
          (data || []).map((row: any) => ({
            id: `${row.warehouse_id || ""}:${row.mechanic_id || ""}:${row.warehouse_order_id || ""}`,
            mechanicId: row.mechanic_id,
            warehouseId: row.warehouse_id,
            orderId: row.warehouse_order_id,
            name: role === "warehouse" ? row.mechanic_name : row.warehouse_name,
            subtitle: role === "warehouse" ? "Mechanic" : "Parts supplier",
            lastText: row.latest_message || "Start a conversation",
            lastTime: when(row.latest_at),
          })),
        );
      })
      .catch((requestError: any) =>
        active &&
        setError(requestError?.response?.data?.detail || "Warehouse conversations could not be loaded."),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError("");
    const params =
      role === "warehouse"
        ? { mechanic_id: selected.mechanicId }
        : { warehouse_id: selected.warehouseId };
    getWarehouseThread(params)
      .then(({ data }) => setMessages(data || []))
      .catch((requestError: any) =>
        setError(requestError?.response?.data?.detail || "This conversation could not be opened."),
      )
      .finally(() => setLoading(false));
  }, [role, selected?.id]);

  const visible = useMemo(
    () =>
      contacts.filter((contact) =>
        `${contact.name} ${contact.subtitle} ${contact.lastText}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [contacts, query],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !draft.trim()) return;
    setSending(true);
    setError("");
    try {
      const payload =
        role === "warehouse"
          ? {
              mechanic_id: selected.mechanicId,
              warehouse_order_id: selected.orderId || undefined,
              message: draft.trim(),
            }
          : {
              warehouse_id: selected.warehouseId,
              warehouse_order_id: selected.orderId || undefined,
              message: draft.trim(),
            };
      const { data } = await sendWarehouseMessage(payload);
      setMessages((current) => [...current, data]);
      setContacts((current) =>
        current.map((contact) =>
          contact.id === selected.id
            ? { ...contact, lastText: draft.trim(), lastTime: "Just now" }
            : contact,
        ),
      );
      setDraft("");
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="owner-inbox panel">
      {!selected ? (
        <>
          <label className="inbox-search">
            <Search size={19} />
            <input
              aria-label="Search supplier conversations"
              placeholder="Search supplier conversations"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="inbox-people">
            {loading ? (
              <p className="inbox-empty">
                <LoaderCircle className="spin" size={20} /> Loading conversations…
              </p>
            ) : (
              visible.map((contact) => (
                <button
                  className="inbox-person"
                  key={contact.id}
                  onClick={() => setSelected(contact)}
                >
                  <span className="avatar">{initials(contact.name)}</span>
                  <span className="inbox-person-copy">
                    <strong>{contact.name}</strong>
                    <span>{contact.subtitle}</span>
                    <small>{contact.lastText}</small>
                  </span>
                  <span className="inbox-person-meta">
                    <time>{contact.lastTime}</time>
                    <ChevronRight size={17} />
                  </span>
                </button>
              ))
            )}
            {!loading && !visible.length && (
              <p className="inbox-empty">
                No supplier conversations yet. Place an order to start one.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <header className="inbox-chat-header">
            <button
              className="icon-button"
              aria-label="Back to conversations"
              onClick={() => setSelected(null)}
            >
              <ArrowLeft size={21} />
            </button>
            <span className="avatar">{initials(selected.name)}</span>
            <div>
              <strong>{selected.name}</strong>
              <small>{selected.subtitle}</small>
            </div>
          </header>
          {error && <p className="form-error">{error}</p>}
          <div className="inbox-thread" role="log" aria-label={`Conversation with ${selected.name}`}>
            {loading ? (
              <p className="inbox-empty">Loading messages…</p>
            ) : messages.length ? (
              messages.map((message) => (
                <div
                  className={`inbox-bubble ${message.sender_role === role ? "me" : "them"}`}
                  key={message.id}
                >
                  <p>{message.message}</p>
                  <small>{when(message.created_at)}</small>
                </div>
              ))
            ) : (
              <p className="inbox-empty">No messages yet. Say hello to start this conversation.</p>
            )}
          </div>
          <form className="inbox-composer" onSubmit={submit}>
            <input
              aria-label={`Message ${selected.name}`}
              placeholder="Message…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="primary" aria-label="Send message" disabled={!draft.trim() || sending}>
              {sending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

export default function OperationsMessages({
  role,
  target,
}: {
  role: "mechanic" | "warehouse";
  target?: MessageTarget | null;
}) {
  const [channel, setChannel] = useState<"owners" | "suppliers">(
    role === "warehouse" ? "suppliers" : "owners",
  );

  if (role === "warehouse") return <WarehouseMessages role="warehouse" />;

  return (
    <>
      <div className="segmented workspace-message-tabs" aria-label="Message category">
        <button className={channel === "owners" ? "active" : ""} onClick={() => setChannel("owners")}>
          Vehicle owners
        </button>
        <button
          className={channel === "suppliers" ? "active" : ""}
          onClick={() => setChannel("suppliers")}
        >
          Parts suppliers
        </button>
      </div>
      {channel === "owners" ? (
        <OwnerMessages role="mechanic" target={target} />
      ) : (
        <WarehouseMessages role="mechanic" />
      )}
    </>
  );
}
