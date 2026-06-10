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
  Building2, ChevronRight, Activity,
} from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Club } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClubSummary {
  club_id: string;
  club_name: string;
  department: string | null;
  total_events: number;
  published_events: number;
  total_registrations: number;
  events: ClubEvent[];
}

interface ClubEvent {
  id: string;
  title: string;
  status: string;
  start_datetime: string | null;
  category: string | null;
}

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

function BigStat({ value, label, icon, iconColor, accentColor }: {
  value: string | number; label: string; icon: React.ReactNode; iconColor: string; accentColor: string;
}) {
  return (
    <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 opacity-10"
        style={{ background: accentColor }}
      />
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 relative z-10"
        style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
      >
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <p className="text-4xl font-bold tracking-tight mb-1 relative z-10" style={{ color: "var(--cream)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-sm font-medium relative z-10" style={{ color: "var(--fog)" }}>{label}</p>
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
            <div key={i} className="rounded-2xl p-6 animate-pulse h-36" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }} />
          ))
        ) : (
          <>
            <BigStat value={data?.total_events ?? 0} label="Total Events" icon={<CalendarDays size={20} />} iconColor="#F5A623" accentColor="#F5A623" />
            <BigStat value={data?.total_users ?? 0} label="Registered Users" icon={<Users size={20} />} iconColor="#3DD68C" accentColor="#3DD68C" />
            <BigStat value={data?.total_registrations ?? 0} label="Total Registrations" icon={<Ticket size={20} />} iconColor="#F5A623" accentColor="#F5A623" />
          </>
        )}
      </div>
      <div className="rounded-2xl p-6" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--fog)" }}>
            <TrendingUp size={15} style={{ color: "var(--amber)" }} />
            Platform Activity Trend
          </h2>
          <span
            className="text-xs px-2 py-1 rounded-full"
            style={{ color: "var(--dust)", background: "var(--ink-muted)", border: "1px solid var(--seam)" }}
          >
            Sample data
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={TREND_DATA} margin={{ top: 0, right: 0, bottom: 0, left: -15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3040" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#7A8699" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#7A8699" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#161A23", border: "1px solid #2A3040", color: "#F5F0E8", borderRadius: 10, fontSize: 12 }} />
            <Bar dataKey="registrations" name="Registrations" fill="#F5A623" radius={[4, 4, 0, 0]} />
            <Bar dataKey="users" name="New Users" fill="#7A5210" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── User Management tab ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--ink-muted)",
  border: "1px solid var(--seam)",
  color: "var(--cream)",
};

function focusInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--amber)";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
  e.currentTarget.style.outline = "none";
}

function blurInput(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--seam)";
  e.currentTarget.style.boxShadow = "none";
}

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
        <h2 className="text-base font-semibold" style={{ color: "var(--cream)" }}>All Users</h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: "var(--amber)", color: "var(--ink)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
        >
          <Plus size={14} />
          Create User
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl p-5" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--fog)" }}>New User</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="Email *"
              value={newUser.email}
              onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <input
              type="text"
              placeholder="Full name *"
              value={newUser.name}
              onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            >
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {newUser.role === "CLUB_ADMIN" && (
              <select
                value={newUser.club_id}
                onChange={(e) => setNewUser((p) => ({ ...p, club_id: e.target.value }))}
                className="text-sm px-3 py-2 rounded-lg"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              >
                <option value="">Assign to club…</option>
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--ash)", border: "1px solid var(--seam)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createMutation.mutate({ ...newUser, club_id: newUser.club_id || null })}
              disabled={!newUser.email || !newUser.name || createMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: "var(--amber)", color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
            >
              {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--ink-muted)", borderBottom: "1px solid var(--seam)" }}>
                {["Name", "Email", "Role", "Club", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse" style={{ borderBottom: "1px solid var(--seam)" }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="h-4 rounded w-24" style={{ background: "var(--ink-muted)" }} /></td>
                    ))}
                  </tr>
                ))
              ) : users?.map((u) => {
                const clubName = clubs.find((c) => c.id === u.club_id)?.name;
                const isEditing = editingId === u.id;
                return (
                  <tr
                    key={u.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--seam)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-3.5 font-medium" style={{ color: "var(--cream)" }}>{u.name}</td>
                    <td className="px-4 py-3.5 font-mono text-xs" style={{ color: "var(--fog)" }}>{u.email}</td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)" }}
                        >
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                            color: "var(--amber)",
                          }}
                        >
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <select
                          value={editClubId}
                          onChange={(e) => setEditClubId(e.target.value)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)" }}
                        >
                          <option value="">None</option>
                          {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--fog)" }}>{clubName ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEdit(u.id)}
                            disabled={updateMutation.isPending}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--jade)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--jade) 12%, transparent)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--ash)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="p-1 rounded transition-colors"
                          style={{ color: "var(--ash)" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--amber)";
                            e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 10%, transparent)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--ash)";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
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
        <h2 className="text-base font-semibold" style={{ color: "var(--cream)" }}>Clubs</h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: "var(--amber)", color: "var(--ink)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
        >
          <Plus size={14} />
          Create Club
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl p-5" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--fog)" }}>New Club</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Club name *"
              value={newClub.name}
              onChange={(e) => setNewClub((p) => ({ ...p, name: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <input
              type="text"
              placeholder="Department (e.g. CSE)"
              value={newClub.department}
              onChange={(e) => setNewClub((p) => ({ ...p, department: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newClub.description}
              onChange={(e) => setNewClub((p) => ({ ...p, description: e.target.value }))}
              className="text-sm px-3 py-2 rounded-lg"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-sm px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "var(--ash)", border: "1px solid var(--seam)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createClubMutation.mutate({
                name: newClub.name,
                description: newClub.description || null,
                department: newClub.department || null,
              })}
              disabled={!newClub.name.trim() || createClubMutation.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: "var(--amber)", color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
            >
              {createClubMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Create
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--ink-muted)", borderBottom: "1px solid var(--seam)" }}>
                {["Club", "Department", "Faculty Advisor", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clubs.map((club) => {
                const advisorName = advisors?.find((a) => a.id === club.faculty_advisor_id)?.name;
                const isEditing = editingClubId === club.id;
                return (
                  <tr
                    key={club.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--seam)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 3%, transparent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td className="px-4 py-3.5 font-medium" style={{ color: "var(--cream)" }}>{club.name}</td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: "var(--fog)" }}>{club.department ?? "—"}</td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <select
                          value={selectedAdvisorId}
                          onChange={(e) => setSelectedAdvisorId(e.target.value)}
                          className="text-sm px-2 py-1.5 rounded min-w-[200px]"
                          style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)", color: "var(--cream)" }}
                        >
                          <option value="">No advisor</option>
                          {advisors?.map((a) => (
                            <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                          ))}
                        </select>
                      ) : advisorName ? (
                        <span className="text-sm font-medium" style={{ color: "var(--fog)" }}>{advisorName}</span>
                      ) : (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                            color: "var(--amber)",
                            border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
                          }}
                        >
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateClubMutation.mutate({ clubId: club.id, faculty_advisor_id: selectedAdvisorId || null })}
                            disabled={updateClubMutation.isPending}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--jade)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--jade) 12%, transparent)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {updateClubMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingClubId(null)}
                            className="p-1 rounded transition-colors"
                            style={{ color: "var(--ash)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditClub(club)}
                          className="p-1 rounded transition-colors"
                          style={{ color: "var(--ash)" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--amber)";
                            e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 10%, transparent)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--ash)";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {clubs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm" style={{ color: "var(--dust)" }}>No clubs found. Create clubs first.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Club Analytics tab ────────────────────────────────────────────────────────

const EVENT_STATUS_STYLE: Record<string, React.CSSProperties> = {
  DRAFT:            { background: "color-mix(in srgb, var(--dust) 20%, transparent)", color: "var(--ash)" },
  PENDING_APPROVAL: { background: "color-mix(in srgb, var(--amber) 15%, transparent)", color: "var(--amber)" },
  PUBLISHED:        { background: "color-mix(in srgb, var(--jade) 15%, transparent)", color: "var(--jade)" },
  COMPLETED:        { background: "color-mix(in srgb, var(--sky) 15%, transparent)", color: "var(--sky)" },
  ARCHIVED:         { background: "color-mix(in srgb, var(--dust) 20%, transparent)", color: "var(--dust)" },
};

function ClubCard({ club }: { club: ClubSummary }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
      {/* Club header row */}
      <button
        type="button"
        className="w-full flex items-center gap-4 p-5 text-left transition-colors"
        onClick={() => setExpanded((v) => !v)}
        onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cream) 2%, transparent)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "color-mix(in srgb, var(--amber) 12%, transparent)" }}
        >
          <Building2 size={18} style={{ color: "var(--amber)" }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate" style={{ color: "var(--cream)" }}>
            {club.club_name}
          </p>
          {club.department && (
            <p className="text-xs mt-0.5" style={{ color: "var(--dust)" }}>{club.department}</p>
          )}
        </div>

        <div className="flex items-center gap-6 shrink-0 mr-2">
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "var(--cream)" }}>{club.total_events}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Events</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "var(--jade)" }}>{club.published_events}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Published</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: "var(--sky)" }}>{club.total_registrations.toLocaleString()}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Registrations</p>
          </div>
        </div>

        <ChevronRight
          size={16}
          style={{
            color: "var(--ash)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 200ms",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Events drill-down */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--seam)" }}>
          {club.events.length === 0 ? (
            <p className="px-5 py-4 text-sm" style={{ color: "var(--dust)" }}>No events yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ink-muted)" }}>
                  {["Event", "Status", "Date", "Category"].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {club.events.map((ev) => (
                  <tr
                    key={ev.id}
                    style={{ borderTop: "1px solid var(--seam)" }}
                  >
                    <td className="px-5 py-3 font-medium" style={{ color: "var(--cream)" }}>{ev.title}</td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={EVENT_STATUS_STYLE[ev.status] ?? {}}
                      >
                        {ev.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--fog)" }}>
                      {ev.start_datetime
                        ? new Date(ev.start_datetime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--fog)" }}>{ev.category ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function ClubAnalyticsTab() {
  const { data: clubs, isLoading, error } = useQuery<ClubSummary[]>({
    queryKey: ["analytics", "all-clubs"],
    queryFn: () => api.get("/analytics/clubs").then((r) => r.data),
  });

  const totalEvents = clubs?.reduce((s, c) => s + c.total_events, 0) ?? 0;
  const totalRegistrations = clubs?.reduce((s, c) => s + c.total_registrations, 0) ?? 0;

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={14} style={{ color: "var(--amber)" }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Clubs</p>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--cream)" }}>{clubs?.length ?? "—"}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={14} style={{ color: "var(--jade)" }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Total Events</p>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--cream)" }}>{isLoading ? "—" : totalEvents}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Ticket size={14} style={{ color: "var(--sky)" }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>Total Registrations</p>
          </div>
          <p className="text-3xl font-bold" style={{ color: "var(--cream)" }}>{isLoading ? "—" : totalRegistrations.toLocaleString()}</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl p-5" style={{ background: "color-mix(in srgb, var(--cinnabar) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--cinnabar) 25%, transparent)" }}>
          <p className="text-sm" style={{ color: "var(--cinnabar)" }}>Failed to load club analytics.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} style={{ color: "var(--amber)" }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--dust)" }}>
              Click a club to see its events
            </p>
          </div>
          {clubs?.map((club) => (
            <ClubCard key={club.club_id} club={club} />
          ))}
          {clubs?.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: "var(--dust)" }}>No clubs found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main AdminDashboard ───────────────────────────────────────────────────────

type Tab = "metrics" | "users" | "clubs" | "analytics";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "metrics",   label: "Platform Metrics", icon: <BarChart3 size={15} /> },
  { key: "analytics", label: "Club Analytics",   icon: <Building2 size={15} /> },
  { key: "users",     label: "User Management",  icon: <Users size={15} /> },
  { key: "clubs",     label: "Club Setup",        icon: <CalendarDays size={15} /> },
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
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--dust)" }}>Admin</p>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--cream)" }}>
            <BarChart3 size={22} style={{ color: "var(--amber)" }} />
            Admin Dashboard
          </h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-xl mb-8 w-fit" style={{ background: "var(--ink-muted)" }}>
          {TABS.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                activeTab === t.key
                  ? { background: "var(--ink-soft)", color: "var(--cream)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                  : { color: "var(--fog)" }
              }
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "metrics" && <MetricsTab />}
        {activeTab === "analytics" && <ClubAnalyticsTab />}
        {activeTab === "users" && <UserManagementTab clubs={clubs} />}
        {activeTab === "clubs" && <ClubSetupTab clubs={clubs} />}
      </div>
    </Layout>
  );
}
