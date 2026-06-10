import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Radio, UserCheck, UserX, Users, AlertCircle,
  Plus, MapPin, Loader2, Download,
} from "lucide-react";
import Layout from "@/components/Layout";
import api, { apiError } from "@/lib/api";
import type { AttendanceDashboard as AttendanceData } from "@/types";

interface Checkpoint {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  order: number;
}

interface AttendanceResponse extends AttendanceData {
  checkpoints?: Checkpoint[];
}

interface PresentUser {
  user_id: string;
  name: string;
  email: string;
  team_name?: string;
}

function MiniStat({ icon, value, label, color, bg }: {
  icon: React.ReactNode; value: number | string;
  label: string; color: string; bg: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl ${bg} border border-white/60`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color} bg-white/70 shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs text-slate-600 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function exportXlsx(present: PresentUser[], eventTitle: string) {
  const headers = ["Name", "Email", "Team"];
  const rows = present.map((p) => [p.name, p.email, p.team_name ?? ""]);
  const csvContent = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${eventTitle || "event"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AttendanceDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();

  const [newCpName, setNewCpName] = useState("");
  const [cpError, setCpError] = useState("");

  const { data, isLoading, error, dataUpdatedAt } = useQuery<AttendanceResponse>({
    queryKey: ["attendance", eventId],
    queryFn: () => api.get(`/events/${eventId}/attendance`).then((r) => r.data),
    enabled: !!eventId,
    refetchInterval: 30_000,
  });

  const { data: checkpoints = [], isLoading: loadingCps } = useQuery<Checkpoint[]>({
    queryKey: ["checkpoints", eventId],
    queryFn: () =>
      api.get(`/events/${eventId}/checkpoints`)
        .then((r) => r.data.sort((a: Checkpoint, b: Checkpoint) => a.order - b.order)),
    enabled: !!eventId,
  });

  const { data: present = [], isLoading: loadingPresent } = useQuery<PresentUser[]>({
    queryKey: ["present-users", eventId],
    queryFn: () => api.get(`/events/${eventId}/attendance/present`).then((r) => r.data),
    enabled: !!eventId,
    refetchInterval: 30_000,
  });

  const createCpMutation = useMutation({
    mutationFn: (name: string) =>
      api.post(`/events/${eventId}/checkpoints`, { name, order: checkpoints.length + 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkpoints", eventId] });
      setNewCpName("");
      setCpError("");
    },
    onError: (err) => setCpError(apiError(err, "Failed to create checkpoint.")),
  });

  function handleCreateCp(e: React.FormEvent) {
    e.preventDefault();
    if (!newCpName.trim()) return;
    createCpMutation.mutate(newCpName.trim());
  }

  const attendanceRate = data
    ? ((data.present / Math.max(data.registered, 1)) * 100).toFixed(1)
    : "0.0";
  const progressPct = data
    ? Math.min((data.present / Math.max(data.registered, 1)) * 100, 100)
    : 0;
  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "—";

  return (
    <Layout eventId={eventId}>
      <div className="p-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Radio size={22} className="text-emerald-500" />
              Live Attendance
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Refreshes every 30s · Last updated: {lastUpdate}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center gap-3 mb-6">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Failed to load attendance data.</p>
          </div>
        )}

        {/* Checkpoints */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <MapPin size={14} className="text-indigo-500" />
                Checkpoints
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Attendance takers must select a checkpoint before scanning.
              </p>
            </div>
          </div>
          <form onSubmit={handleCreateCp} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newCpName}
              onChange={(e) => { setNewCpName(e.target.value); setCpError(""); }}
              placeholder="e.g. Main Entrance, Hall A, Gate 2…"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              type="submit"
              disabled={!newCpName.trim() || createCpMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {createCpMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </form>
          {cpError && (
            <p className="text-xs text-red-600 mb-3 flex items-center gap-1">
              <AlertCircle size={11} /> {cpError}
            </p>
          )}
          {loadingCps ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : checkpoints.length === 0 ? (
            <div className="text-center py-6 bg-amber-50 border border-amber-100 rounded-xl">
              <MapPin size={24} className="text-amber-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-amber-700">No checkpoints yet</p>
              <p className="text-xs text-amber-600 mt-1">Add at least one — attendance takers need a checkpoint to scan against.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {checkpoints.map((cp, idx) => (
                <div key={cp.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{cp.name}</span>
                  </div>
                  <span className="text-xs text-slate-400">Checkpoint {idx + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overall stats */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 mb-5">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Overall Attendance</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {isLoading ? "…" : `${data?.present ?? 0} present out of ${data?.registered ?? 0} registered`}
              </p>
            </div>
            <span className="text-3xl font-bold text-slate-800">
              {isLoading ? "—" : `${attendanceRate}%`}
            </span>
          </div>
          {isLoading ? (
            <div className="h-5 bg-slate-100 rounded-full animate-pulse" />
          ) : (
            <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
              {progressPct >= 20 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white drop-shadow">{attendanceRate}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))
          ) : (
            <>
              <MiniStat icon={<UserCheck size={16} />} value={data?.present ?? 0} label="Present" color="text-emerald-600" bg="bg-emerald-50" />
              <MiniStat icon={<UserX size={16} />} value={data?.absent ?? 0} label="Absent" color="text-red-500" bg="bg-red-50" />
              <MiniStat icon={<Users size={16} />} value={data?.registered ?? 0} label="Registered" color="text-indigo-600" bg="bg-indigo-50" />
            </>
          )}
        </div>

        {/* Present participants list */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <UserCheck size={14} className="text-emerald-500" />
              Present Participants ({present.length})
            </h2>
            {present.length > 0 && (
              <button
                type="button"
                onClick={() => exportXlsx(present, `event-${eventId}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download size={13} /> Export CSV
              </button>
            )}
          </div>
          {loadingPresent ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-32" />
                  <div className="h-4 bg-slate-100 rounded w-40" />
                </div>
              ))}
            </div>
          ) : present.length === 0 ? (
            <div className="px-4 py-10 text-center text-slate-400 text-sm">
              No participants scanned present yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Team</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {present.map((p) => (
                  <tr key={p.user_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800 text-sm">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.email}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.team_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
