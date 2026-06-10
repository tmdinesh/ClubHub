import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, Key, CheckCircle, AlertCircle, Loader2,
  Trophy, Crown, UserMinus, Copy, Check,
} from "lucide-react";
import Layout from "@/components/Layout";
import api, { apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Registration, Team } from "@/types";

const TEAM_STATUS_COLORS: Record<Team["status"], string> = {
  FORMING:      "bg-amber-50 text-amber-700 border-amber-200",
  READY:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  SUBMITTED:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  DISQUALIFIED: "bg-red-50 text-red-600 border-red-200",
};

interface TeamMemberInfo { user_id: string; name: string; email: string; role: string; }

interface TeamWithMeta extends Team {
  eventTitle: string;
  eventId: string;
}

function TeamCard({ team, userId }: { team: TeamWithMeta; userId: string }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const isLead = team.lead_id === userId;

  const { data: members = [] } = useQuery<TeamMemberInfo[]>({
    queryKey: ["team-members", team.id],
    queryFn: () => api.get(`/teams/${team.id}/members`).then((r) => r.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/teams/${team.id}/members/${memberId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-teams-event", team.eventId] });
      qc.invalidateQueries({ queryKey: ["team-members", team.id] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/teams/${team.id}/submit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-teams-event", team.eventId] }),
  });

  function copyKey() {
    if (!team.join_key) return;
    navigator.clipboard.writeText(team.join_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Users size={15} className="text-indigo-500" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-slate-800 text-sm">{team.name}</h3>
              {isLead && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <Crown size={9} /> Lead
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">{team.eventTitle}</p>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TEAM_STATUS_COLORS[team.status]}`}>
          {team.status}
        </span>
      </div>

      {/* Size info */}
      <div className="flex items-center gap-3 text-xs text-slate-500 pb-3 border-b border-slate-50 mb-3">
        <span><span className="font-medium text-slate-700">Size: </span>{team.min_size}–{team.max_size}</span>
        <span><span className="font-medium text-slate-700">Members: </span>{members.length} / {team.max_size}</span>
      </div>

      {/* Members list */}
      {members.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-bold text-slate-500">{m.name[0]}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-700 font-medium truncate">{m.name}</span>
                    {m.role === "LEAD" && (
                      <Crown size={9} className="text-amber-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 truncate">{m.email}</p>
                </div>
              </div>
              {isLead && m.user_id !== userId && (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(m.user_id)}
                  disabled={removeMutation.isPending}
                  className="text-[10px] text-red-400 hover:text-red-600 transition-colors flex items-center gap-0.5 shrink-0 ml-2"
                >
                  <UserMinus size={10} /> Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Join key (lead only) */}
      {isLead && team.join_key && (
        <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-600 font-medium">Join Key (share with teammates)</p>
            <p className="font-mono text-sm font-bold text-slate-800 tracking-widest">{team.join_key}</p>
          </div>
          <button
            type="button"
            onClick={copyKey}
            className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
            title="Copy key"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {/* Lead actions */}
      {isLead && (team.status === "READY" || team.status === "FORMING") && (
        <div className="pt-2 border-t border-slate-50">
          <button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={12} />}
            Submit Team
          </button>
        </div>
      )}
    </div>
  );
}

export default function MyTeams() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [joinKey, setJoinKey] = useState("");
  const [joinKeyMsg, setJoinKeyMsg] = useState<{ ok?: string; err?: string } | null>(null);

  const { data: registrations, isLoading: loadingRegs } = useQuery<Registration[]>({
    queryKey: ["registrations", "me"],
    queryFn: () => api.get("/registrations/me").then((r) => r.data),
  });

  const teamEventRegs = registrations?.filter((r) =>
    r.status === "CONFIRMED" || r.status === "WAITLISTED"
  ) ?? [];

  const eventIds = teamEventRegs.map((r) => r.event_id);
  const eventIdsKey = [...eventIds].sort().join(",");
  const eventTitleMap = Object.fromEntries(
    (registrations ?? []).map((r) => [r.event_id, r.event_title])
  );

  const { data: teams, isLoading: loadingTeams } = useQuery<TeamWithMeta[]>({
    queryKey: ["my-teams", eventIdsKey],
    enabled: eventIds.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const results: TeamWithMeta[] = [];
      for (const eventId of eventIds) {
        try {
          const resp = await api.get<Team[]>(`/events/${eventId}/teams/me`);
          for (const t of resp.data) {
            results.push({ ...t, eventId, eventTitle: eventTitleMap[eventId] ?? eventId });
          }
        } catch {
          // not a team event or no teams — skip
        }
      }
      return results;
    },
  });

  const joinKeyMutation = useMutation({
    mutationFn: (key: string) => api.post("/teams/join-by-key", { join_key: key }),
    onSuccess: () => {
      setJoinKeyMsg({ ok: "Joined team successfully!" });
      setJoinKey("");
      queryClient.invalidateQueries({ queryKey: ["my-teams"] });
      queryClient.invalidateQueries({ queryKey: ["my-teams-event"] });
    },
    onError: (err) => setJoinKeyMsg({ err: apiError(err, "Invalid join key.") }),
  });

  const isLoading = loadingRegs || loadingTeams;

  return (
    <Layout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users size={22} className="text-indigo-500" />
            My Teams
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            Teams you belong to across team events.
          </p>
        </div>

        {/* Join by key */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
            <Key size={14} className="text-indigo-500" />
            Join a Team
          </h2>
          <p className="text-xs text-slate-600 mb-3">
            Enter the 8-character join key your team lead shared with you.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinKey}
              onChange={(e) => { setJoinKey(e.target.value.toUpperCase()); setJoinKeyMsg(null); }}
              placeholder="e.g. XK9MABCD"
              maxLength={8}
              className="flex-1 text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-400 font-mono uppercase tracking-widest text-slate-900"
            />
            <button
              type="button"
              onClick={() => joinKey.trim() && joinKeyMutation.mutate(joinKey.trim())}
              disabled={!joinKey.trim() || joinKeyMutation.isPending}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {joinKeyMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Join
            </button>
          </div>
          {joinKeyMsg?.ok && (
            <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1.5">
              <CheckCircle size={13} /> {joinKeyMsg.ok}
            </p>
          )}
          {joinKeyMsg?.err && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle size={13} /> {joinKeyMsg.err}
            </p>
          )}
        </div>

        {/* Teams */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse h-32" />
            ))}
          </div>
        ) : !teams || teams.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-12 text-center">
            <Users size={40} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No teams yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Enter a join key above, or register for a team event and create a team from the event page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} userId={user?.id ?? ""} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
