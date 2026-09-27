"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
} from "lucide-react";
import { Badge, Empty, Modal } from "./prototype-shared";
import { products as baseProducts } from "@/lib/demo-data";

const stores = [
  {
    id: "oreilly",
    name: "O’Reilly Auto Parts",
    branch: "16th Street",
    address: "2300 16th Street, San Francisco, CA 94103",
    url: "https://locations.oreillyauto.com/en-us/ca/sanfrancisco/autoparts-3032.html",
    accent: "#91cbb0",
    label: "O’Reilly",
    note: "Oil, batteries and everyday maintenance",
  },
  {
    id: "autozone",
    name: "AutoZone",
    branch: "Howard Street",
    address: "1375 Howard Street, San Francisco, CA 94103",
    url: "https://www.autozone.com/locations/ca/san-francisco/1375-howard-street",
    accent: "#e9b08d",
    label: "AutoZone",
    note: "Brakes, wipers and weekend essentials",
  },
  {
    id: "napa",
    name: "NAPA Auto Parts",
    branch: "Evans Avenue",
    address: "1640 Evans Ave, San Francisco, CA",
    url: "https://www.napaonline.com/en/ca/san-francisco/store/26167?store=30976",
    accent: "#b2c5ec",
    label: "NAPA",
    note: "Filters, batteries and garage essentials",
  },
];
type Shop = (typeof stores)[number];
type Product = (typeof baseProducts)[number] & {
  catalogId: string;
  stock: number;
};
type Order = {
  id: string;
  store: Shop;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  status: number;
  contact: string;
  phone: string;
};
const stages = ["Placed", "Preparing", "Ready for pickup", "Picked up"];
function readStore() {
  if (typeof window === "undefined") return null;
  const id = new URLSearchParams(window.location.search).get("shop");
  return stores.find((store) => store.id === id) || null;
}

export default function PartsMarketplace({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [shop, setShop] = useState<Shop | null>(() => readStore()),
    [bagShop, setBagShop] = useState<Shop | null>(null),
    [cart, setCart] = useState<Record<string, number>>({}),
    [pending, setPending] = useState<Shop | null>(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All parts"),
    [storeQuery, setStoreQuery] = useState(""),
    [modal, setModal] = useState(""),
    [orders, setOrders] = useState<Order[]>([]);
  const catalog = useMemo<Product[]>(
    () =>
      shop
        ? baseProducts.slice(0, 15).map((product, index) => ({
            ...product,
            catalogId: `${shop.id}-${product.id}`,
            stock: 8 + ((index * 7 + shop.id.length) % 29),
          }))
        : [],
    [shop],
  );
  const count = Object.values(cart).reduce((a, b) => a + b, 0),
    total = catalog.reduce((a, p) => a + p.price * (cart[p.catalogId] || 0), 0);
  const results = catalog.filter(
    (p) =>
      (category === "All parts" || p.category === category) &&
      `${p.name} ${p.category} ${p.unit}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const filtered = query.trim() !== "" || category !== "All parts";
  useEffect(() => {
    const sync = () => setShop(readStore());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function writeShop(next: Shop | null) {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("shop", next.id);
    else url.searchParams.delete("shop");
    window.history.pushState(
      { ...window.history.state, wingmanShop: next?.id || null },
      "",
      url,
    );
    setShop(next);
  }
  function enter(next: Shop) {
    if (count && bagShop?.id !== next.id) {
      setPending(next);
      setModal("switch");
      return;
    }
    writeShop(next);
    setQuery("");
    setCategory("All parts");
  }
  function leave() {
    writeShop(null);
    setQuery("");
    setCategory("All parts");
  }
  function changeQuantity(product: Product, delta: number) {
    if (!shop) return;
    const previous = cart[product.catalogId] || 0;
    const next = Math.max(0, Math.min(product.stock, previous + delta));
    if (delta > 0) setBagShop(shop);
    setCart((current) => {
      if (next === 0) {
        const updated = { ...current };
        delete updated[product.catalogId];
        return updated;
      }
      return { ...current, [product.catalogId]: next };
    });
    if (previous === 0 && next === 1)
      notify("Added to your pickup bag. Demo inventory.");
  }
  function productRow(product: Product, featured = false) {
    const quantity = cart[product.catalogId] || 0;
    return (
      <article
        key={product.catalogId}
        className={"retail-product " + (featured ? "featured" : "")}
      >
        <div className="retail-product-copy">
          <span className="overline">{product.category}</span>
          <h3>{product.name}</h3>
          <p>{product.unit}</p>
          <span className="retail-stock">
            <Check size={14} /> Demo stock · Pickup
          </span>
        </div>
        <div className="retail-product-buy">
          <strong>${product.price.toFixed(2)}</strong>
          <small>Demo price</small>
          {quantity === 0 ? (
            <button
              className="secondary"
              onClick={() => changeQuantity(product, 1)}
              aria-label={`Add ${product.name} to pickup bag`}
            >
              <Plus size={16} /> Add
            </button>
          ) : (
            <div
              className="quantity retail-quantity"
              aria-label={`${product.name} quantity`}
            >
              <button
                type="button"
                aria-label={`Decrease ${product.name} quantity`}
                onClick={() => changeQuantity(product, -1)}
              >
                <Minus size={16} />
              </button>
              <span aria-live="polite">{quantity}</span>
              <button
                type="button"
                aria-label={`Increase ${product.name} quantity`}
                onClick={() => changeQuantity(product, 1)}
                disabled={quantity >= product.stock}
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }
  const bagButton = (
    <button
      className="primary retail-bag-button"
      onClick={() => setModal("bag")}
      aria-label={`Your pickup bag, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <ShoppingBag size={18} /> Your bag{" "}
      <span className="count-light" role="status" aria-atomic="true">
        {count}
      </span>
    </button>
  );
  function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bagShop) return;
    const data = new FormData(event.currentTarget),
      contact = String(data.get("contact")),
      phone = String(data.get("phone"));
    const items = catalog
      .filter((product) => cart[product.catalogId])
      .map((product) => ({
        name: product.name,
        quantity: cart[product.catalogId],
        price: product.price,
      }));
    setOrders((current) => [
      {
        id: `PU-${Date.now().toString().slice(-6)}`,
        store: bagShop,
        items,
        total,
        status: 0,
        contact,
        phone,
      },
      ...current,
    ]);
    setCart({});
    setBagShop(null);
    setModal("orders");
    notify("Demo pickup order created. The store has not been contacted.");
  }
  return (
    <div className="retail-marketplace">
      <div className="retail-disclosure">
        <span>Demo inventory</span>
        <p>
          Real store names and locations. Products, prices, stock and pickup
          activity are illustrative. Stores are not participating in Wingman.
        </p>
      </div>
      <div className="retail-utility">
        {shop ? (
          <button className="text-button" onClick={leave}>
            <ArrowLeft size={16} /> Back to all stores
          </button>
        ) : (
          <span>
            <MapPin size={16} /> San Francisco, California
          </span>
        )}
        <button className="text-button" onClick={() => setModal("orders")}>
          Pickup orders {orders.length > 0 && `(${orders.length})`}
          <ArrowUpRight size={16} />
        </button>
      </div>
      {!shop ? (
        <StoreList
          query={storeQuery}
          setQuery={setStoreQuery}
          enter={enter}
          bag={bagButton}
        />
      ) : (
        <>
          <div className="retail-search-row">
            <label className="search-input retail-search">
              <Search size={20} />
              <input
                aria-label="Search parts in this store"
                placeholder={`Search ${shop.name} demo parts…`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button className="text-button" onClick={() => setQuery("")}>
                  Clear
                </button>
              )}
            </label>
            {bagButton}
          </div>
          <div className="filter-row retail-categories">
            {[
              "All parts",
              ...new Set(catalog.map((product) => product.category)),
            ].map((item) => (
              <button
                className={"chip " + (category === item ? "selected" : "")}
                aria-pressed={category === item}
                key={item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {!filtered && (
            <section>
              <div className="retail-section-heading">
                <div>
                  <h2>Store highlights</h2>
                  <p>A few everyday essentials to get you started.</p>
                </div>
                <span>Demo selection</span>
              </div>
              <div className="retail-highlights">
                {catalog
                  .slice(6, 9)
                  .map((product) => productRow(product, true))}
              </div>
            </section>
          )}
          <section>
            <div className="retail-section-heading">
              <h2>
                {filtered ? "Matching parts" : "All parts"}{" "}
                <span>({results.length})</span>
              </h2>
              {filtered && (
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery("");
                    setCategory("All parts");
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
            <div className="retail-product-list">
              {results.map((product) => productRow(product))}
            </div>
            {!results.length && (
              <Empty
                title="No matching parts in this demo"
                text="Try oil, filter, battery, wipers, or clear your filters."
              />
            )}
          </section>
          <p className="retail-fitment">
            Product specifications are illustrative. Vehicle compatibility has
            not been verified. Confirm fitment with the store before any real
            purchase.
          </p>
        </>
      )}
      {modal === "switch" && pending && (
        <Modal
          title="Start a bag at another store?"
          subtitle={`Your current bag contains ${count} item${count === 1 ? "" : "s"} from ${bagShop?.name}. Orders are limited to one store.`}
          onClose={() => {
            setModal("");
            setPending(null);
          }}
        >
          <p>Switching to {pending.name} will clear the current bag.</p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() => {
                setModal("");
                setPending(null);
              }}
            >
              Keep current bag
            </button>
            <button
              className="primary"
              onClick={() => {
                setCart({});
                setBagShop(null);
                writeShop(pending);
                setPending(null);
                setQuery("");
                setCategory("All parts");
                setModal("");
              }}
            >
              Clear bag and switch
            </button>
          </div>
        </Modal>
      )}
      {modal === "bag" && (
        <Modal
          title="Your pickup bag"
          subtitle={
            bagShop
              ? `${bagShop.name} · ${bagShop.branch}`
              : "One store per order · Pickup only"
          }
          wide
          onClose={() => setModal("")}
        >
          {!count ? (
            <Empty
              title="Your bag is empty"
              text="Choose a store and add a few essentials to try pickup checkout."
            />
          ) : (
            <>
              <div className="retail-store-context">
                <MapPin size={20} />
                <div>
                  <strong>Pickup at {bagShop?.name}</strong>
                  <p>{bagShop?.address}</p>
                </div>
              </div>
              <div className="cart-items">
                {catalog
                  .filter((product) => cart[product.catalogId])
                  .map((product) => (
                    <div className="cart-item" key={product.catalogId}>
                      <div>
                        <h3>{product.name}</h3>
                        <p>${product.price.toFixed(2)} each · Demo price</p>
                      </div>
                      <div className="quantity">
                        <button
                          type="button"
                          aria-label={`Decrease ${product.name} quantity`}
                          onClick={() => changeQuantity(product, -1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{cart[product.catalogId]}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${product.name} quantity`}
                          onClick={() => changeQuantity(product, 1)}
                          disabled={cart[product.catalogId] >= product.stock}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <strong>
                        ${(product.price * cart[product.catalogId]).toFixed(2)}
                      </strong>
                    </div>
                  ))}
              </div>
              <div className="cart-total between">
                <strong>Demo subtotal</strong>
                <strong>${total.toFixed(2)}</strong>
              </div>
              <form className="form-grid" onSubmit={placeOrder}>
                <div className="form-columns">
                  <label>
                    Pickup contact
                    <input
                      name="contact"
                      required
                      defaultValue="Jordan Ellis"
                    />
                  </label>
                  <label>
                    Contact phone
                    <input
                      name="phone"
                      type="tel"
                      required
                      defaultValue="415-555-0100"
                    />
                  </label>
                </div>
                <p className="muted">
                  Use sample contact details. No payment is collected, stock
                  reserved, or pickup arranged with the real store.
                </p>
                <button className="primary full">
                  Place demo pickup order <ArrowRight size={17} />
                </button>
              </form>
            </>
          )}
        </Modal>
      )}
      {modal === "orders" && (
        <Modal
          title="Your pickup orders"
          subtitle="Demonstration only. Do not travel to a store for these orders."
          wide
          onClose={() => setModal("")}
        >
          {!orders.length ? (
            <Empty
              title="No pickup orders yet"
              text="Choose a store to try your first demo order."
            />
          ) : (
            orders.map((order) => (
              <article className="retail-order" key={order.id}>
                <div className="between">
                  <h3>{order.id}</h3>
                  <Badge>{stages[order.status]}</Badge>
                </div>
                <strong>
                  {order.store.name} · {order.store.branch}
                </strong>
                <p>{order.store.address}</p>
                <p>
                  Pickup contact: {order.contact} · {order.phone}
                </p>
                <ul>
                  {order.items.map((item) => (
                    <li key={item.name}>
                      {item.quantity} × {item.name}
                    </li>
                  ))}
                </ul>
                <p>Demo subtotal · ${order.total.toFixed(2)}</p>
                <div className="order-steps">
                  {stages.map((stage, index) => (
                    <span
                      key={stage}
                      className={index === order.status ? "active" : ""}
                    >
                      {stage}
                    </span>
                  ))}
                </div>
                {order.status < 3 ? (
                  <button
                    className="text-button"
                    onClick={() =>
                      setOrders((current) =>
                        current.map((item) =>
                          item.id === order.id
                            ? { ...item, status: item.status + 1 }
                            : item,
                        ),
                      )
                    }
                  >
                    Preview next pickup stage <ArrowRight size={15} />
                  </button>
                ) : (
                  <p className="retail-stock">
                    <PackageCheck size={17} /> Demo pickup completed
                  </p>
                )}
              </article>
            ))
          )}
        </Modal>
      )}
    </div>
  );
}

function StoreList({
  query,
  setQuery,
  enter,
  bag,
}: {
  query: string;
  setQuery: (value: string) => void;
  enter: (store: Shop) => void;
  bag: ReactNode;
}) {
  const visible = stores.filter((store) =>
    `${store.name} ${store.address}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <>
      <div className="retail-search-row">
        <label className="search-input retail-search">
          <Search size={18} />
          <input
            aria-label="Search stores"
            placeholder="Search by store name or street"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {bag}
      </div>
      <div className="retail-section-heading">
        <h2>Choose your store</h2>
        <span>Pickup only</span>
      </div>
      <div className="retail-stores">
        {visible.map((store) => (
          <article
            className="retail-store panel"
            key={store.id}
            style={{ "--store-accent": store.accent } as React.CSSProperties}
          >
            <div className="retail-store-wordmark">
              {store.label}
              <span>Auto parts</span>
            </div>
            <div className="retail-store-body">
              <Badge tone="gray">Demo inventory</Badge>
              <h3>{store.name}</h3>
              <p className="retail-branch">{store.branch}</p>
              <p className="retail-address">
                <MapPin size={16} />
                {store.address}
              </p>
              <p>{store.note}</p>
              <button className="primary full" onClick={() => enter(store)}>
                Shop this store <ArrowRight size={17} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <Empty
          title="No stores found"
          text="Try AutoZone, NAPA, O’Reilly, or a San Francisco street name."
        />
      )}
    </>
  );
}
