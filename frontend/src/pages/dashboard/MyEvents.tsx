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

const STATUS_COLORS: Record<Registration["status"], string> = {
  CONFIRMED:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  WAITLISTED: "bg-blue-50 text-blue-700 border-blue-200",
  CANCELLED:  "bg-slate-100 text-slate-500 border-slate-200",
};

const TEAM_STATUS_COLORS: Record<Team["status"], string> = {
  FORMING:      "bg-amber-50 text-amber-700 border-amber-200",
  READY:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  SUBMITTED:    "bg-indigo-50 text-indigo-700 border-indigo-200",
  DISQUALIFIED: "bg-red-50 text-red-600 border-red-200",
};

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
      className="p-1 rounded text-slate-400 hover:text-indigo-600 transition-colors">
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
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
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Users size={13} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-800">{team.name}</span>
              {isLead && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                  <Crown size={9} /> Lead
                </span>
              )}
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                team.is_public ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-600 bg-slate-100 border-slate-200"
              }`}>
                {team.is_public ? <><Globe size={9} /> Public</> : <>Private</>}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {team.member_count} of {team.max_size} members · min {team.min_size}
            </p>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TEAM_STATUS_COLORS[team.status]}`}>
          {team.status}
        </span>
      </div>

      {/* Join key (lead only, private team) */}
      {isLead && !team.is_public && team.join_key && (
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
          <p className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
            <KeyRound size={11} className="text-indigo-500" /> Join Key — share this with teammates
          </p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold tracking-widest text-indigo-700 select-all">
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
              <p className="text-xs font-semibold text-slate-600 mb-1">Invite by email</p>
              <div className="flex gap-2">
                <input type="email" value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteToken(null); setInviteError(""); }}
                  placeholder="teammate@college.edu"
                  className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-slate-900" />
                <button type="button"
                  onClick={() => inviteEmail && inviteMutation.mutate(inviteEmail)}
                  disabled={!inviteEmail || inviteMutation.isPending}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1">
                  {inviteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                  Send
                </button>
              </div>
              {inviteToken && (
                <div className="mt-2 bg-white border border-emerald-200 rounded-lg p-2.5">
                  <p className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                    <CheckCircle size={11} /> Invitation token — share with teammate:
                  </p>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-mono text-slate-700 break-all select-all bg-slate-50 rounded px-2 py-1.5 flex-1">{inviteToken}</p>
                    <CopyButton text={inviteToken} />
                  </div>
                </div>
              )}
              {inviteError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={11} /> {inviteError}</p>}
            </div>
          )}

          {/* Submit */}
          {(team.status === "READY" || team.status === "FORMING") && (
            <button type="button"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || team.member_count < team.min_size}
              title={team.member_count < team.min_size ? `Need ${team.min_size - team.member_count} more member(s)` : ""}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
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
        <p className="text-xs text-emerald-700 flex items-center gap-1">
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
    <div className="mt-3 border-t border-slate-100 pt-3">
      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-50 p-0.5 rounded-lg mb-3 w-fit">
        {(["my", "browse"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              tab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {t === "my" ? "My Team" : "Browse / Join"}
          </button>
        ))}
      </div>

      {/* ── My team ── */}
      {tab === "my" && (
        <div className="space-y-3">
          {loadingMy ? (
            <div className="h-12 bg-slate-50 rounded-lg animate-pulse" />
          ) : myTeams.length === 0 ? (
            <div>
              <p className="text-xs text-slate-500 mb-3">
                You're not in a team yet. Create one, or browse public teams and join — or enter a private team's key.
              </p>

              {/* Visibility toggle */}
              <div className="flex items-center gap-3 mb-3">
                <button type="button"
                  onClick={() => setIsPublic(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isPublic ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}>
                  <Globe size={12} /> Public
                </button>
                <button type="button"
                  onClick={() => setIsPublic(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    !isPublic ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}>
                  Private
                </button>
                <span className="text-xs text-slate-400">
                  {isPublic ? "Anyone can join directly" : "Teammates join using a key you share"}
                </span>
              </div>

              <div className="flex gap-2">
                <input type="text" value={teamName}
                  onChange={(e) => { setTeamName(e.target.value); setCreateError(""); }}
                  placeholder="Team name…"
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-slate-900" />
                <button type="button"
                  onClick={() => teamName.trim() && createMutation.mutate()}
                  disabled={!teamName.trim() || createMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Create {isPublic ? "Public" : "Private"} Team
                </button>
              </div>
              {createError && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={11} /> {createError}</p>}
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
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              You're already in a team. You can only belong to one team per event.
            </p>
          )}

          {/* Public teams */}
          <div>
            <h4 className="text-xs font-semibold text-slate-600 flex items-center gap-1 mb-2">
              <Globe size={11} className="text-emerald-600" /> Public Teams
            </h4>
            {loadingAll ? (
              <div className="h-10 bg-slate-50 rounded-lg animate-pulse" />
            ) : joinablePublic.length === 0 ? (
              <p className="text-xs text-slate-400">No public teams with open spots right now.</p>
            ) : (
              <div className="space-y-2">
                {joinablePublic.map((team) => (
                  <div key={team.id}
                    className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{team.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {team.member_count}/{team.max_size} members ·{" "}
                        <span className={team.status === "READY" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                          {team.status}
                        </span>
                      </p>
                    </div>
                    <button type="button"
                      onClick={() => joinPublicMutation.mutate(team.id)}
                      disabled={joinPublicMutation.isPending || myTeams.length > 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
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
      <td className="px-4 py-3.5"><div className="h-4 bg-slate-100 rounded w-48 mb-1.5" /><div className="h-3 bg-slate-100 rounded w-28" /></td>
      <td className="px-4 py-3.5"><div className="h-4 bg-slate-100 rounded w-32" /></td>
      <td className="px-4 py-3.5"><div className="h-4 bg-slate-100 rounded w-24" /></td>
      <td className="px-4 py-3.5"><div className="h-5 bg-slate-100 rounded-full w-24" /></td>
      <td className="px-4 py-3.5"><div className="h-8 bg-slate-100 rounded w-20" /></td>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header band */}
        <div className="bg-indigo-600 px-6 py-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Entry Ticket</p>
          <h2 className="text-lg font-bold leading-tight pr-8">{ticket.eventTitle}</h2>
          <p className="text-sm text-indigo-200 mt-0.5">{ticket.clubName}</p>
        </div>

        {/* Tear line */}
        <div className="relative h-0">
          <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-slate-100 -translate-y-1/2" />
          <div className="absolute -right-3 top-0 w-6 h-6 rounded-full bg-slate-100 -translate-y-1/2" />
          <div className="mx-4 border-t-2 border-dashed border-slate-200" />
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-6 space-y-4">
          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Participant</p>
              <p className="font-semibold text-slate-800 truncate">{ticket.participantName}</p>
            </div>
            {ticket.teamName && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Team</p>
                <p className="font-semibold text-slate-800 truncate">{ticket.teamName}</p>
              </div>
            )}
            {ticket.eventDate && (
              <div className={ticket.teamName ? "col-span-2" : ""}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Date</p>
                <p className="font-semibold text-slate-800">{ticket.eventDate}</p>
              </div>
            )}
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center pt-2">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <img src={qrUrl} alt="Entry QR code" className="w-40 h-40 object-contain" />
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Scan at the venue for entry</p>
          </div>

          {/* Download */}
          <a
            href={qrUrl}
            download={`ticket-${ticket.registrationId}.png`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
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
    // Try to read team name from the already-fetched my-teams cache for this event
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <CalendarDays size={22} className="text-indigo-500" />
            My Events
          </h1>
          <p className="text-slate-500 mt-1 text-sm">All events you've registered for.</p>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">Failed to load registrations.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700 shrink-0">
                {isLoading ? "Loading…" : `${filtered.length} registration${filtered.length !== 1 ? "s" : ""}`}
              </span>
              <div className="relative flex-1 max-w-xs ml-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search event, club or date…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white placeholder:text-slate-400 text-slate-900"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/60">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Event</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Club</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <CalendarDays size={36} className="text-slate-200 mx-auto mb-3" />
                        {query ? (
                          <p className="text-slate-400 text-sm">No events match "{query}".</p>
                        ) : (
                          <>
                            <p className="text-slate-400 text-sm">You haven't registered for any events yet.</p>
                            <Link to="/" className="mt-2 inline-block text-xs text-indigo-600 hover:underline">Browse events →</Link>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((reg) => (
                      <React.Fragment key={reg.id}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <Link to={`/events/${reg.event_slug}`}
                                className="font-medium text-slate-800 hover:text-indigo-600 transition-colors">
                                {reg.event_title}
                              </Link>
                              {reg.is_team_event && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full shrink-0">
                                  <Users size={9} /> Team
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs">{reg.club_name}</td>
                          <td className="px-4 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                            {reg.event_start_datetime
                              ? fmtDateIST(reg.event_start_datetime)
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[reg.status]}`}>
                              {reg.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {reg.is_team_event && reg.status === "CONFIRMED" && (
                                <button type="button"
                                  onClick={() => setTeamPanelId(teamPanelId === reg.id ? null : reg.id)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    teamPanelId === reg.id
                                      ? "bg-indigo-600 text-white"
                                      : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                  }`}>
                                  <Users size={12} />
                                  {reg.team_id ? "My Team" : "Team"}
                                  <ChevronRight size={11} className={`transition-transform ${teamPanelId === reg.id ? "rotate-90" : ""}`} />
                                </button>
                              )}
                              {reg.status === "CONFIRMED" && (
                                <button type="button"
                                  onClick={() => handleShowTicket(reg)}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 text-xs font-medium transition-colors">
                                  <QrCode size={12} /> Ticket
                                </button>
                              )}
                              {(reg.status === "CONFIRMED" || reg.status === "WAITLISTED") && (
                                <button type="button"
                                  onClick={() => { if (confirm("Cancel this registration?")) cancelMutation.mutate(reg.id); }}
                                  disabled={cancelMutation.isPending}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-colors disabled:opacity-50">
                                  <X size={12} /> Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {teamPanelId === reg.id && reg.is_team_event && reg.status === "CONFIRMED" && (
                          <tr key={`team-${reg.id}`}>
                            <td colSpan={5} className="px-4 pb-4 bg-slate-50/30">
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
