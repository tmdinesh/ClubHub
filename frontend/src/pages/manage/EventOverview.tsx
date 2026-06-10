import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Users,
  CheckCircle,
  Activity,
  UserCheck,
  Wallet,
  Star,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";

interface EventAnalytics {
  registrations: { total: number; confirmed: number };
  attendance: { present: number; rate: number };
  teams: { total: number; avg_size: number };
  feedback: { nps: number | null };
  finance: { budget: number; spent: number; utilization: number };
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  sub?: string;
  highlight?: boolean;
}

function StatCard({ label, value, icon, iconBg, iconColor, sub, highlight }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl border p-5 hover:shadow-sm transition-shadow ${highlight ? "border-indigo-100 ring-1 ring-indigo-100" : "border-slate-100"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
        {highlight && (
          <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
            KEY
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-slate-800 tracking-tight mb-1">{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-slate-100 mb-3" />
      <div className="h-8 bg-slate-100 rounded w-20 mb-1" />
      <div className="h-4 bg-slate-100 rounded w-28" />
    </div>
  );
}

export default function EventOverview() {
  const { eventId } = useParams<{ eventId: string }>();

  const { data, isLoading, error } = useQuery<EventAnalytics>({
    queryKey: ["analytics", "event", eventId],
    queryFn: () => api.get(`/analytics/events/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
  });

  const confirmationRate = data
    ? Math.round((data.registrations.confirmed / Math.max(data.registrations.total, 1)) * 100)
    : 0;

  const attendancePct = data ? (data.attendance.rate * 100).toFixed(1) : "0.0";
  const utilizationPct = data ? (data.finance.utilization * 100).toFixed(1) : "0.0";

  return (
    <Layout eventId={eventId}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-7">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
            Event Overview
          </p>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Activity size={22} className="text-indigo-500" />
            Event Statistics
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Live snapshot for event <span className="font-mono text-slate-600">{eventId}</span>.
          </p>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Failed to load analytics for this event.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonStat key={i} />)
            ) : data ? (
              <>
                <StatCard
                  label="Total Registrations"
                  value={data.registrations.total.toLocaleString()}
                  icon={<Users size={18} />}
                  iconBg="bg-indigo-50"
                  iconColor="text-indigo-600"
                  highlight
                />
                <StatCard
                  label="Confirmed"
                  value={data.registrations.confirmed.toLocaleString()}
                  icon={<CheckCircle size={18} />}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-600"
                  sub={`${confirmationRate}% confirmation rate`}
                />
                <StatCard
                  label="Attendance Rate"
                  value={`${attendancePct}%`}
                  icon={<UserCheck size={18} />}
                  iconBg="bg-sky-50"
                  iconColor="text-sky-600"
                  sub="of confirmed attendees"
                />
                <StatCard
                  label="Teams"
                  value={data.teams.total.toLocaleString()}
                  icon={<Users size={18} />}
                  iconBg="bg-violet-50"
                  iconColor="text-violet-600"
                />
                <StatCard
                  label="Budget Utilization"
                  value={`${utilizationPct}%`}
                  icon={<Wallet size={18} />}
                  iconBg={data.finance.utilization > 0.9 ? "bg-red-50" : "bg-amber-50"}
                  iconColor={data.finance.utilization > 0.9 ? "text-red-600" : "text-amber-600"}
                  sub={data.finance.utilization > 0.9 ? "Near limit" : "Within budget"}
                />
                <StatCard
                  label="NPS Score"
                  value={data.feedback.nps !== null ? data.feedback.nps.toFixed(1) : "—"}
                  icon={<Star size={18} />}
                  iconBg="bg-yellow-50"
                  iconColor="text-yellow-600"
                  sub={data.feedback.nps !== null ? "Net Promoter Score" : "Not yet collected"}
                />
              </>
            ) : null}
          </div>
        )}

        {/* Quick progress bar */}
        {data && (
          <div className="mt-6 bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <TrendingUp size={14} className="text-indigo-500" />
                Registration Funnel
              </h2>
              <span className="text-xs text-slate-400">Confirmed vs Total</span>
            </div>
            <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(confirmationRate, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-xs text-indigo-600 font-medium">
                {data.registrations.confirmed} confirmed
              </span>
              <span className="text-xs text-slate-400">
                {data.registrations.total} total
              </span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
