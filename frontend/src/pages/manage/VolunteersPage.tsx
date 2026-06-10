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
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <HandHelping size={22} className="text-violet-500" />
            Volunteers
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Manage volunteer positions and applications for this event.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
                <div className="h-5 bg-slate-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-full mb-1" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
                <div className="flex gap-4 mt-4">
                  <div className="h-4 bg-slate-100 rounded w-16" />
                  <div className="h-4 bg-slate-100 rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasData ? (
          <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <HandHelping size={28} className="text-violet-400" />
            </div>
            <h3 className="text-slate-700 font-semibold mb-2">Volunteer management coming soon</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
              Volunteer positions and applications will appear here once the feature is enabled for this event.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
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
                  className="bg-white rounded-xl border border-slate-100 p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                        <Users size={14} className="text-violet-500" />
                      </div>
                      <h3 className="font-semibold text-slate-800 text-sm">{pos.title}</h3>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      {pos.filled}/{pos.slots}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{pos.description}</p>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        fillPct >= 100 ? "bg-emerald-500" : "bg-violet-400"
                      }`}
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 text-right">
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
