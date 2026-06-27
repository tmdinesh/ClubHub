import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, Loader2, Camera, CameraOff } from "lucide-react";
import jsQR from "jsqr";
import api, { apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

interface ScanResponse {
  is_duplicate: boolean;
  record_id: string | null;
  message: string | null;
  participant_name: string | null;
}

export default function AttendanceSelfMark() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const tokenFromUrl = searchParams.get("token");

  const [result, setResult] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scannedRef = useRef(false);

  const mutation = useMutation({
    mutationFn: async (qr_token: string) =>
      (await api.post<ScanResponse>("/attendance/mass-scan", { qr_token })).data,
    onSuccess: (data) => {
      stopCamera();
      setResult(data);
    },
    onError: (err: unknown) => {
      stopCamera();
      setError(apiError(err, "Failed to mark attendance."));
    },
  });

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || scannedRef.current) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) {
        scannedRef.current = true;
        // Extract token from scanned URL or use raw value
        let token = code.data;
        try {
          const url = new URL(code.data);
          token = url.searchParams.get("token") ?? code.data;
        } catch {
          // not a URL, use raw value
        }
        mutation.mutate(token);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [mutation]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    scannedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError("Camera access denied. Please allow camera access and try again.");
    }
  }, [tick]);

  // If token already in URL (deep-link from organizer QR), submit directly
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (tokenFromUrl && !mutation.isPending && !result && !error) {
      mutation.mutate(tokenFromUrl);
    }
  }, [isAuthenticated, tokenFromUrl]); // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  // If a token came in from the URL, show processing state
  if (tokenFromUrl) {
    return (
      <PageShell>
        {mutation.isPending ? (
          <>
            <Loader2 size={40} style={{ color: "var(--amber)", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
            <h2 style={titleStyle}>Marking Attendance…</h2>
            <p style={subStyle}>Please wait.</p>
          </>
        ) : result ? (
          <ResultView result={result} />
        ) : error ? (
          <ErrorView error={error} />
        ) : null}
        <DashboardLink />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {result ? (
        <>
          <ResultView result={result} />
          <DashboardLink />
        </>
      ) : error ? (
        <>
          <ErrorView error={error} />
          <button
            type="button"
            onClick={() => { setError(null); scannedRef.current = false; startCamera(); }}
            style={btnStyle}
          >
            Try Again
          </button>
          <DashboardLink />
        </>
      ) : mutation.isPending ? (
        <>
          <Loader2 size={40} style={{ color: "var(--amber)", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <h2 style={titleStyle}>Marking Attendance…</h2>
          <p style={subStyle}>Please wait.</p>
        </>
      ) : (
        <>
          <div style={{
            width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
            background: "color-mix(in srgb, var(--amber) 14%, transparent)",
          }}>
            <Camera size={26} style={{ color: "var(--amber)" }} />
          </div>
          <h2 style={titleStyle}>Mark Your Attendance</h2>
          <p style={{ ...subStyle, marginBottom: 20 }}>
            Point your camera at the QR code displayed by the organizer.
          </p>

          {/* Camera preview */}
          <div style={{
            position: "relative", width: "100%", aspectRatio: "1",
            borderRadius: 12, overflow: "hidden", background: "#000",
            border: scanning ? "2px solid var(--amber)" : "2px solid var(--seam)",
            marginBottom: 16,
          }}>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", display: scanning ? "block" : "none" }}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {!scanning && (
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8,
              }}>
                <CameraOff size={32} style={{ color: "var(--ash)" }} />
                <span style={{ color: "var(--fog)", fontSize: 13 }}>Camera off</span>
              </div>
            )}
            {/* Scan crosshair overlay */}
            {scanning && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
              }}>
                <div style={{
                  width: "60%", aspectRatio: "1",
                  border: "2px solid rgba(245,166,35,0.7)",
                  borderRadius: 8, boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
                }} />
              </div>
            )}
          </div>

          {cameraError && (
            <p style={{ color: "var(--cinnabar)", fontSize: 13, marginBottom: 12 }}>{cameraError}</p>
          )}

          {!scanning ? (
            <button type="button" onClick={startCamera} style={btnStyle}>
              <Camera size={15} /> Open Camera
            </button>
          ) : (
            <button type="button" onClick={stopCamera} style={{ ...btnStyle, background: "var(--seam)", color: "var(--fog)" }}>
              Stop Camera
            </button>
          )}

          <DashboardLink />
        </>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh", background: "var(--ink)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Outfit', sans-serif", padding: 24,
    }}>
      <div style={{
        background: "var(--ink-soft)", border: "1px solid var(--seam)", borderRadius: 16,
        padding: "36px 32px", maxWidth: 420, width: "100%", textAlign: "center",
      }}>
        {children}
      </div>
    </div>
  );
}

function ResultView({ result }: { result: { is_duplicate: boolean; participant_name: string | null } }) {
  return (
    <>
      <CheckCircle2 size={40} style={{ color: "var(--jade)", margin: "0 auto 16px" }} />
      <h2 style={{ ...titleStyle, color: result.is_duplicate ? "var(--cream)" : "var(--jade)" }}>
        {result.is_duplicate ? "Already Marked" : "Attendance Marked!"}
      </h2>
      <p style={subStyle}>
        {result.is_duplicate
          ? `Your attendance was already recorded, ${result.participant_name ?? "participant"}.`
          : `Welcome, ${result.participant_name ?? "participant"}! Your presence has been recorded.`}
      </p>
    </>
  );
}

function ErrorView({ error }: { error: string }) {
  return (
    <>
      <AlertCircle size={40} style={{ color: "var(--cinnabar)", margin: "0 auto 16px" }} />
      <h2 style={titleStyle}>Error</h2>
      <p style={subStyle}>{error}</p>
    </>
  );
}

function DashboardLink() {
  return (
    <Link
      to="/dashboard"
      style={{
        display: "inline-block", marginTop: 20, fontSize: 13, fontWeight: 600,
        color: "var(--amber)", textDecoration: "none",
      }}
    >
      Go to Dashboard →
    </Link>
  );
}

const titleStyle: React.CSSProperties = { color: "var(--cream)", fontWeight: 700, fontSize: 18, marginBottom: 8 };
const subStyle: React.CSSProperties = { color: "var(--fog)", fontSize: 14, marginBottom: 8 };
const btnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px",
  borderRadius: 10, background: "var(--amber)", color: "var(--ink)",
  fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", marginBottom: 4,
};
