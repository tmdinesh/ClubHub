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

function teamStatusBadgeStyle(type: Team["status"]): React.CSSProperties {
  switch (type) {
    case "FORMING":
      return {
        background: "color-mix(in srgb, var(--amber) 15%, transparent)",
        color: "var(--amber)",
        border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
      };
    case "READY":
      return {
        background: "color-mix(in srgb, var(--jade) 15%, transparent)",
        color: "var(--jade)",
        border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
      };
    case "SUBMITTED":
      return {
        background: "color-mix(in srgb, var(--amber) 12%, transparent)",
        color: "var(--amber)",
        border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)",
      };
    case "DISQUALIFIED":
      return {
        background: "color-mix(in srgb, var(--cinnabar) 15%, transparent)",
        color: "var(--cinnabar)",
        border: "1px solid color-mix(in srgb, var(--cinnabar) 30%, transparent)",
      };
  }
}

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
    <div
      className="rounded-xl p-5 transition-shadow hover:shadow-sm"
      style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "color-mix(in srgb, var(--amber) 12%, transparent)",
              color: "var(--amber)",
            }}
          >
            <Users size={15} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm" style={{ color: "var(--cream)" }}>{team.name}</h3>
              {isLead && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    color: "var(--amber)",
                    background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
                  }}
                >
                  <Crown size={9} /> Lead
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: "var(--fog)" }}>{team.eventTitle}</p>
          </div>
        </div>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={teamStatusBadgeStyle(team.status)}
        >
          {team.status}
        </span>
      </div>

      {/* Size info */}
      <div
        className="flex items-center gap-3 text-xs pb-3 mb-3"
        style={{ color: "var(--fog)", borderBottom: "1px solid var(--seam)" }}
      >
        <span>
          <span className="font-medium" style={{ color: "var(--cream)" }}>Size: </span>
          {team.min_size}–{team.max_size}
        </span>
        <span>
          <span className="font-medium" style={{ color: "var(--cream)" }}>Members: </span>
          {members.length} / {team.max_size}
        </span>
      </div>

      {/* Members list */}
      {members.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "var(--ink-muted)" }}
                >
                  <span className="text-[9px] font-bold" style={{ color: "var(--fog)" }}>{m.name[0]}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate" style={{ color: "var(--cream)" }}>{m.name}</span>
                    {m.role === "LEAD" && (
                      <Crown size={9} className="shrink-0" style={{ color: "var(--amber)" }} />
                    )}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: "var(--fog)" }}>{m.email}</p>
                </div>
              </div>
              {isLead && m.user_id !== userId && (
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(m.user_id)}
                  disabled={removeMutation.isPending}
                  className="text-[10px] transition-colors flex items-center gap-0.5 shrink-0 ml-2"
                  style={{ color: "var(--cinnabar)", opacity: 0.7 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
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
        <div
          className="rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-2"
          style={{ background: "var(--ink-muted)" }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-medium" style={{ color: "var(--fog)" }}>Join Key (share with teammates)</p>
            <p className="font-mono text-sm font-bold tracking-widest" style={{ color: "var(--cream)" }}>
              {team.join_key}
            </p>
          </div>
          <button
            type="button"
            onClick={copyKey}
            className="transition-colors shrink-0"
            style={{ color: "var(--ash)" }}
            title="Copy key"
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--amber)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ash)")}
          >
            {copied ? <Check size={14} style={{ color: "var(--jade)" }} /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {/* Lead actions */}
      {isLead && (team.status === "READY" || team.status === "FORMING") && (
        <div className="pt-2" style={{ borderTop: "1px solid var(--seam)" }}>
          <button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
            style={{ background: "var(--amber)", color: "var(--ink)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
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
  const [joinInputFocused, setJoinInputFocused] = useState(false);

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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--cream)" }}>
            <Users size={22} style={{ color: "var(--amber)" }} />
            My Teams
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>
            Teams you belong to across team events.
          </p>
        </div>

        {/* Join by key */}
        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
        >
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: "var(--cream)" }}>
            <Key size={14} style={{ color: "var(--amber)" }} />
            Join a Team
          </h2>
          <p className="text-xs mb-3" style={{ color: "var(--fog)" }}>
            Enter the 8-character join key your team lead shared with you.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinKey}
              onChange={(e) => { setJoinKey(e.target.value.toUpperCase()); setJoinKeyMsg(null); }}
              placeholder="e.g. XK9MABCD"
              maxLength={8}
              className="flex-1 text-sm px-3 py-2.5 rounded-lg focus:outline-none font-mono uppercase tracking-widest"
              style={{
                background: "var(--ink-muted)",
                border: joinInputFocused ? "1px solid var(--amber)" : "1px solid var(--seam)",
                boxShadow: joinInputFocused ? "0 0 0 3px rgba(245,166,35,0.12)" : "none",
                color: "var(--cream)",
              }}
              onFocus={() => setJoinInputFocused(true)}
              onBlur={() => setJoinInputFocused(false)}
            />
            <button
              type="button"
              onClick={() => joinKey.trim() && joinKeyMutation.mutate(joinKey.trim())}
              disabled={!joinKey.trim() || joinKeyMutation.isPending}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
              style={{ background: "var(--amber)", color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
            >
              {joinKeyMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Join
            </button>
          </div>
          {joinKeyMsg?.ok && (
            <p className="mt-2 text-sm flex items-center gap-1.5" style={{ color: "var(--jade)" }}>
              <CheckCircle size={13} /> {joinKeyMsg.ok}
            </p>
          )}
          {joinKeyMsg?.err && (
            <p className="mt-2 text-sm flex items-center gap-1.5" style={{ color: "var(--cinnabar)" }}>
              <AlertCircle size={13} /> {joinKeyMsg.err}
            </p>
          )}
        </div>

        {/* Teams */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-5 animate-pulse h-32"
                style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
              />
            ))}
          </div>
        ) : !teams || teams.length === 0 ? (
          <div
            className="rounded-xl p-12 text-center"
            style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
          >
            <Users size={40} className="mx-auto mb-4" style={{ color: "var(--ash)" }} />
            <p className="font-medium" style={{ color: "var(--fog)" }}>No teams yet</p>
            <p className="text-sm mt-1" style={{ color: "var(--ash)" }}>
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
