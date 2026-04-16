import { useState, useEffect } from "react";
import { listRequests, getRequestHistory, submitReview } from "../api/endpoints";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/UI";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import { formatCurrencyUSD } from "../lib/formatters";

export default function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [histories, setHistories] = useState({});

  useEffect(() => {
    listRequests()
      .then((r) => setRequests(r.data))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!histories[id]) {
      const res = await getRequestHistory(id);
      setHistories((h) => ({ ...h, [id]: res.data }));
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">My Jobs</h1>

      {requests.length === 0 ? (
        <EmptyState icon="🔧" title="No requests yet" subtitle="Search for a mechanic to get started" />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id} className="overflow-hidden">
              <div
                className="p-4 cursor-pointer flex items-start justify-between"
                onClick={() => toggleExpand(req.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={req.status} />
                    <span className="text-xs text-gray-400">
                      {new Date(req.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-1 truncate">{req.problem_desc}</p>
                  <p className="text-xs mt-0.5 text-green-600">
                    {req.status === "completed"
                      ? `Final: ${formatCurrencyUSD(req.total_cost || 0)}`
                      : req.estimated_cost
                        ? `Estimate: ${formatCurrencyUSD(req.estimated_cost)}`
                        : "Estimate pending"}
                  </p>
                </div>
                <div className="ml-3 text-gray-400 shrink-0">
                  {expanded === req.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Expanded: status timeline + review */}
              {expanded === req.id && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  <p className="text-xs font-medium text-gray-500 mt-3 mb-2">Status Timeline</p>
                  {histories[req.id] ? (
                    <ol className="relative border-l border-gray-200 ml-2 space-y-3">
                      {histories[req.id].map((u) => (
                        <li key={u.id} className="ml-4">
                          <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-brand-500 border-2 border-white" />
                          <div className="flex items-center gap-2">
                            <StatusBadge status={u.status} />
                            <span className="text-xs text-gray-400">
                              {new Date(u.created_at).toLocaleTimeString("en-IN", {
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {u.note && <p className="text-xs text-gray-500 mt-0.5">{u.note}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Spinner />
                  )}

                  {/* Review section */}
                  {req.status === "completed" && (
                    <ReviewSection requestId={req.id} />
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewSection({ requestId }) {
  const [rating, setRating]   = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (submitted) {
    return <p className="text-xs text-green-600 mt-3">✅ Review submitted. Thank you!</p>;
  }

  const handleSubmit = async () => {
    if (!rating) return;
    setLoading(true);
    try {
      await submitReview({ request_id: requestId, rating, comment });
      setSubmitted(true);
    } catch (e) {
      // Already reviewed or error — silently ignore
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-600 mb-2">Rate this service</p>
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)}>
            <Star
              size={20}
              className={n <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Leave a comment (optional)..."
        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
      />
      <button
        onClick={handleSubmit}
        disabled={!rating || loading}
        className="mt-2 w-full bg-brand-600 text-white text-xs py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-40"
      >
        {loading ? "Submitting..." : "Submit Review"}
      </button>
    </div>
  );
}
