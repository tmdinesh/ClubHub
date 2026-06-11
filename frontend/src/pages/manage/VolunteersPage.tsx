import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { HandHelping, Users, Clock } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

interface VolunteerPosition {
  id: string;
  title: string;
  description: string;
  slots: number;
  filled: number;
}

interface VolunteerApplication {
  id: string;
  user_id: string;
  position_id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  applied_at: string;
}

export default function VolunteersPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const { data: positions, isLoading } = useQuery<VolunteerPosition[]>({
    queryKey: ["volunteers", "positions", eventId],
    queryFn: () => api.get(`/events/${eventId}/volunteer-positions`).then((r) => r.data),
    enabled: !!eventId,
    retry: false,
  });

  const hasData = positions && positions.length > 0;

  return (
    <Layout eventId={eventId}>
      <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold tracking-tight flex items-center gap-2"
            style={{ color: "var(--cream)" }}
          >
            <HandHelping size={22} style={{ color: "var(--amber)" }} />
            Volunteers
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>
            Manage volunteer positions and applications for this event.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-5 animate-pulse"
                style={{
                  background: "var(--ink-soft)",
                  border: "1px solid var(--seam)",
                }}
              >
                <div className="h-5 rounded w-1/2 mb-2" style={{ background: "var(--ink-muted)" }} />
                <div className="h-3 rounded w-full mb-1" style={{ background: "var(--ink-muted)" }} />
                <div className="h-3 rounded w-2/3" style={{ background: "var(--ink-muted)" }} />
                <div className="flex gap-4 mt-4">
                  <div className="h-4 rounded w-16" style={{ background: "var(--ink-muted)" }} />
                  <div className="h-4 rounded w-16" style={{ background: "var(--ink-muted)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : !hasData ? (
          <div
            className="rounded-xl p-16 text-center"
            style={{
              background: "var(--ink-soft)",
              border: "1px solid var(--seam)",
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: "color-mix(in srgb, var(--amber) 15%, transparent)",
              }}
            >
              <HandHelping size={28} style={{ color: "var(--amber)" }} />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: "var(--fog)" }}>
              Volunteer management coming soon
            </h3>
            <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: "var(--dust)" }}>
              Volunteer positions and applications will appear here once the feature is enabled for this event.
            </p>
            <div
              className="mt-6 flex items-center justify-center gap-2 text-xs"
              style={{ color: "var(--dust)" }}
            >
              <Clock size={13} />
              <span>Feature in development</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {positions.map((pos) => {
              const fillPct = Math.min((pos.filled / Math.max(pos.slots, 1)) * 100, 100);
              return (
                <div
                  key={pos.id}
                  className="rounded-xl p-5 transition-all"
                  style={{
                    background: "var(--ink-soft)",
                    border: "1px solid var(--seam)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                        }}
                      >
                        <Users size={14} style={{ color: "var(--amber)" }} />
                      </div>
                      <h3 className="font-semibold text-sm" style={{ color: "var(--cream)" }}>
                        {pos.title}
                      </h3>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "var(--fog)" }}>
                      {pos.filled}/{pos.slots}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--fog)" }}>
                    {pos.description}
                  </p>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--ink-muted)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${fillPct}%`,
                        background: fillPct >= 100 ? "var(--jade)" : "var(--amber)",
                      }}
                    />
                  </div>
                  <p className="text-[11px] mt-1 text-right" style={{ color: "var(--dust)" }}>
                    {fillPct.toFixed(0)}% filled
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
