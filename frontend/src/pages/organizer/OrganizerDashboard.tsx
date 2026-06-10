import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, AlertCircle, Clock, CheckCircle, Send, BarChart3 } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Event } from "@/types";
import { fmtDateTimeMedIST } from "@/lib/dateIST";

const STATUS_COLORS: Record<string, string> = {
  DRAFT:            "bg-slate-100 text-slate-600 border-slate-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  PUBLISHED:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED:        "bg-blue-50 text-blue-700 border-blue-200",
  ARCHIVED:         "bg-slate-50 text-slate-400 border-slate-100",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  DRAFT:            <Clock size={12} />,
  PENDING_APPROVAL: <Send size={12} />,
  PUBLISHED:        <CheckCircle size={12} />,
  COMPLETED:        <BarChart3 size={12} />,
};

const ROLE_LABEL: Record<string, string> = {
  ATTENDANCE_TEAM: "Attendance Team",
};

export default function OrganizerDashboard() {
  const { user } = useAuthStore();
  const roleLabel = ROLE_LABEL[user?.role ?? ""] ?? user?.role ?? "";

  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ["events", "assigned"],
    queryFn: () => api.get("/events/assigned").then((r) => r.data),
  });

  return (
    <Layout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
            {roleLabel}
          </p>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <CalendarDays size={22} className="text-indigo-500" />
            Assigned Events
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Events where you have been assigned as an organizer.
          </p>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Failed to load assigned events.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse h-20" />
            ))}
          </div>
        ) : !events?.length ? (
          <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
            <CalendarDays size={32} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No events assigned yet</p>
            <p className="text-sm text-slate-400 mt-1">
              A Club Admin needs to assign you to an event before it appears here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{event.title}</p>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[event.status] ?? ""}`}>
                        {STATUS_ICON[event.status]}
                        {event.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {event.start_datetime
                        ? fmtDateTimeMedIST(event.start_datetime)
                        : "No date set"}
                      {event.venue ? ` · ${event.venue}` : ""}
                    </p>
                  </div>
                  <Link
                    to={`/manage/${event.id}/overview`}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors shrink-0"
                  >
                    Manage
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
