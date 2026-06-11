import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Radio, CheckCircle, XCircle, AlertCircle,
  LogOut, ChevronDown, Users, UserCheck, UserX, Loader2,
  Camera, CameraOff, Hash, Search,
} from "lucide-react";
import jsQR from "jsqr";
import api, { apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import type { Event } from "@/types";

interface Checkpoint { id: string; name: string; order: number; }
interface AttendanceStats { registered: number; present: number; absent: number; rate: number; }
interface RollLookup { reg_id: string; participant_name: string; roll_number: string; email: string; team_name: string | null; status: string; }

type ScanResult = { is_duplicate: boolean; record_id?: string; message?: string; participant_name?: string; roll_number?: string; team_name?: string } | null;
type InputMode = "camera" | "manual";

// ── Camera scanner hook ───────────────────────────────────────────────────────

function useCameraScanner(
  enabled: boolean,
  onDecode: (token: string) => void,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code && code.data) {
      onDecode(code.data);
      return; // pause scanning until result is handled
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [onDecode]);

  useEffect(() => {
    if (!enabled) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      cancelAnimationFrame(rafRef.current);
      setCameraReady(false);
      setCameraError(null);
      return;
    }

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            setCameraReady(true);
            rafRef.current = requestAnimationFrame(tick);
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setCameraError(err.message ?? "Camera unavailable");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [enabled, tick]);

  // Resume scanning loop after a successful decode
  const resumeScan = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  return { videoRef, canvasRef, cameraError, cameraReady, resumeScan };
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AttendanceScan() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [selectedCp, setSelectedCp] = useState<string>("");
  const [inputMode, setInputMode] = useState<InputMode>("camera");
  const [rollInput, setRollInput] = useState("");
  const [lookedUp, setLookedUp] = useState<RollLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScanResult>(null);
  const rollInputRef = useRef<HTMLInputElement>(null);

  const { data: event } = useQuery<Event>({
    queryKey: ["att-event", eventId],
    queryFn: () => api.get(`/events/by-id/${eventId}`).then((r) => r.data),
    enabled: !!eventId,
  });

  const { data: checkpoints = [] } = useQuery<Checkpoint[]>({
    queryKey: ["checkpoints", eventId],
    queryFn: () =>
      api.get(`/events/${eventId}/checkpoints`).then((r) =>
        r.data.sort((a: Checkpoint, b: Checkpoint) => a.order - b.order)
      ),
    enabled: !!eventId,
  });

  const { data: stats } = useQuery<AttendanceStats>({
    queryKey: ["attendance", eventId],
    queryFn: () => api.get(`/events/${eventId}/attendance`).then((r) => r.data),
    enabled: !!eventId,
    refetchInterval: 15_000,
  });

  const scanMutation = useMutation({
    mutationFn: ({ qr_token, checkpoint_id }: { qr_token: string; checkpoint_id: string }) =>
      api.post("/attendance/scan", { qr_token, checkpoint_id }),
    onSuccess: (res) => {
      setLastResult(res.data);
      if (inputMode === "camera") cameraHook.resumeScan();
      setTimeout(() => { setLastResult(null); if (inputMode === "camera") cameraHook.resumeScan(); }, 3000);
    },
    onError: (err) => {
      setLastResult({ is_duplicate: false, message: apiError(err, "Scan failed.") });
      if (inputMode === "camera") cameraHook.resumeScan();
      setTimeout(() => { setLastResult(null); if (inputMode === "camera") cameraHook.resumeScan(); }, 3000);
    },
  });

  const lookupMutation = useMutation({
    mutationFn: ({ roll_number, event_id }: { roll_number: string; event_id: string }) =>
      api.post("/attendance/lookup-roll", { roll_number, event_id }),
    onSuccess: (res) => {
      setLookedUp(res.data);
      setLookupError(null);
    },
    onError: (err) => {
      setLookedUp(null);
      setLookupError(apiError(err, "Roll number not found."));
    },
  });

  const rollScanMutation = useMutation({
    mutationFn: ({ roll_number, event_id, checkpoint_id }: { roll_number: string; event_id: string; checkpoint_id: string }) =>
      api.post("/attendance/scan-by-roll", { roll_number, event_id, checkpoint_id }),
    onSuccess: (res) => {
      setLastResult(res.data);
      setRollInput("");
      setLookedUp(null);
      setLookupError(null);
      setTimeout(() => { setLastResult(null); rollInputRef.current?.focus(); }, 3000);
    },
    onError: (err) => {
      setLastResult({ is_duplicate: false, message: apiError(err, "Mark attendance failed.") });
      setTimeout(() => { setLastResult(null); rollInputRef.current?.focus(); }, 3000);
    },
  });

  const handleToken = useCallback((token: string) => {
    if (!selectedCp || scanMutation.isPending || lastResult !== null) return;
    scanMutation.mutate({ qr_token: token.trim(), checkpoint_id: selectedCp });
  }, [selectedCp, scanMutation, lastResult]);

  const cameraHook = useCameraScanner(
    inputMode === "camera" && !!selectedCp && lastResult === null,
    handleToken,
  );

  // Auto-focus roll input when switching to manual mode
  useEffect(() => {
    if (inputMode === "manual" && selectedCp) rollInputRef.current?.focus();
  }, [inputMode, selectedCp]);

  // Clear lookup state when mode or checkpoint changes
  useEffect(() => {
    setRollInput("");
    setLookedUp(null);
    setLookupError(null);
  }, [inputMode, selectedCp]);

  function handleRollLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!rollInput.trim() || !eventId) return;
    setLookedUp(null);
    setLookupError(null);
    lookupMutation.mutate({ roll_number: rollInput.trim().toUpperCase(), event_id: eventId });
  }

  function handleMarkPresent() {
    if (!lookedUp || !selectedCp || !eventId) return;
    rollScanMutation.mutate({ roll_number: lookedUp.roll_number, event_id: eventId, checkpoint_id: selectedCp });
  }

  function handleClearLookup() {
    setLookedUp(null);
    setLookupError(null);
    setRollInput("");
    rollInputRef.current?.focus();
  }

  function handleLogout() {
    logout();
    navigate("/attendance-login");
  }

  const pct = stats && stats.registered > 0
    ? Math.round((stats.present / stats.registered) * 100)
    : 0;

  const cameraActive = inputMode === "camera" && !!selectedCp;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink)", display: "flex", flexDirection: "column", fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Radio size={16} style={{ color: "var(--ink)" }} />
          </div>
          <div>
            <p style={{ color: "var(--cream)", fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
              {event?.title ?? "Attendance Scanner"}
            </p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
              {event?.venue ?? "Scanner Portal"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{user?.name}</span>
          <button type="button" onClick={handleLogout}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cinnabar)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px 40px", gap: 16, maxWidth: 480, margin: "0 auto", width: "100%" }}>

        {/* Stats */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, width: "100%" }}>
            {[
              { label: "Registered", value: stats.registered, icon: <Users size={13} />, color: "var(--sky)" },
              { label: "Present", value: stats.present, icon: <UserCheck size={13} />, color: "var(--jade)" },
              { label: "Absent", value: stats.absent, icon: <UserX size={13} />, color: "var(--cinnabar)" },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                <span style={{ color: s.color }}>{s.icon}</span>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: s.color, lineHeight: 1, margin: "4px 0 2px" }}>{s.value}</p>
                <p style={{ fontSize: 10, color: "var(--fog)", letterSpacing: "0.04em" }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {stats && (
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--fog)", marginBottom: 5 }}>
              <span>Attendance</span>
              <span style={{ color: "var(--cream)", fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: "var(--seam)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "var(--jade)", borderRadius: 99, width: `${pct}%`, transition: "width 700ms ease" }} />
            </div>
          </div>
        )}

        {/* Checkpoint selector */}
        <div style={{ width: "100%" }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fog)", display: "block", marginBottom: 6 }}>
            Checkpoint
          </label>
          {checkpoints.length === 0 ? (
            <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
              <AlertCircle size={18} style={{ color: "var(--amber)", margin: "0 auto 6px" }} />
              <p style={{ fontSize: 13, color: "var(--amber)", fontWeight: 600 }}>No checkpoints set up</p>
              <p style={{ fontSize: 11, color: "rgba(245,166,35,0.6)", marginTop: 4 }}>
                Ask the event manager to create checkpoints first.
              </p>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <select
                value={selectedCp}
                onChange={(e) => setSelectedCp(e.target.value)}
                style={{
                  width: "100%", background: "var(--ink-soft)", border: "1px solid var(--seam)",
                  color: "var(--cream)", borderRadius: 10, padding: "10px 36px 10px 14px",
                  fontSize: 14, appearance: "none", cursor: "pointer", outline: "none",
                }}
              >
                <option value="" disabled style={{ background: "var(--ink-muted)" }}>Select a checkpoint…</option>
                {checkpoints.map((cp) => (
                  <option key={cp.id} value={cp.id} style={{ background: "var(--ink-muted)" }}>
                    {cp.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fog)", pointerEvents: "none" }} />
            </div>
          )}
        </div>

        {/* Input mode toggle */}
        {selectedCp && checkpoints.length > 0 && (
          <div style={{ display: "flex", gap: 6, background: "var(--ink-soft)", padding: 4, borderRadius: 10, width: "100%", border: "1px solid var(--seam)" }}>
            {(["camera", "manual"] as InputMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setInputMode(mode)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: inputMode === mode ? "var(--amber)" : "transparent",
                  color: inputMode === mode ? "var(--ink)" : "var(--fog)",
                  transition: "all 150ms",
                }}
              >
                {mode === "camera" ? <Camera size={14} /> : <Hash size={14} />}
                {mode === "camera" ? "Camera" : "Roll No."}
              </button>
            ))}
          </div>
        )}

        {/* Camera view */}
        {cameraActive && (
          <div style={{ width: "100%", position: "relative" }}>
            {cameraHook.cameraError ? (
              <div style={{ background: "rgba(232,65,42,0.08)", border: "1px solid rgba(232,65,42,0.3)", borderRadius: 14, padding: "20px", textAlign: "center" }}>
                <CameraOff size={28} style={{ color: "var(--cinnabar)", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "var(--cinnabar)", fontWeight: 600 }}>Camera error</p>
                <p style={{ fontSize: 11, color: "rgba(232,65,42,0.7)", marginTop: 4 }}>{cameraHook.cameraError}</p>
                <button type="button" onClick={() => setInputMode("manual")}
                  style={{ marginTop: 12, fontSize: 12, color: "var(--amber)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Switch to manual input
                </button>
              </div>
            ) : (
              <div style={{ borderRadius: 14, overflow: "hidden", border: "2px solid var(--seam)", position: "relative", background: "var(--ink-muted)" }}>
                <video
                  ref={cameraHook.videoRef}
                  muted
                  playsInline
                  style={{ width: "100%", display: "block", aspectRatio: "4/3", objectFit: "cover" }}
                />
                <canvas ref={cameraHook.canvasRef} style={{ display: "none" }} />
                {/* Scanning overlay */}
                {!cameraHook.cameraReady && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,15,20,0.7)" }}>
                    <Loader2 size={28} style={{ color: "var(--amber)" }} className="animate-spin" />
                  </div>
                )}
                {cameraHook.cameraReady && lastResult === null && !scanMutation.isPending && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <div style={{
                      width: 200, height: 200, borderRadius: 16,
                      border: "2px solid var(--amber)",
                      boxShadow: "0 0 0 9999px rgba(13,15,20,0.45)",
                    }} />
                  </div>
                )}
                {scanMutation.isPending && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(13,15,20,0.6)" }}>
                    <Loader2 size={24} style={{ color: "var(--amber)" }} className="animate-spin" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Roll number input */}
        {inputMode === "manual" && selectedCp && !lastResult && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Step 1: Enter roll number */}
            <form onSubmit={handleRollLookup} style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Hash size={15} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--dust)", pointerEvents: "none" }} />
                <input
                  ref={rollInputRef}
                  type="text"
                  value={rollInput}
                  onChange={(e) => { setRollInput(e.target.value.toUpperCase()); setLookedUp(null); setLookupError(null); }}
                  placeholder="Enter roll number…"
                  disabled={lookupMutation.isPending || rollScanMutation.isPending}
                  autoComplete="off"
                  autoCapitalize="characters"
                  style={{
                    width: "100%", background: "var(--ink-soft)", border: "1px solid var(--seam)",
                    color: "var(--cream)", borderRadius: 10, padding: "11px 14px 11px 34px",
                    fontSize: 14, outline: "none", boxSizing: "border-box", letterSpacing: "0.04em",
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!rollInput.trim() || lookupMutation.isPending}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "11px 16px",
                  borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
                  background: !rollInput.trim() || lookupMutation.isPending ? "var(--seam)" : "var(--amber)",
                  color: "var(--ink)", transition: "all 150ms", whiteSpace: "nowrap",
                }}
              >
                {lookupMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {lookupMutation.isPending ? "" : "Find"}
              </button>
            </form>

            {/* Lookup error */}
            {lookupError && (
              <div style={{ background: "rgba(232,65,42,0.08)", border: "1px solid rgba(232,65,42,0.3)", borderRadius: 12, padding: "12px 14px" }}>
                <p style={{ color: "var(--cinnabar)", fontSize: 13, fontWeight: 600 }}>{lookupError}</p>
              </div>
            )}

            {/* Step 2: Preview + confirm */}
            {lookedUp && (
              <div style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 14, padding: "16px" }}>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ color: "var(--cream)", fontWeight: 700, fontSize: 16 }}>{lookedUp.participant_name}</p>
                  <p style={{ color: "var(--fog)", fontSize: 12, marginTop: 2 }}>{lookedUp.email}</p>
                  <p style={{ color: "var(--dust)", fontSize: 12, marginTop: 2, fontFamily: "monospace" }}>Roll: {lookedUp.roll_number}</p>
                  {lookedUp.team_name && (
                    <p style={{ color: "var(--amber)", fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <Users size={11} /> {lookedUp.team_name}
                    </p>
                  )}
                  {lookedUp.status !== "CONFIRMED" && (
                    <p style={{ color: "var(--cinnabar)", fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                      Registration not confirmed ({lookedUp.status})
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleMarkPresent}
                    disabled={rollScanMutation.isPending || lookedUp.status !== "CONFIRMED"}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "12px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: lookedUp.status !== "CONFIRMED" || rollScanMutation.isPending ? "var(--seam)" : "var(--jade)",
                      color: "#0D0F14", fontSize: 14, fontWeight: 700, transition: "all 150ms",
                    }}
                  >
                    {rollScanMutation.isPending
                      ? <><Loader2 size={15} className="animate-spin" /> Marking…</>
                      : <><UserCheck size={15} /> Mark Present</>}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearLookup}
                    style={{
                      padding: "12px 16px", borderRadius: 10, border: "1px solid var(--seam)",
                      background: "transparent", color: "var(--fog)", fontSize: 14, cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scan result feedback */}
        {lastResult && (
          <div style={{
            width: "100%", borderRadius: 16, padding: "20px", textAlign: "center",
            background: lastResult.message && !lastResult.is_duplicate
              ? "rgba(232,65,42,0.12)" : lastResult.is_duplicate
              ? "rgba(245,166,35,0.12)" : "rgba(61,214,140,0.12)",
            border: `1px solid ${lastResult.message && !lastResult.is_duplicate
              ? "rgba(232,65,42,0.4)" : lastResult.is_duplicate
              ? "rgba(245,166,35,0.4)" : "rgba(61,214,140,0.4)"}`,
          }}>
            {lastResult.message && !lastResult.is_duplicate ? (
              <>
                <XCircle size={38} style={{ color: "var(--cinnabar)", margin: "0 auto 8px" }} />
                <p style={{ color: "var(--cinnabar)", fontWeight: 700, fontSize: 16 }}>{lastResult.message}</p>
              </>
            ) : lastResult.is_duplicate ? (
              <>
                <AlertCircle size={38} style={{ color: "var(--amber)", margin: "0 auto 8px" }} />
                <p style={{ color: "var(--amber)", fontWeight: 700, fontSize: 16 }}>Already scanned</p>
                {lastResult.participant_name && (
                  <p style={{ color: "rgba(245,166,35,0.8)", fontSize: 14, marginTop: 6, fontWeight: 600 }}>{lastResult.participant_name}</p>
                )}
                <p style={{ color: "rgba(245,166,35,0.65)", fontSize: 12, marginTop: 4 }}>This participant was already marked present.</p>
              </>
            ) : (
              <>
                <CheckCircle size={38} style={{ color: "var(--jade)", margin: "0 auto 8px" }} />
                <p style={{ color: "var(--jade)", fontWeight: 700, fontSize: 18 }}>Marked Present!</p>
                {lastResult.participant_name && (
                  <p style={{ color: "var(--cream)", fontSize: 16, fontWeight: 600, marginTop: 8 }}>{lastResult.participant_name}</p>
                )}
                {lastResult.roll_number && (
                  <p style={{ color: "var(--fog)", fontSize: 13, marginTop: 3 }}>Roll No: {lastResult.roll_number}</p>
                )}
                {lastResult.team_name && (
                  <p style={{ color: "var(--amber)", fontSize: 13, marginTop: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <Users size={12} /> {lastResult.team_name}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Hint */}
        {!lastResult && !scanMutation.isPending && selectedCp && inputMode === "camera" && cameraHook.cameraReady && (
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textAlign: "center" }}>
            Point the camera at a participant's QR code — it scans automatically.
          </p>
        )}
        {!lastResult && selectedCp && inputMode === "manual" && !lookedUp && !lookupError && (
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textAlign: "center" }}>
            Enter a roll number and tap Find to look up the participant.
          </p>
        )}
      </div>
    </div>
  );
}
