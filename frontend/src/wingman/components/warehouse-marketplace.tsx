"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
} from "lucide-react";
import {
  createWarehouseOrderGroup,
  getWarehouseDetail,
  getWarehouseMarketplace,
} from "../../api/endpoints";
import { Badge, Empty, Modal } from "./prototype-shared";

type Warehouse = {
  id: string;
  name: string;
  address: string;
  available_parts: number;
  low_stock_parts: number;
};
type Part = {
  id: string;
  part_name: string;
  part_number?: string;
  quantity: number;
  price: number;
  manufacturer?: string;
  lead_time_label?: string;
};

export default function WarehouseMarketplace({
  onOrder,
}: {
  onOrder: (
    warehouse: string,
    item: string,
    quantity: number,
    total: number,
    order?: any,
  ) => void;
}) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]),
    [store, setStore] = useState<Warehouse | null>(null),
    [parts, setParts] = useState<Part[]>([]),
    [query, setQuery] = useState(""),
    [cart, setCart] = useState<Record<string, number>>({}),
    [loading, setLoading] = useState(true),
    [submitting, setSubmitting] = useState(false),
    [error, setError] = useState(""),
    [bagOpen, setBagOpen] = useState(false);
  const live =
    typeof window !== "undefined" && Boolean(localStorage.getItem("token"));
  useEffect(() => {
    if (!live) {
      setLoading(false);
      return;
    }
    getWarehouseMarketplace({ lat: 37.7749, lng: -122.4194, radius_km: 5000 })
      .then((r) => setWarehouses(r.data || []))
      .catch((e) =>
        setError(
          e?.response?.data?.detail || "Warehouses could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, [live]);
  async function openStore(warehouse: Warehouse) {
    setStore(warehouse);
    setLoading(true);
    setError("");
    setQuery("");
    setCart({});
    try {
      const { data } = await getWarehouseDetail(warehouse.id);
      setParts(data.inventory || []);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || "Warehouse inventory could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }
  const visibleStores = warehouses.filter((item) =>
    `${item.name} ${item.address}`.toLowerCase().includes(query.toLowerCase()),
  );
  const visibleParts = parts.filter((item) =>
    `${item.part_name} ${item.part_number || ""} ${item.manufacturer || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const count = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0,
  );
  const total = useMemo(
    () =>
      parts.reduce(
        (sum, part) => sum + Number(part.price) * (cart[part.id] || 0),
        0,
      ),
    [parts, cart],
  );
  function changeQuantity(part: Part, delta: number) {
    setCart((current) => {
      const next = Math.max(
          0,
          Math.min(part.quantity, (current[part.id] || 0) + delta),
        ),
        updated = { ...current };
      if (next === 0) delete updated[part.id];
      else updated[part.id] = next;
      return updated;
    });
  }
  async function order(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!store || !count) return;
    const form = new FormData(event.currentTarget),
      selected = parts.filter((part) => cart[part.id]);
    setSubmitting(true);
    setError("");
    try {
      const { data } = await createWarehouseOrderGroup({
        warehouse_id: store.id,
        items: selected.map((part) => ({
          warehouse_part_id: part.id,
          quantity: cart[part.id],
        })),
        note: String(form.get("note") || "") || null,
      });
      onOrder(
        store.name,
        selected.length === 1
          ? selected[0].part_name
          : `${selected.length} products`,
        count,
        total,
        data,
      );
      setCart({});
      setBagOpen(false);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || "The parts order could not be placed.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="retail-marketplace mechanic-marketplace">
      <div className="marketplace-intro between">
        <p className="muted">
          Live Wingman warehouse inventory and recorded fixed-price orders.
        </p>
        <button
          className="primary retail-bag-button"
          onClick={() => setBagOpen(true)}
          aria-label={`Your parts bag, ${count} ${count === 1 ? "item" : "items"}`}
        >
          <ShoppingBag size={18} /> Your bag{" "}
          <span className="count-light" role="status">
            {count}
          </span>
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {store && (
        <div className="retail-utility">
          <button
            className="text-button"
            onClick={() => {
              setStore(null);
              setParts([]);
              setQuery("");
              setCart({});
            }}
          >
            <ArrowLeft size={17} /> Back to all warehouses
          </button>
          <span>
            <MapPin size={16} /> {store.address}
          </span>
        </div>
      )}
      <label className="search-input retail-search">
        <Search size={18} />
        <input
          aria-label={store ? "Search products" : "Search warehouses"}
          placeholder={
            store
              ? `Search ${store.name} products…`
              : "Search warehouses or locations"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {loading ? (
        <p className="muted">Loading marketplace…</p>
      ) : !store ? (
        <>
          <div className="retail-section-heading">
            <h2>Choose a warehouse</h2>
            <span>Fixed-price ordering</span>
          </div>
          <div className="retail-stores">
            {visibleStores.map((warehouse) => (
              <article className="retail-store panel" key={warehouse.id}>
                <div className="retail-store-wordmark mechanic-store-wordmark">
                  {warehouse.name.split(" ").slice(0, 2).join(" ")}
                  <span>Parts warehouse</span>
                </div>
                <div className="retail-store-body">
                  <Badge tone="gray">Live inventory</Badge>
                  <h3>{warehouse.name}</h3>
                  <p className="retail-address">
                    <MapPin size={16} />
                    {warehouse.address}
                  </p>
                  <p>
                    {warehouse.available_parts} products ·{" "}
                    {warehouse.low_stock_parts} low stock
                  </p>
                  <button
                    className="primary full"
                    onClick={() => openStore(warehouse)}
                  >
                    Browse products <ArrowRight size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!visibleStores.length && (
            <Empty
              title="No warehouses found"
              text="Try another warehouse or location."
            />
          )}
        </>
      ) : (
        <>
          <div className="retail-section-heading">
            <div>
              <h2>{store.name}</h2>
              <p>{parts.length} products available</p>
            </div>
            <span>Recorded billing</span>
          </div>
          <div className="retail-product-list">
            {visibleParts.map((part) => {
              const quantity = cart[part.id] || 0;
              return (
                <article className="retail-product" key={part.id}>
                  <div className="retail-product-copy">
                    <span className="overline">
                      {part.part_number || "Warehouse part"}
                    </span>
                    <h3>{part.part_name}</h3>
                    <p>{part.manufacturer || "Automotive part"}</p>
                    <span className="retail-stock">
                      <Check size={14} /> {part.quantity} in stock ·{" "}
                      {part.lead_time_label || "Available"}
                    </span>
                  </div>
                  <div className="retail-product-buy">
                    <strong>${Number(part.price).toFixed(2)}</strong>
                    <small>Per unit</small>
                    {quantity === 0 ? (
                      <button
                        className="secondary"
                        disabled={!part.quantity}
                        onClick={() => changeQuantity(part, 1)}
                      >
                        <Plus size={16} /> Add
                      </button>
                    ) : (
                      <div
                        className="quantity retail-quantity"
                        aria-label={`${part.part_name} quantity`}
                      >
                        <button
                          type="button"
                          aria-label={`Decrease ${part.part_name} quantity`}
                          onClick={() => changeQuantity(part, -1)}
                        >
                          <Minus size={15} />
                        </button>
                        <span aria-live="polite">{quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${part.part_name} quantity`}
                          disabled={quantity >= part.quantity}
                          onClick={() => changeQuantity(part, 1)}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!visibleParts.length && (
            <Empty
              title="No matching products"
              text="Try another product or SKU."
            />
          )}
        </>
      )}
      {bagOpen && (
        <Modal
          title="Your parts order"
          subtitle={
            store
              ? `${store.name} · Recorded billing`
              : "Choose a warehouse before adding products"
          }
          wide
          onClose={() => setBagOpen(false)}
        >
          {!count ? (
            <Empty
              title="Your bag is empty"
              text="Open a warehouse and add the parts you need."
            />
          ) : (
            <form className="form-grid" onSubmit={order}>
              <div className="cart-items">
                {parts
                  .filter((part) => cart[part.id])
                  .map((part) => (
                    <div className="cart-item" key={part.id}>
                      <div>
                        <h3>{part.part_name}</h3>
                        <p>${Number(part.price).toFixed(2)} per unit</p>
                      </div>
                      <div className="quantity">
                        <button
                          type="button"
                          aria-label={`Decrease ${part.part_name} quantity`}
                          onClick={() => changeQuantity(part, -1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{cart[part.id]}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${part.part_name} quantity`}
                          disabled={cart[part.id] >= part.quantity}
                          onClick={() => changeQuantity(part, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <strong>
                        ${(Number(part.price) * cart[part.id]).toFixed(2)}
                      </strong>
                    </div>
                  ))}
              </div>
              <div className="cart-total between">
                <strong>Recorded total</strong>
                <strong>${total.toFixed(2)}</strong>
              </div>
              <label>
                Order note
                <textarea
                  name="note"
                  placeholder="Delivery or handling instructions"
                />
              </label>
              <button className="primary full" disabled={submitting}>
                {submitting ? "Placing order…" : "Place fixed-price order"}{" "}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
