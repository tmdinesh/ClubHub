import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, CheckCircle2, AlertCircle, MessageSquare, Send } from "lucide-react";
import Layout from "@/components/Layout";
import api, { apiError } from "@/lib/api";
import type { Event } from "@/types";

interface Question {
  id: string;
  text: string;
  type: "RATING" | "TEXT";
  order: number;
  is_required: boolean;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  const labels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
  const display = hovered || value;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(n)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px",
              transition: "transform 0.15s",
              transform: hovered === n ? "scale(1.2)" : "scale(1)",
            }}
          >
            <Star
              size={28}
              style={{
                fill: n <= display ? "var(--amber)" : "transparent",
                color: n <= display ? "var(--amber)" : "var(--seam)",
                transition: "fill 0.15s, color 0.15s",
              }}
            />
          </button>
        ))}
        {display > 0 && (
          <span style={{ fontSize: 13, color: "var(--amber)", fontWeight: 600, marginLeft: 4 }}>
            {labels[display]}
          </span>
        )}
      </div>
    </div>
  );
}

function NpsSlider({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const getColor = (n: number) => {
    if (n <= 6) return "var(--cinnabar)";
    if (n <= 8) return "var(--amber)";
    return "var(--jade)";
  };
  const label = value === null ? null : value <= 6 ? "Detractor" : value <= 8 ? "Passive" : "Promoter";

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              border: value === n ? `2px solid ${getColor(n)}` : "1px solid var(--seam)",
              background: value === n
                ? `color-mix(in srgb, ${getColor(n)} 20%, transparent)`
                : "var(--ink-muted)",
              color: value === n ? getColor(n) : "var(--fog)",
              fontWeight: value === n ? 700 : 500,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ash)" }}>
        <span>Not likely</span>
        {label && value !== null && (
          <span style={{ color: getColor(value), fontWeight: 700 }}>{label}</span>
        )}
        <span>Extremely likely</span>
      </div>
    </div>
  );
}

export default function FeedbackForm() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [nps, setNps] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const { data: event } = useQuery<Event>({
    queryKey: ["event-for-feedback", eventId],
    queryFn: () => api.get(`/events/by-id/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: questions = [], isLoading: qLoading } = useQuery<Question[]>({
    queryKey: ["feedback-questions", eventId],
    queryFn: () => api.get(`/events/${eventId}/feedback/questions`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: status, isLoading: statusLoading } = useQuery<{ submitted: boolean }>({
    queryKey: ["feedback-status", eventId],
    queryFn: () => api.get(`/events/${eventId}/feedback/status`).then((r) => r.data),
    enabled: !!eventId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const answers = questions.map((q) => ({
        question_id: q.id,
        value: q.type === "RATING"
          ? ratings[q.id] != null ? String(ratings[q.id]) : null
          : texts[q.id] || null,
      }));
      await api.post(`/events/${eventId}/feedback/submit`, { answers });
      if (nps !== null) {
        await api.post(`/events/${eventId}/nps`, { score: nps });
      }
    },
    onSuccess: () => setDone(true),
    onError: (err) => setError(apiError(err, "Failed to submit feedback.")),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const ratingQs = questions.filter((q) => q.type === "RATING" && q.is_required);
    const missing = ratingQs.find((q) => !ratings[q.id]);
    if (missing) {
      setError("Please rate all required questions.");
      return;
    }
    if (nps === null) {
      setError("Please select an NPS score.");
      return;
    }
    submitMutation.mutate();
  }

  const alreadySubmitted = status?.submitted === true;
  const isLoading = qLoading || statusLoading;

  if (isLoading) {
    return (
      <Layout>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
          {[200, 280, 200].map((w, i) => (
            <div key={i} className="shimmer" style={{ height: 80, marginBottom: 16, borderRadius: 12 }} />
          ))}
        </div>
      </Layout>
    );
  }

  if (alreadySubmitted || done) {
    return (
      <Layout>
        <div style={{
          maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
            background: "color-mix(in srgb, var(--jade) 15%, transparent)",
            border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CheckCircle2 size={32} style={{ color: "var(--jade)" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--cream)", marginBottom: 8 }}>
            {done ? "Thank you!" : "Already submitted"}
          </h1>
          <p style={{ color: "var(--fog)", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
            {done
              ? "Your feedback helps us make every event better. We appreciate you taking the time."
              : "You've already shared your feedback for this event."}
          </p>
          <button type="button" onClick={() => navigate("/dashboard/events")} className="btn-ghost">
            Back to My Events
          </button>
        </div>
      </Layout>
    );
  }

  const ratingQs = questions.filter((q) => q.type === "RATING");
  const textQs = questions.filter((q) => q.type === "TEXT");

  return (
    <Layout>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Header */}
        <div className="animate-fade-up" style={{ marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 700, color: "var(--amber)",
            textTransform: "uppercase", letterSpacing: "0.1em",
            background: "color-mix(in srgb, var(--amber) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--amber) 20%, transparent)",
            padding: "3px 10px", borderRadius: 999, marginBottom: 12,
          }}>
            <MessageSquare size={11} /> Event Feedback
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: "var(--cream)",
            letterSpacing: "-0.02em", marginBottom: 4,
            fontFamily: "'DM Serif Display', serif",
          }}>
            {event?.title ?? "Share Your Feedback"}
          </h1>
          <p style={{ color: "var(--fog)", fontSize: 14 }}>
            Takes about 2 minutes · Your response is anonymous
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* NPS */}
          <div className="animate-fade-up delay-100" style={{
            background: "var(--ink-soft)", border: "1px solid var(--seam)",
            borderRadius: 14, padding: 24,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ash)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              Overall
            </p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--cream)", marginBottom: 16, lineHeight: 1.5 }}>
              How likely are you to recommend this event to a friend or classmate?
            </p>
            <NpsSlider value={nps} onChange={setNps} />
          </div>

          {/* Rating questions */}
          {ratingQs.length > 0 && (
            <div className="animate-fade-up delay-150" style={{
              background: "var(--ink-soft)", border: "1px solid var(--seam)",
              borderRadius: 14, padding: 24,
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ash)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
                Rate the Event
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {ratingQs.map((q) => (
                  <div key={q.id}>
                    <p style={{ fontSize: 14, color: "var(--cream)", marginBottom: 10, lineHeight: 1.5 }}>
                      {q.text}
                      {q.is_required && <span style={{ color: "var(--cinnabar)", marginLeft: 4 }}>*</span>}
                    </p>
                    <StarRating
                      value={ratings[q.id] ?? 0}
                      onChange={(v) => setRatings((r) => ({ ...r, [q.id]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text questions */}
          {textQs.length > 0 && (
            <div className="animate-fade-up delay-200" style={{
              background: "var(--ink-soft)", border: "1px solid var(--seam)",
              borderRadius: 14, padding: 24,
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ash)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
                Open Feedback
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {textQs.map((q) => (
                  <div key={q.id}>
                    <label style={{ fontSize: 14, color: "var(--cream)", display: "block", marginBottom: 8, lineHeight: 1.5 }}>
                      {q.text}
                      <span style={{ color: "var(--fog)", fontSize: 12, marginLeft: 6 }}>(optional)</span>
                    </label>
                    <textarea
                      value={texts[q.id] ?? ""}
                      onChange={(e) => setTexts((t) => ({ ...t, [q.id]: e.target.value }))}
                      rows={3}
                      placeholder="Share your thoughts…"
                      className="input-field"
                      style={{ resize: "vertical", minHeight: 80 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
              background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--cinnabar) 25%, transparent)",
              borderRadius: 10,
            }}>
              <AlertCircle size={15} style={{ color: "var(--cinnabar)", flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: "var(--cinnabar)" }}>{error}</p>
            </div>
          )}

          <div className="animate-fade-up delay-250">
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", padding: "13px 0", fontSize: 15 }}
            >
              <Send size={15} />
              {submitMutation.isPending ? "Submitting…" : "Submit Feedback"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
