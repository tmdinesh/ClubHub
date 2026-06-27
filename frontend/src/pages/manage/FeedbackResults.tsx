import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { MessageSquare, Star, Users, TrendingUp, AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

interface QuestionResult {
  id: string;
  text: string;
  type: "RATING" | "TEXT";
  order: number;
  response_count: number;
  avg?: number | null;
  distribution?: Record<string, number>;
  responses?: string[];
}

interface FeedbackResults {
  form_id: string;
  total_responses: number;
  questions: QuestionResult[];
}

interface NpsData {
  nps: number | null;
  total: number;
  promoters: number;
  detractors: number;
  passives: number;
}

function StarBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: "var(--ink-muted)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: "linear-gradient(90deg, var(--amber-dim), var(--amber))",
          borderRadius: 99, transition: "width 0.6s cubic-bezier(.22,.68,0,1.2)",
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--amber)", width: 28 }}>
        {value.toFixed(1)}
      </span>
      <div style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={12} style={{
            fill: n <= Math.round(value) ? "var(--amber)" : "transparent",
            color: n <= Math.round(value) ? "var(--amber)" : "var(--seam)",
          }} />
        ))}
      </div>
    </div>
  );
}

function NpsGauge({ nps, total, promoters, detractors, passives }: NpsData & { nps: number }) {
  const pPct = total ? Math.round((promoters / total) * 100) : 0;
  const dPct = total ? Math.round((detractors / total) * 100) : 0;
  const paPct = total ? Math.round((passives / total) * 100) : 0;

  const npsColor = nps >= 50 ? "var(--jade)" : nps >= 0 ? "var(--amber)" : "var(--cinnabar)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 52, fontWeight: 700, color: npsColor, letterSpacing: "-0.04em", lineHeight: 1 }}>
          {nps > 0 ? "+" : ""}{nps}
        </span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fog)" }}>Net Promoter Score</p>
          <p style={{ fontSize: 12, color: "var(--ash)" }}>{total} response{total !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Stacked bar */}
      <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", gap: 2 }}>
        <div style={{ width: `${pPct}%`, background: "var(--jade)", transition: "width 0.6s" }} />
        <div style={{ width: `${paPct}%`, background: "var(--amber)", transition: "width 0.6s" }} />
        <div style={{ width: `${dPct}%`, background: "var(--cinnabar)", transition: "width 0.6s" }} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {[
          { label: "Promoters", value: promoters, pct: pPct, color: "var(--jade)" },
          { label: "Passives", value: passives, pct: paPct, color: "var(--amber)" },
          { label: "Detractors", value: detractors, pct: dPct, color: "var(--cinnabar)" },
        ].map(({ label, value, pct, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--fog)" }}>
              {label} <strong style={{ color: "var(--cream)" }}>{value}</strong>
              <span style={{ color: "var(--ash)", marginLeft: 4 }}>({pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionBars({ dist }: { dist: Record<string, number> }) {
  const max = Math.max(...Object.values(dist), 1);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 40, marginTop: 8 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const count = dist[String(n)] ?? 0;
        const pct = (count / max) * 100;
        return (
          <div key={n} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 10, color: "var(--ash)" }}>{count}</span>
            <div style={{
              width: "100%", height: `${Math.max(pct, 4)}%`, minHeight: 3,
              background: n >= 4 ? "var(--jade)" : n === 3 ? "var(--amber)" : "var(--cinnabar)",
              borderRadius: "3px 3px 0 0", transition: "height 0.5s",
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Star size={9} style={{ fill: "var(--amber)", color: "var(--amber)" }} />
              <span style={{ fontSize: 10, color: "var(--fog)" }}>{n}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FeedbackResults() {
  const { eventId } = useParams<{ eventId: string }>();

  const { data: results, isLoading: rLoading, error: rError } = useQuery<FeedbackResults>({
    queryKey: ["feedback-results", eventId],
    queryFn: () => api.get(`/events/${eventId}/feedback/results`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: npsData, isLoading: nLoading } = useQuery<NpsData>({
    queryKey: ["nps", eventId],
    queryFn: () => api.get(`/events/${eventId}/nps`).then((r) => r.data),
    enabled: !!eventId,
  });

  const isLoading = rLoading || nLoading;

  return (
    <Layout eventId={eventId}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ash)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Manage Event
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--cream)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquare size={22} style={{ color: "var(--amber)" }} />
            Feedback Results
          </h1>
          {results && (
            <p style={{ color: "var(--fog)", marginTop: 4, fontSize: 14 }}>
              {results.total_responses} response{results.total_responses !== 1 ? "s" : ""} collected
            </p>
          )}
        </div>

        {rError ? (
          <div style={{
            background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--cinnabar) 25%, transparent)",
            borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", gap: 12,
          }}>
            <AlertCircle size={18} style={{ color: "var(--cinnabar)", flexShrink: 0 }} />
            <p style={{ fontSize: 14, color: "var(--cinnabar)" }}>
              No feedback data yet — feedback form is created when the event is marked complete.
            </p>
          </div>
        ) : isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer" style={{ height: 120, borderRadius: 14 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* NPS card */}
            {npsData && npsData.total > 0 && npsData.nps !== null && (
              <div style={{
                background: "var(--ink-soft)", border: "1px solid var(--seam)",
                borderRadius: 14, padding: 24,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <TrendingUp size={15} style={{ color: "var(--amber)" }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--fog)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Recommendation Score
                  </p>
                </div>
                <NpsGauge {...npsData} nps={npsData.nps} />
              </div>
            )}

            {npsData && npsData.total === 0 && (
              <div style={{
                background: "var(--ink-soft)", border: "1px solid var(--seam)",
                borderRadius: 14, padding: 24, textAlign: "center",
              }}>
                <Users size={28} style={{ color: "var(--seam)", margin: "0 auto 8px" }} />
                <p style={{ color: "var(--ash)", fontSize: 14 }}>No responses yet.</p>
              </div>
            )}

            {/* Rating questions */}
            {results?.questions.filter(q => q.type === "RATING").map((q) => (
              <div key={q.id} style={{
                background: "var(--ink-soft)", border: "1px solid var(--seam)",
                borderRadius: 14, padding: 24,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ash)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                  Rating · {q.response_count} response{q.response_count !== 1 ? "s" : ""}
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--cream)", marginBottom: 16, lineHeight: 1.5 }}>
                  {q.text}
                </p>
                {q.avg != null ? (
                  <>
                    <StarBar value={q.avg} />
                    {q.distribution && <DistributionBars dist={q.distribution} />}
                  </>
                ) : (
                  <p style={{ color: "var(--ash)", fontSize: 13 }}>No responses yet.</p>
                )}
              </div>
            ))}

            {/* Text questions */}
            {results?.questions.filter(q => q.type === "TEXT").map((q) => (
              <div key={q.id} style={{
                background: "var(--ink-soft)", border: "1px solid var(--seam)",
                borderRadius: 14, padding: 24,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ash)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                  Open Response · {q.response_count} response{q.response_count !== 1 ? "s" : ""}
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--cream)", marginBottom: 16, lineHeight: 1.5 }}>
                  {q.text}
                </p>
                {q.responses && q.responses.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {q.responses.map((r, i) => (
                      <div key={i} style={{
                        background: "var(--ink-muted)", border: "1px solid var(--seam)",
                        borderRadius: 8, padding: "10px 14px",
                        fontSize: 14, color: "var(--cream)", lineHeight: 1.6,
                      }}>
                        {r}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--ash)", fontSize: 13 }}>No text responses yet.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
