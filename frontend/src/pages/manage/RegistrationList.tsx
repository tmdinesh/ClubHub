import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Search, Download, ListChecks, AlertCircle,
  ChevronUp, ChevronDown, Users, Crown, Trash2, CheckCircle2,
} from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Event } from "@/types";
import { fmtDateTimeMedIST } from "@/lib/dateIST";

interface RegistrationDetail {
  id: string;
  event_id: string;
  user_id: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "WAITLISTED";
  registered_at: string;
  confirmed_at: string | null;
  created_at: string;
  participant_name: string;
  participant_email: string;
  team_id: string | null;
  team_name: string | null;
  team_lead_id: string | null;
  is_checked_in: boolean;
}

interface AdminTeamMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminTeamGroup {
  team_id: string;
  team_name: string;
  lead_id: string;
  status: string;
  members: AdminTeamMember[];
}

const STATUS_COLORS: Record<RegistrationDetail["status"], string> = {
  CONFIRMED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  WAITLISTED: "bg-blue-50 text-blue-700 border-blue-200",
  CANCELLED:  "bg-slate-100 text-slate-500 border-slate-200",
};

const ALL_STATUSES: Array<RegistrationDetail["status"] | "ALL"> = [
  "ALL", "CONFIRMED", "PENDING", "WAITLISTED", "CANCELLED",
];

type SortField = "registered_at" | "status" | "participant_name";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "teams";

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[160, 160, 80, 120, 100, 40].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-slate-100 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: SortDir }) {
  if (field !== current) return <ChevronUp size={12} className="text-slate-200 ml-1" />;
  return dir === "asc"
    ? <ChevronUp size={12} className="text-indigo-500 ml-1" />
    : <ChevronDown size={12} className="text-indigo-500 ml-1" />;
}

function TeamsView({ eventId, isTeamEvent, registrations }: { eventId: string; isTeamEvent: boolean; registrations: RegistrationDetail[] }) {
  const { data: groups = [], isLoading } = useQuery<AdminTeamGroup[]>({
    queryKey: ["event-teams-admin", eventId],
    queryFn: () => api.get(`/events/${eventId}/teams/admin`).then((r) => r.data),
    enabled: isTeamEvent,
  });

  // Users in teams (by user_id from team_members)
  const inTeamUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups) for (const m of g.members) ids.add(m.user_id);
    return ids;
  }, [groups]);

  // Registered participants not in any team
  const ungrouped = useMemo(
    () => registrations.filter((r) => !inTeamUserIds.has(r.user_id)),
    [registrations, inTeamUserIds]
  );

  const sorted = useMemo(
    () => [...groups].sort((a, b) => a.team_name.localeCompare(b.team_name)),
    [groups]
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0 && ungrouped.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
        <Users size={32} className="text-slate-200 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">No teams yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sorted.map((group) => (
        <div key={group.team_id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50/60 border-b border-indigo-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Users size={13} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{group.team_name}</p>
              <p className="text-xs text-slate-500">{group.members.length} member{group.members.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {group.members.map((member) => (
                <tr key={member.user_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800 text-sm">{member.name}</p>
                      {member.user_id === group.lead_id && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          <Crown size={9} /> Lead
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{member.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                      {member.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-600">No Team Yet</p>
            <span className="text-xs text-slate-400">({ungrouped.length})</span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-50">
              {ungrouped.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 text-sm">{r.participant_name}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{r.participant_email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {fmtDateTimeMedIST(r.registered_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RegistrationList() {
  const { eventId } = useParams<{ eventId: string }>();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RegistrationDetail["status"] | "ALL">("ALL");
  const [sortField, setSortField] = useState<SortField>("registered_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: event } = useQuery<Event>({
    queryKey: ["event-detail-manage", eventId],
    queryFn: () => api.get(`/events/by-id/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: registrations = [], isLoading, error } = useQuery<RegistrationDetail[]>({
    queryKey: ["event-registrations", eventId],
    queryFn: () => api.get(`/events/${eventId}/registrations`).then((r) => r.data),
    enabled: !!eventId,
  });

  const deleteMutation = useMutation({
    mutationFn: (regId: string) => api.delete(`/registrations/${regId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event-registrations", eventId] });
      setConfirmDeleteId(null);
    },
  });

  const isTeamEvent = event?.is_team_event ?? false;

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    let list = [...registrations];
    if (statusFilter !== "ALL") list = list.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.participant_name.toLowerCase().includes(q) ||
          r.participant_email.toLowerCase().includes(q) ||
          (r.team_name ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "registered_at") {
        cmp = new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime();
      } else if (sortField === "status") {
        cmp = a.status.localeCompare(b.status);
      } else if (sortField === "participant_name") {
        cmp = a.participant_name.localeCompare(b.participant_name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [registrations, statusFilter, search, sortField, sortDir]);

  function exportCSV() {
    const headers = isTeamEvent
      ? "name,email,status,team,registered_at"
      : "name,email,status,registered_at";
    const rows = filtered.map((r) => {
      const base = [
        `"${r.participant_name}"`,
        r.participant_email,
        r.status,
        r.registered_at,
      ];
      if (isTeamEvent) base.splice(3, 0, `"${r.team_name ?? ""}"`);
      return base.join(",");
    });
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${event?.title ?? eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout eventId={eventId}>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <ListChecks size={22} className="text-indigo-500" />
              Registrations
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {isLoading ? "Loading…" : `${filtered.length} of ${registrations.length} registration${registrations.length !== 1 ? "s" : ""}`}
              {statusFilter !== "ALL" ? ` · ${statusFilter}` : ""}
              {isTeamEvent && (
                <span className="ml-2 inline-flex items-center gap-1 text-indigo-600 font-medium">
                  <Users size={12} /> Team Event
                </span>
              )}
            </p>
          </div>
          <button type="button" onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download size={15} />
            Export CSV
          </button>
        </div>

        {/* View mode toggle (team events only) */}
        {isTeamEvent && (
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg mb-4 w-fit">
            {(["list", "teams"] as ViewMode[]).map((m) => (
              <button key={m} type="button" onClick={() => setViewMode(m)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}>
                {m === "list" ? "All Participants" : "By Team"}
              </button>
            ))}
          </div>
        )}

        {/* Filters (list view only) */}
        {viewMode === "list" && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or team…"
                className="pl-8 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-64" />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {ALL_STATUSES.map((s) => (
                <button type="button" key={s}
                  onClick={() => setStatusFilter(s as RegistrationDetail["status"] | "ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {error ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Failed to load registrations.</p>
          </div>
        ) : viewMode === "teams" ? (
          <TeamsView eventId={eventId!} isTeamEvent={isTeamEvent} registrations={registrations} />
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700"
                      onClick={() => toggleSort("participant_name")}>
                      <span className="flex items-center">
                        Name <SortIcon field="participant_name" current={sortField} dir={sortDir} />
                      </span>
                    </th>
                    {isTeamEvent && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Team
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700"
                      onClick={() => toggleSort("status")}>
                      <span className="flex items-center">
                        Status <SortIcon field="status" current={sortField} dir={sortDir} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700"
                      onClick={() => toggleSort("registered_at")}>
                      <span className="flex items-center">
                        Registered <SortIcon field="registered_at" current={sortField} dir={sortDir} />
                      </span>
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={isTeamEvent ? 5 : 4} className="px-4 py-12 text-center">
                        <ListChecks size={32} className="text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm">
                          {search ? `No registrations match "${search}".` : "No registrations found."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-800 text-sm">{reg.participant_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{reg.participant_email}</p>
                        </td>
                        {isTeamEvent && (
                          <td className="px-4 py-3.5">
                            {reg.team_name ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                <Users size={10} /> {reg.team_name}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">No team yet</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1.5">
                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border w-fit ${STATUS_COLORS[reg.status]}`}>
                              {reg.status}
                            </span>
                            {reg.is_checked_in && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full w-fit">
                                <CheckCircle2 size={10} /> Checked In
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">
                          {fmtDateTimeMedIST(reg.registered_at)}
                        </td>
                        <td className="px-4 py-3.5">
                          {confirmDeleteId === reg.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Delete?</span>
                              <button type="button"
                                onClick={() => deleteMutation.mutate(reg.id)}
                                disabled={deleteMutation.isPending}
                                className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">
                                Yes
                              </button>
                              <button type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-700">
                                No
                              </button>
                            </div>
                          ) : (
                            <button type="button"
                              onClick={() => setConfirmDeleteId(reg.id)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
