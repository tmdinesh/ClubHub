import { useState, useMemo } from "react";
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarDays, QrCode, X, AlertCircle, Search,
  Users, Plus, ChevronRight, Loader2, CheckCircle, Crown,
  Globe, Copy, Check, KeyRound,
} from "lucide-react";
import Layout from "@/components/Layout";
import api, { apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Registration, Team } from "@/types";
import { fmtDateIST } from "@/lib/dateIST";

// Status badge inline style helpers
function statusBadgeStyle(type: "CONFIRMED" | "PENDING" | "WAITLISTED" | "CANCELLED"): React.CSSProperties {
  switch (type) {
    case "CONFIRMED":
      return {
        background: "color-mix(in srgb, var(--jade) 15%, transparent)",
        color: "var(--jade)",
        border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
      };
    case "PENDING":
      return {
        background: "color-mix(in srgb, var(--amber) 15%, transparent)",
        color: "var(--amber)",
        border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
      };
    case "WAITLISTED":
      return {
        background: "color-mix(in srgb, var(--sky) 15%, transparent)",
        color: "var(--sky)",
        border: "1px solid color-mix(in srgb, var(--sky) 30%, transparent)",
      };
    case "CANCELLED":
      return {
        background: "color-mix(in srgb, var(--ash) 15%, transparent)",
        color: "var(--ash)",
        border: "1px solid color-mix(in srgb, var(--ash) 30%, transparent)",
      };
  }
}

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

// ── Copy-to-clipboard button ──────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button type="button" onClick={copy}
      className="p-1 rounded transition-colors"
      style={{ color: "var(--ash)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--amber)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ash)")}>
      {copied
        ? <Check size={13} style={{ color: "var(--jade)" }} />
        : <Copy size={13} />}
    </button>
  );
}

// ── Own-team card ─────────────────────────────────────────────────────────

function MyTeamCard({
  team, isLead, onRefresh,
}: { team: Team; isLead: boolean; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [inviteInputFocused, setInviteInputFocused] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: (email: string) => api.post(`/teams/${team.id}/invite`, { email }),
    onSuccess: (res) => { setInviteToken(res.data.token); setInviteEmail(""); setInviteError(""); },
    onError: (err) => { setInviteError(apiError(err, "Failed.")); setInviteToken(null); },
  });

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/teams/${team.id}/submit`),
    onSuccess: onRefresh,
  });

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: "color-mix(in srgb, var(--amber) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--amber)", color: "var(--ink)" }}
          >
            <Users size={13} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold" style={{ color: "var(--cream)" }}>{team.name}</span>
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
              <span
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={
                  team.is_public
                    ? {
                        color: "var(--jade)",
                        background: "color-mix(in srgb, var(--jade) 15%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
                      }
                    : {
                        color: "var(--fog)",
                        background: "var(--ink-muted)",
                        border: "1px solid var(--seam)",
                      }
                }
              >
                {team.is_public ? <><Globe size={9} /> Public</> : <>Private</>}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--fog)" }}>
              {team.member_count} of {team.max_size} members · min {team.min_size}
            </p>
          </div>
        </div>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={teamStatusBadgeStyle(team.status)}
        >
          {team.status}
        </span>
      </div>

      {/* Join key (lead only, private team) */}
      {isLead && !team.is_public && team.join_key && (
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
        >
          <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: "var(--fog)" }}>
            <KeyRound size={11} style={{ color: "var(--amber)" }} /> Join Key — share this with teammates
          </p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold tracking-widest select-all" style={{ color: "var(--amber)" }}>
              {team.join_key}
            </span>
            <CopyButton text={team.join_key} />
          </div>
        </div>
      )}

      {/* Lead actions */}
      {isLead && team.status !== "SUBMITTED" && team.status !== "DISQUALIFIED" && (
        <div className="space-y-2">
          {/* Email invite (still available for both public and private) */}
          {team.member_count < team.max_size && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--fog)" }}>Invite by email</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteToken(null); setInviteError(""); }}
                  placeholder="teammate@college.edu"
                  className="flex-1 text-sm px-3 py-1.5 rounded-lg focus:outline-none"
                  style={{
                    background: "var(--ink-soft)",
                    border: inviteInputFocused ? "1px solid var(--amber)" : "1px solid var(--seam)",
                    boxShadow: inviteInputFocused ? "0 0 0 3px rgba(245,166,35,0.12)" : "none",
                    color: "var(--cream)",
                  }}
                  onFocus={() => setInviteInputFocused(true)}
                  onBlur={() => setInviteInputFocused(false)}
                />
                <button
                  type="button"
                  onClick={() => inviteEmail && inviteMutation.mutate(inviteEmail)}
                  disabled={!inviteEmail || inviteMutation.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1"
                  style={{ background: "var(--amber)", color: "var(--ink)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
                >
                  {inviteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                  Send
                </button>
              </div>
              {inviteToken && (
                <div
                  className="mt-2 rounded-lg p-2.5"
                  style={{
                    background: "var(--ink-soft)",
                    border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
                  }}
                >
                  <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: "var(--jade)" }}>
                    <CheckCircle size={11} /> Invitation token — share with teammate:
                  </p>
                  <div className="flex items-center gap-1">
                    <p
                      className="text-xs font-mono break-all select-all rounded px-2 py-1.5 flex-1"
                      style={{ color: "var(--cream)", background: "var(--ink-muted)" }}
                    >
                      {inviteToken}
                    </p>
                    <CopyButton text={inviteToken} />
                  </div>
                </div>
              )}
              {inviteError && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--cinnabar)" }}>
                  <AlertCircle size={11} /> {inviteError}
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          {(team.status === "READY" || team.status === "FORMING") && (
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || team.member_count < team.min_size}
              title={team.member_count < team.min_size ? `Need ${team.min_size - team.member_count} more member(s)` : ""}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
              style={{ background: "var(--jade)", color: "var(--ink)" }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
            >
              {submitMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              Submit Team
              {team.member_count < team.min_size && (
                <span className="opacity-75">({team.min_size - team.member_count} more needed)</span>
              )}
            </button>
          )}
        </div>
      )}

      {!isLead && team.status === "SUBMITTED" && (
        <p className="text-xs flex items-center gap-1" style={{ color: "var(--jade)" }}>
          <CheckCircle size={11} /> Team submitted.
        </p>
      )}
    </div>
  );
}

// ── Team panel ────────────────────────────────────────────────────────────

function TeamPanel({ reg }: { reg: Registration }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<"my" | "browse">("my");
  const [teamName, setTeamName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [createError, setCreateError] = useState("");
  const [teamNameFocused, setTeamNameFocused] = useState(false);

  const { data: myTeams = [], isLoading: loadingMy } = useQuery<Team[]>({
    queryKey: ["my-teams-event", reg.event_id],
    queryFn: () => api.get(`/events/${reg.event_id}/teams/me`).then((r) => r.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 8000,
  });

  const { data: allTeams = [], isLoading: loadingAll } = useQuery<Team[]>({
    queryKey: ["all-teams-event", reg.event_id],
    queryFn: () => api.get(`/events/${reg.event_id}/teams`).then((r) => r.data),
    enabled: tab === "browse",
  });

  function invalidateTeams() {
    qc.invalidateQueries({ queryKey: ["my-teams-event", reg.event_id] });
    qc.invalidateQueries({ queryKey: ["all-teams-event", reg.event_id] });
    qc.invalidateQueries({ queryKey: ["registrations", "me"] });
  }

  const createMutation = useMutation({
    mutationFn: () => api.post(`/events/${reg.event_id}/teams`, {
      name: teamName.trim(),
      min_size: reg.team_min_size,
      max_size: reg.team_max_size,
      is_public: isPublic,
    }),
    onSuccess: () => {
      invalidateTeams();
      setTeamName("");
      setCreateError("");
    },
    onError: (err) => setCreateError(apiError(err, "Failed to create team.")),
  });

  const joinPublicMutation = useMutation({
    mutationFn: (teamId: string) => api.post(`/teams/${teamId}/join`),
    onSuccess: () => invalidateTeams(),
    onError: (err) => alert(apiError(err, "Failed to join team.")),
  });

  const myTeamIds = new Set(myTeams.map((t) => t.id));
  const joinablePublic = allTeams.filter(
    (t) => !myTeamIds.has(t.id) && t.is_public &&
      t.status !== "SUBMITTED" && t.status !== "DISQUALIFIED" &&
      t.member_count < t.max_size
  );

  function onRefresh() {
    invalidateTeams();
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--seam)" }}>
      {/* Tab bar */}
      <div className="flex gap-1 p-0.5 rounded-lg mb-3 w-fit" style={{ background: "var(--ink-muted)" }}>
        {(["my", "browse"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
            style={
              tab === t
                ? { background: "var(--ink-soft)", color: "var(--cream)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }
                : { color: "var(--fog)" }
            }
            onMouseEnter={(e) => { if (tab !== t) e.currentTarget.style.color = "var(--cream)"; }}
            onMouseLeave={(e) => { if (tab !== t) e.currentTarget.style.color = "var(--fog)"; }}
          >
            {t === "my" ? "My Team" : "Browse / Join"}
          </button>
        ))}
      </div>

      {/* ── My team ── */}
      {tab === "my" && (
        <div className="space-y-3">
          {loadingMy ? (
            <div className="h-12 rounded-lg animate-pulse" style={{ background: "var(--ink-muted)" }} />
          ) : myTeams.length === 0 ? (
            <div>
              <p className="text-xs mb-3" style={{ color: "var(--fog)" }}>
                You're not in a team yet. Create one, or browse public teams and join — or enter a private team's key.
              </p>

              {/* Visibility toggle */}
              <div className="flex items-center gap-3 mb-3">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={
                    isPublic
                      ? { background: "var(--jade)", color: "var(--ink)", border: "1px solid var(--jade)" }
                      : { background: "var(--ink-soft)", color: "var(--fog)", border: "1px solid var(--seam)" }
                  }
                  onMouseEnter={(e) => { if (!isPublic) e.currentTarget.style.background = "var(--ink-muted)"; }}
                  onMouseLeave={(e) => { if (!isPublic) e.currentTarget.style.background = "var(--ink-soft)"; }}
                >
                  <Globe size={12} /> Public
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={
                    !isPublic
                      ? { background: "var(--fog)", color: "var(--ink)", border: "1px solid var(--fog)" }
                      : { background: "var(--ink-soft)", color: "var(--fog)", border: "1px solid var(--seam)" }
                  }
                  onMouseEnter={(e) => { if (isPublic) e.currentTarget.style.background = "var(--ink-muted)"; }}
                  onMouseLeave={(e) => { if (isPublic) e.currentTarget.style.background = "var(--ink-soft)"; }}
                >
                  Private
                </button>
                <span className="text-xs" style={{ color: "var(--ash)" }}>
                  {isPublic ? "Anyone can join directly" : "Teammates join using a key you share"}
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => { setTeamName(e.target.value); setCreateError(""); }}
                  placeholder="Team name…"
                  className="flex-1 text-sm px-3 py-2 rounded-lg focus:outline-none"
                  style={{
                    background: "var(--ink-soft)",
                    border: teamNameFocused ? "1px solid var(--amber)" : "1px solid var(--seam)",
                    boxShadow: teamNameFocused ? "0 0 0 3px rgba(245,166,35,0.12)" : "none",
                    color: "var(--cream)",
                  }}
                  onFocus={() => setTeamNameFocused(true)}
                  onBlur={() => setTeamNameFocused(false)}
                />
                <button
                  type="button"
                  onClick={() => teamName.trim() && createMutation.mutate()}
                  disabled={!teamName.trim() || createMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                  style={{ background: "var(--amber)", color: "var(--ink)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
                >
                  {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Create {isPublic ? "Public" : "Private"} Team
                </button>
              </div>
              {createError && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--cinnabar)" }}>
                  <AlertCircle size={11} /> {createError}
                </p>
              )}
            </div>
          ) : (
            myTeams.map((team) => (
              <MyTeamCard
                key={team.id}
                team={team}
                isLead={team.lead_id === user?.id}
                onRefresh={onRefresh}
              />
            ))
          )}
        </div>
      )}

      {/* ── Browse / Join ── */}
      {tab === "browse" && (
        <div className="space-y-4">
          {myTeams.length > 0 && (
            <p
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                color: "var(--amber)",
                background: "color-mix(in srgb, var(--amber) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
              }}
            >
              You're already in a team. You can only belong to one team per event.
            </p>
          )}

          {/* Public teams */}
          <div>
            <h4 className="text-xs font-semibold flex items-center gap-1 mb-2" style={{ color: "var(--fog)" }}>
              <Globe size={11} style={{ color: "var(--jade)" }} /> Public Teams
            </h4>
            {loadingAll ? (
              <div className="h-10 rounded-lg animate-pulse" style={{ background: "var(--ink-muted)" }} />
            ) : joinablePublic.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--ash)" }}>No public teams with open spots right now.</p>
            ) : (
              <div className="space-y-2">
                {joinablePublic.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5"
                    style={{
                      background: "color-mix(in srgb, var(--jade) 10%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--jade) 20%, transparent)",
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--cream)" }}>{team.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--ash)" }}>
                        {team.member_count}/{team.max_size} members ·{" "}
                        <span
                          className="font-semibold"
                          style={{ color: team.status === "READY" ? "var(--jade)" : "var(--amber)" }}
                        >
                          {team.status}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => joinPublicMutation.mutate(team.id)}
                      disabled={joinPublicMutation.isPending || myTeams.length > 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                      style={{ background: "var(--jade)", color: "var(--ink)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                    >
                      {joinPublicMutation.isPending && joinPublicMutation.variables === team.id
                        ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3.5">
        <div className="h-4 rounded w-48 mb-1.5" style={{ background: "var(--ink-muted)" }} />
        <div className="h-3 rounded w-28" style={{ background: "var(--ink-muted)" }} />
      </td>
      <td className="px-4 py-3.5"><div className="h-4 rounded w-32" style={{ background: "var(--ink-muted)" }} /></td>
      <td className="px-4 py-3.5"><div className="h-4 rounded w-24" style={{ background: "var(--ink-muted)" }} /></td>
      <td className="px-4 py-3.5"><div className="h-5 rounded-full w-24" style={{ background: "var(--ink-muted)" }} /></td>
      <td className="px-4 py-3.5"><div className="h-8 rounded w-20" style={{ background: "var(--ink-muted)" }} /></td>
    </tr>
  );
}

// ── Ticket modal ──────────────────────────────────────────────────────────────

interface TicketInfo {
  registrationId: string;
  eventTitle: string;
  clubName: string;
  eventDate: string | null;
  participantName: string;
  teamName: string | null;
}

function TicketModal({ ticket, onClose }: { ticket: TicketInfo; onClose: () => void }) {
  const qrUrl = `/media/qr/${ticket.registrationId}.png`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" style={{ background: "var(--ink-soft)" }}>
        {/* Header band */}
        <div className="px-6 py-5 relative" style={{ background: "var(--amber)", color: "var(--ink)" }}>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(0,0,0,0.15)", color: "var(--ink)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.25)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.15)")}
          >
            <X size={14} />
          </button>
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-1"
            style={{ color: "var(--ink)", opacity: 0.7 }}
          >
            Entry Ticket
          </p>
          <h2 className="text-lg font-bold leading-tight pr-8" style={{ color: "var(--ink)" }}>
            {ticket.eventTitle}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--ink)", opacity: 0.7 }}>{ticket.clubName}</p>
        </div>

        {/* Tear line */}
        <div className="relative h-0">
          <div
            className="absolute -left-3 top-0 w-6 h-6 rounded-full -translate-y-1/2"
            style={{ background: "var(--ink-muted)" }}
          />
          <div
            className="absolute -right-3 top-0 w-6 h-6 rounded-full -translate-y-1/2"
            style={{ background: "var(--ink-muted)" }}
          />
          <div className="mx-4" style={{ borderTop: "2px dashed var(--seam)" }} />
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-6 space-y-4" style={{ background: "var(--ink-soft)" }}>
          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                style={{ color: "var(--ash)" }}
              >
                Participant
              </p>
              <p className="font-semibold truncate" style={{ color: "var(--cream)" }}>{ticket.participantName}</p>
            </div>
            {ticket.teamName && (
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: "var(--ash)" }}
                >
                  Team
                </p>
                <p className="font-semibold truncate" style={{ color: "var(--cream)" }}>{ticket.teamName}</p>
              </div>
            )}
            {ticket.eventDate && (
              <div className={ticket.teamName ? "col-span-2" : ""}>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: "var(--ash)" }}
                >
                  Date
                </p>
                <p className="font-semibold" style={{ color: "var(--cream)" }}>{ticket.eventDate}</p>
              </div>
            )}
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center pt-2">
            <div
              className="rounded-xl p-3"
              style={{ background: "var(--ink-muted)", border: "1px solid var(--seam)" }}
            >
              <img src={qrUrl} alt="Entry QR code" className="w-40 h-40 object-contain" />
            </div>
            <p className="text-[10px] mt-2" style={{ color: "var(--ash)" }}>Scan at the venue for entry</p>
          </div>

          {/* Download */}
          <a
            href={qrUrl}
            download={`ticket-${ticket.registrationId}.png`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "var(--amber)", color: "var(--ink)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--amber-glow)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--amber)")}
          >
            <QrCode size={14} /> Download QR
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function MyEvents() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [query, setQuery] = useState("");
  const [teamPanelId, setTeamPanelId] = useState<string | null>(null);
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const { data: registrations, isLoading, error } = useQuery<Registration[]>({
    queryKey: ["registrations", "me"],
    queryFn: () => api.get("/registrations/me").then((r) => r.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/registrations/${id}/cancel`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["registrations", "me"] }),
  });

  const filtered = useMemo(() => {
    if (!registrations) return [];
    const q = query.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter((r) => {
      const startDate = r.event_start_datetime ? fmtDateIST(r.event_start_datetime).toLowerCase() : "";
      return (
        r.event_title.toLowerCase().includes(q) ||
        r.club_name.toLowerCase().includes(q) ||
        startDate.includes(q)
      );
    });
  }, [registrations, query]);

  function handleShowTicket(reg: Registration) {
    const cachedTeams = queryClient.getQueryData<{ id: string; name: string }[]>(
      ["my-teams-event", reg.event_id]
    );
    const teamName = cachedTeams?.[0]?.name ?? null;

    setTicketInfo({
      registrationId: reg.id,
      eventTitle: reg.event_title,
      clubName: reg.club_name,
      eventDate: reg.event_start_datetime
        ? new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(reg.event_start_datetime))
        : null,
      participantName: user?.name ?? "—",
      teamName,
    });
  }

  return (
    <>
    <Layout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: "var(--cream)" }}>
            <CalendarDays size={22} style={{ color: "var(--amber)" }} />
            My Events
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>All events you've registered for.</p>
        </div>

        {error ? (
          <div
            className="rounded-xl p-6 flex items-center gap-3"
            style={{
              background: "color-mix(in srgb, var(--cinnabar) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--cinnabar) 25%, transparent)",
            }}
          >
            <AlertCircle size={18} className="shrink-0" style={{ color: "var(--cinnabar)" }} />
            <p className="text-sm" style={{ color: "var(--cinnabar)" }}>Failed to load registrations.</p>
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
          >
            {/* Toolbar */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderBottom: "1px solid var(--seam)" }}
            >
              <span className="text-sm font-semibold shrink-0" style={{ color: "var(--fog)" }}>
                {isLoading ? "Loading…" : `${filtered.length} registration${filtered.length !== 1 ? "s" : ""}`}
              </span>
              <div className="relative flex-1 max-w-xs ml-auto">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "var(--ash)" }}
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search event, club or date…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg focus:outline-none"
                  style={{
                    background: "var(--ink-muted)",
                    border: searchFocused ? "1px solid var(--amber)" : "1px solid var(--seam)",
                    boxShadow: searchFocused ? "0 0 0 3px rgba(245,166,35,0.12)" : "none",
                    color: "var(--cream)",
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "color-mix(in srgb, var(--ink-muted) 60%, transparent)" }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fog)" }}>Event</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fog)" }}>Club</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fog)" }}>Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fog)" }}>Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fog)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <CalendarDays size={36} className="mx-auto mb-3" style={{ color: "var(--ash)" }} />
                        {query ? (
                          <p className="text-sm" style={{ color: "var(--ash)" }}>No events match "{query}".</p>
                        ) : (
                          <>
                            <p className="text-sm" style={{ color: "var(--ash)" }}>You haven't registered for any events yet.</p>
                            <Link
                              to="/"
                              className="mt-2 inline-block text-xs hover:underline"
                              style={{ color: "var(--amber)" }}
                            >
                              Browse events →
                            </Link>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg) => (
                      <React.Fragment key={reg.id}>
                        <tr
                          className="transition-colors"
                          style={{ borderTop: "1px solid var(--seam)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--ink-muted) 50%, transparent)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/events/${reg.event_slug}`}
                                className="font-medium transition-colors"
                                style={{ color: "var(--cream)" }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--amber)")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--cream)")}
                              >
                                {reg.event_title}
                              </Link>
                              {reg.is_team_event && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                                  style={{
                                    color: "var(--amber)",
                                    background: "color-mix(in srgb, var(--amber) 12%, transparent)",
                                    border: "1px solid color-mix(in srgb, var(--amber) 25%, transparent)",
                                  }}
                                >
                                  <Users size={9} /> Team
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs" style={{ color: "var(--fog)" }}>{reg.club_name}</td>
                          <td className="px-4 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--fog)" }}>
                            {reg.event_start_datetime
                              ? fmtDateIST(reg.event_start_datetime)
                              : <span style={{ color: "var(--ash)" }}>—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full"
                              style={statusBadgeStyle(reg.status)}
                            >
                              {reg.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {reg.is_team_event && reg.status === "CONFIRMED" && (
                                <button
                                  type="button"
                                  onClick={() => setTeamPanelId(teamPanelId === reg.id ? null : reg.id)}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  style={
                                    teamPanelId === reg.id
                                      ? { background: "var(--amber)", color: "var(--ink)" }
                                      : {
                                          background: "color-mix(in srgb, var(--amber) 12%, transparent)",
                                          color: "var(--amber)",
                                        }
                                  }
                                  onMouseEnter={(e) => {
                                    if (teamPanelId !== reg.id)
                                      e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 20%, transparent)";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (teamPanelId !== reg.id)
                                      e.currentTarget.style.background = "color-mix(in srgb, var(--amber) 12%, transparent)";
                                  }}
                                >
                                  <Users size={12} />
                                  {reg.team_id ? "My Team" : "Team"}
                                  <ChevronRight
                                    size={11}
                                    className={`transition-transform ${teamPanelId === reg.id ? "rotate-90" : ""}`}
                                  />
                                </button>
                              )}
                              {reg.status === "CONFIRMED" && (
                                <button
                                  type="button"
                                  onClick={() => handleShowTicket(reg)}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  style={{ background: "var(--ink-muted)", color: "var(--fog)" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--seam)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ink-muted)")}
                                >
                                  <QrCode size={12} /> Ticket
                                </button>
                              )}
                              {(reg.status === "CONFIRMED" || reg.status === "WAITLISTED") && (
                                <button
                                  type="button"
                                  onClick={() => { if (confirm("Cancel this registration?")) cancelMutation.mutate(reg.id); }}
                                  disabled={cancelMutation.isPending}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                  style={{
                                    background: "color-mix(in srgb, var(--cinnabar) 12%, transparent)",
                                    color: "var(--cinnabar)",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cinnabar) 20%, transparent)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--cinnabar) 12%, transparent)")}
                                >
                                  <X size={12} /> Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {teamPanelId === reg.id && reg.is_team_event && reg.status === "CONFIRMED" && (
                          <tr key={`team-${reg.id}`}>
                            <td
                              colSpan={5}
                              className="px-4 pb-4"
                              style={{ background: "color-mix(in srgb, var(--ink-muted) 30%, transparent)" }}
                            >
                              <TeamPanel reg={reg} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
    {ticketInfo && <TicketModal ticket={ticketInfo} onClose={() => setTicketInfo(null)} />}
    </>
  );
}
