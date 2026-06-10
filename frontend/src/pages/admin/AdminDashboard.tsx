import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  BarChart3, Users, CalendarDays, Ticket, TrendingUp,
  Plus, Pencil, Check, X, ChevronDown, Loader2,
} from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Club } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformAnalytics {
  total_events: number;
  total_users: number;
  total_registrations: number;
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  club_id: string | null;
  is_active: boolean;
}

const ALL_ROLES = [
  "PARTICIPANT",
  "ATTENDANCE_TEAM",
  "CLUB_ADMIN",
  "FACULTY_ADVISOR",
  "SUPER_ADMIN",
];

const TREND_DATA = [
  { month: "Jan", events: 4, users: 38, registrations: 120 },
  { month: "Feb", events: 6, users: 55, registrations: 180 },
  { month: "Mar", events: 8, users: 82, registrations: 270 },
  { month: "Apr", events: 5, users: 60, registrations: 200 },
  { month: "May", events: 11, users: 140, registrations: 420 },
  { month: "Jun", events: 9, users: 110, registrations: 340 },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function BigStat({ value, label, icon, bg, iconColor }: {
  value: string | number; label: string; icon: React.ReactNode; bg: string; iconColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 ${bg} opacity-40`} />
      <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center mb-4 relative z-10`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <p className="text-4xl font-bold text-slate-800 tracking-tight mb-1 relative z-10">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-sm font-medium text-slate-600 relative z-10">{label}</p>
    </div>
  );
}

// ── Platform Metrics tab ──────────────────────────────────────────────────────

function MetricsTab() {
  const { data, isLoading } = useQuery<PlatformAnalytics>({
    queryKey: ["analytics", "platform"],
    queryFn: () => api.get("/analytics/platform").then((r) => r.data),
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse h-36" />
          ))
        ) : (
          <>
            <BigStat value={data?.total_events ?? 0} label="Total Events" icon={<CalendarDays size={20} />} bg="bg-indigo-50" iconColor="text-indigo-600" />
            <BigStat value={data?.total_users ?? 0} label="Registered Users" icon={<Users size={20} />} bg="bg-emerald-50" iconColor="text-emerald-600" />
            <BigStat value={data?.total_registrations ?? 0} label="Total Registrations" icon={<Ticket size={20} />} bg="bg-amber-50" iconColor="text-amber-600" />
          </>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <TrendingUp size={15} className="text-indigo-500" />
            Platform Activity Trend
          </h2>
          <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">Sample data</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={TREND_DATA} margin={{ top: 0, right: 0, bottom: 0, left: -15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Bar dataKey="registrations" name="Registrations" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="users" name="New Users" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── User Management tab ───────────────────────────────────────────────────────

function UserManagementTab({ clubs }: { clubs: Club[] }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editClubId, setEditClubId] = useState<string>("");
  const [newUser, setNewUser] = useState({ email: "", name: "", role: "CLUB_ADMIN", club_id: "" });

  const { data: users, isLoading } = useQuery<UserRecord[]>({
    queryKey: ["admin", "users"],
    queryFn: () => api.get("/admin/users").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post("/admin/users", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setShowCreate(false);
      setNewUser({ email: "", name: "", role: "CLUB_ADMIN", club_id: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: string; club_id?: string | null }) =>
      api.patch(`/admin/users/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingId(null);
    },
  });

  function startEdit(u: UserRecord) {
    setEditingId(u.id);
    setEditRole(u.role);
    setEditClubId(u.club_id ?? "");
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, role: editRole, club_id: editClubId || null });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold text-slate-800">All Users</h2>
        <button type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} />
          Create User
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-indigo-100 ring-1 ring-indigo-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">New User</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="Email *"
              value={newUser.email}
              onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input
              type="text"
              placeholder="Full name *"
              value={newUser.name}
              onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {newUser.role === "CLUB_ADMIN" && (
              <select
                value={newUser.club_id}
                onChange={(e) => setNewUser((p) => ({ ...p, club_id: e.target.value }))}
                className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="">Assign to club…</option>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-slate-500 px-3 py-1.5 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="button"
              onClick={() => createMutation.mutate({ ...newUser, club_id: newUser.club_id || null })}
              disabled={!newUser.email || !newUser.name || createMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                {["Name", "Email", "Role", "Club", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : users?.map((u) => {
                const clubName = clubs.find((c) => c.id === u.club_id)?.name;
                const isEditing = editingId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-slate-800">{u.name}</td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white"
                        >
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">{u.role}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <select
                          value={editClubId}
                          onChange={(e) => setEditClubId(e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white"
                        >
                          <option value="">None</option>
                          {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-500">{clubName ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => saveEdit(u.id)} disabled={updateMutation.isPending} className="p-1 rounded text-emerald-600 hover:bg-emerald-50">
                            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="p-1 rounded text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => startEdit(u)} className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Club Setup tab ────────────────────────────────────────────────────────────

function ClubSetupTab({ clubs }: { clubs: Club[]; }) {
  const qc = useQueryClient();
  const [editingClubId, setEditingClubId] = useState<string | null>(null);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [newClub, setNewClub] = useState({ name: "", description: "", department: "" });

  const { data: advisors } = useQuery<UserRecord[]>({
    queryKey: ["admin", "users", "FACULTY_ADVISOR"],
    queryFn: () => api.get("/admin/users", { params: { role: "FACULTY_ADVISOR" } }).then((r) => r.data),
  });

  const createClubMutation = useMutation({
    mutationFn: (body: object) => api.post("/clubs", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "clubs"] });
      qc.invalidateQueries({ queryKey: ["clubs"] });
      setShowCreate(false);
      setNewClub({ name: "", description: "", department: "" });
    },
  });

  const updateClubMutation = useMutation({
    mutationFn: ({ clubId, faculty_advisor_id }: { clubId: string; faculty_advisor_id: string | null }) =>
      api.patch(`/admin/clubs/${clubId}`, { faculty_advisor_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "clubs"] });
      setEditingClubId(null);
    },
  });

  function startEditClub(club: Club) {
    setEditingClubId(club.id);
    setSelectedAdvisorId(club.faculty_advisor_id ?? "");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">Clubs</h2>
        <button type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} />
          Create Club
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-indigo-100 ring-1 ring-indigo-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">New Club</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Club name *"
              value={newClub.name}
              onChange={(e) => setNewClub((p) => ({ ...p, name: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input
              type="text"
              placeholder="Department (e.g. CSE)"
              value={newClub.department}
              onChange={(e) => setNewClub((p) => ({ ...p, department: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newClub.description}
              onChange={(e) => setNewClub((p) => ({ ...p, description: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-slate-500 px-3 py-1.5 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="button"
              onClick={() => createClubMutation.mutate({
                name: newClub.name,
                description: newClub.description || null,
                department: newClub.department || null,
              })}
              disabled={!newClub.name.trim() || createClubMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createClubMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/60 border-b border-slate-100">
                {["Club", "Department", "Faculty Advisor", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clubs.map((club) => {
                const advisorName = advisors?.find((a) => a.id === club.faculty_advisor_id)?.name;
                const isEditing = editingClubId === club.id;
                return (
                  <tr key={club.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-slate-800">{club.name}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{club.department ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <select
                          value={selectedAdvisorId}
                          onChange={(e) => setSelectedAdvisorId(e.target.value)}
                          className="text-sm px-2 py-1.5 rounded border border-slate-200 bg-white min-w-[200px]"
                        >
                          <option value="">No advisor</option>
                          {advisors?.map((a) => (
                            <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                          ))}
                        </select>
                      ) : advisorName ? (
                        <span className="text-sm font-medium text-slate-700">{advisorName}</span>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex gap-1.5">
                          <button type="button"
                            onClick={() => updateClubMutation.mutate({ clubId: club.id, faculty_advisor_id: selectedAdvisorId || null })}
                            disabled={updateClubMutation.isPending}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
                          >
                            {updateClubMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button type="button" onClick={() => setEditingClubId(null)} className="p-1 rounded text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => startEditClub(club)} className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {clubs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">No clubs found. Create clubs first.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main AdminDashboard ───────────────────────────────────────────────────────

type Tab = "metrics" | "users" | "clubs";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "metrics", label: "Platform Metrics", icon: <BarChart3 size={15} /> },
  { key: "users", label: "User Management", icon: <Users size={15} /> },
  { key: "clubs", label: "Club Setup", icon: <CalendarDays size={15} /> },
];

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as Tab) ?? "metrics";

  function setTab(tab: Tab) {
    setSearchParams({ tab });
  }

  const { data: clubs = [] } = useQuery<Club[]>({
    queryKey: ["admin", "clubs"],
    queryFn: () => api.get("/admin/clubs").then((r) => r.data),
  });

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <BarChart3 size={22} className="text-indigo-500" />
            Admin Dashboard
          </h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-8 w-fit">
          {TABS.map((t) => (
            <button type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "metrics" && <MetricsTab />}
        {activeTab === "users" && <UserManagementTab clubs={clubs} />}
        {activeTab === "clubs" && <ClubSetupTab clubs={clubs} />}
      </div>
    </Layout>
  );
}
