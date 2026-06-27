import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Event } from "@/types";

interface Checkpoint {
  id: string;
  name: string;
  order: number;
}

interface MassQRData {
  qr_token: string;
  expires_at: string;
  interval_seconds: number;
}

export default function MassAttendance() {
  const { eventId } = useParams<{ eventId: string }>();
  const [selectedCp, setSelectedCp] = useState<string | null>(null);
  const [qrData, setQrData] = useState<MassQRData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);

  const { data: event } = useQuery<Event>({
    queryKey: ["event-by-id", eventId],
    queryFn: async () => (await api.get<Event>(`/events/by-id/${eventId}`)).data,
    enabled: !!eventId,
  });

  const { data: checkpoints = [] } = useQuery<Checkpoint[]>({
    queryKey: ["checkpoints", eventId],
    queryFn: async () => (await api.get<Checkpoint[]>(`/events/${eventId}/checkpoints`)).data,
    enabled: !!eventId,
  });

  // Auto-select first checkpoint
  useEffect(() => {
    if (checkpoints.length > 0 && !selectedCp) {
      setSelectedCp(checkpoints[0].id);
    }
  }, [checkpoints, selectedCp]);

  const interval = event?.mass_qr_interval ?? 30;

  async function fetchQR() {
    if (!eventId || !selectedCp) return;
    try {
      const res = await api.get<MassQRData>(`/events/${eventId}/attendance/mass-qr`, {
        params: { checkpoint_id: selectedCp },
      });
      setQrData(res.data);
      setSecondsLeft(res.data.interval_seconds);
      setRefreshCount((c) => c + 1);
    } catch {
      // silently retry on next tick
    }
  }

  // Initial fetch when checkpoint selected
  useEffect(() => {
    if (selectedCp) fetchQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCp]);

  // Auto-refresh countdown + re-fetch when timer hits zero
  useEffect(() => {
    if (!selectedCp) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          fetchQR();
          return interval;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCp, interval, refreshCount]);

  const cpName = checkpoints.find((c) => c.id === selectedCp)?.name ?? "";
  const progressPct = interval > 0 ? (secondsLeft / interval) * 100 : 0;
  const attendUrl = qrData
    ? `${window.location.origin}/attend?token=${encodeURIComponent(qrData.qr_token)}`
    : "";

  return (
    <Layout eventId={eventId}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: 20 }}>
          <Link
            to={`/manage/${eventId}/overview`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fog)", textDecoration: "none" }}
          >
            <ArrowLeft size={14} />
            Back to Event Overview
          </Link>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--dust)", marginBottom: 4 }}>Mass Attendance</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--cream)", letterSpacing: "-0.02em" }}>
            {event?.title ?? "Event"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--fog)", marginTop: 4 }}>
            Display this QR code on screen. Participants scan it with their phone to mark attendance.
          </p>
        </div>

        {/* Checkpoint selector */}
        {checkpoints.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--dust)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
              Checkpoint
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {checkpoints.map((cp) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => setSelectedCp(cp.id)}
                  style={{
                    fontSize: 13, fontWeight: 600, padding: "6px 16px", borderRadius: 99, cursor: "pointer", transition: "all 150ms",
                    border: `1px solid ${selectedCp === cp.id ? "var(--amber)" : "var(--seam)"}`,
                    background: selectedCp === cp.id ? "rgba(245,166,35,0.12)" : "transparent",
                    color: selectedCp === cp.id ? "var(--amber)" : "var(--fog)",
                  }}
                >
                  {cp.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* QR Display */}
        {qrData && attendUrl ? (
          <div style={{
            background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 16,
            padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
          }}>
            <div style={{
              background: "white", borderRadius: 12, padding: 12,
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            }}>
              <QRCodeCanvas
                value={attendUrl}
                size={300}
                marginSize={2}
                level="M"
              />
            </div>

            {cpName && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={13} style={{ color: "var(--amber)" }} />
                <span style={{ fontSize: 13, color: "var(--fog)" }}>
                  Checkpoint: <strong style={{ color: "var(--cream)" }}>{cpName}</strong>
                </span>
              </div>
            )}

            {/* Countdown bar */}
            <div style={{ width: "100%", maxWidth: 320 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--fog)", display: "flex", alignItems: "center", gap: 5 }}>
                  <RefreshCw size={11} style={{ color: "var(--dust)" }} />
                  Refreshes in
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: secondsLeft <= 5 ? "var(--cinnabar)" : "var(--amber)" }}>
                  {secondsLeft}s
                </span>
              </div>
              <div style={{ height: 4, background: "var(--seam)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  background: secondsLeft <= 5 ? "var(--cinnabar)" : "var(--amber)",
                  width: `${progressPct}%`, transition: "width 1s linear",
                }} />
              </div>
            </div>

            <p style={{ fontSize: 11, color: "var(--dust)", textAlign: "center" }}>
              QR rotates every {interval}s — old tokens are invalid after expiry.
            </p>
          </div>
        ) : (
          <div style={{
            background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 16,
            padding: 60, textAlign: "center", color: "var(--fog)",
          }}>
            {selectedCp ? "Loading QR code…" : "Select a checkpoint above to begin."}
          </div>
        )}
      </div>
    </Layout>
  );
}
