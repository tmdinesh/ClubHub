import { useQuery } from "@tanstack/react-query";
import { Award, ExternalLink, Mail, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Certificate } from "@/types";
import { fmtDateLongIST } from "@/lib/dateIST";

const CERT_TYPE_META: Record<Certificate["certificate_type"], { label: string }> = {
  PARTICIPATION: { label: "Participation" },
  VOLUNTEER:     { label: "Volunteer" },
  WINNER:        { label: "Winner" },
  RUNNER_UP:     { label: "Runner Up" },
};

const CERT_ACCENT_STYLE: Record<Certificate["certificate_type"], React.CSSProperties> = {
  PARTICIPATION: { background: "linear-gradient(to right, var(--sky), var(--amber))" },
  VOLUNTEER:     { background: "linear-gradient(to right, var(--jade), var(--sky))" },
  WINNER:        { background: "linear-gradient(to right, var(--amber), var(--amber-glow))" },
  RUNNER_UP:     { background: "linear-gradient(to right, var(--amber-dim), var(--amber))" },
};

const CERT_BADGE_STYLE: Record<Certificate["certificate_type"], React.CSSProperties> = {
  PARTICIPATION: {
    background: "color-mix(in srgb, var(--sky) 12%, transparent)",
    color: "var(--sky)",
    border: "1px solid color-mix(in srgb, var(--sky) 30%, transparent)",
  },
  VOLUNTEER: {
    background: "color-mix(in srgb, var(--jade) 12%, transparent)",
    color: "var(--jade)",
    border: "1px solid color-mix(in srgb, var(--jade) 30%, transparent)",
  },
  WINNER: {
    background: "color-mix(in srgb, var(--amber) 12%, transparent)",
    color: "var(--amber)",
    border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
  },
  RUNNER_UP: {
    background: "color-mix(in srgb, var(--amber) 12%, transparent)",
    color: "var(--amber)",
    border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)",
  },
};

function CertCard({ cert }: { cert: Certificate }) {
  const meta = CERT_TYPE_META[cert.certificate_type];
  const accentStyle = CERT_ACCENT_STYLE[cert.certificate_type];
  const badgeStyle = CERT_BADGE_STYLE[cert.certificate_type];

  return (
    <div
      className="rounded-xl overflow-hidden hover:shadow-md transition-shadow group"
      style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
    >
      {/* Top accent strip */}
      <div className="h-1.5" style={accentStyle} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={accentStyle}
          >
            <Award size={18} className="text-white" />
          </div>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={badgeStyle}
          >
            {meta.label}
          </span>
        </div>

        <div className="mb-4">
          <p className="text-sm font-semibold mb-1 truncate" style={{ color: "var(--cream)" }}>
            {cert.event_title || "Event"}
          </p>
          <p className="text-xs font-mono tracking-wide" style={{ color: "var(--ash)" }}>
            {cert.unique_code}
          </p>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--ash)" }}>
          Issued {fmtDateLongIST(cert.issued_at)}
        </p>

        <div
          className="flex items-center gap-2 pt-4"
          style={{ borderTop: "1px solid var(--seam)" }}
        >
          <span
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: "color-mix(in srgb, var(--jade) 12%, transparent)",
              color: "var(--jade)",
            }}
          >
            <Mail size={12} />
            Sent to your email
          </span>
          <Link
            to={`/verify/${cert.unique_code}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: "var(--ink-muted)", color: "var(--fog)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "color-mix(in srgb, var(--cream) 8%, var(--ink-muted))";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--ink-muted)";
            }}
          >
            <ShieldCheck size={12} />
            Verify
          </Link>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl overflow-hidden animate-pulse"
      style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
    >
      <div className="h-1.5" style={{ background: "var(--ink-muted)" }} />
      <div className="p-5 space-y-3">
        <div className="flex justify-between">
          <div className="w-10 h-10 rounded-lg" style={{ background: "var(--ink-muted)" }} />
          <div className="h-5 w-20 rounded-full" style={{ background: "var(--ink-muted)" }} />
        </div>
        <div className="h-4 rounded w-3/4" style={{ background: "var(--ink-muted)" }} />
        <div className="h-3 rounded w-1/2" style={{ background: "var(--ink-muted)" }} />
        <div className="h-3 rounded w-1/3" style={{ background: "var(--ink-muted)" }} />
        <div className="flex gap-2 pt-4" style={{ borderTop: "1px solid var(--seam)" }}>
          <div className="h-7 w-28 rounded-lg" style={{ background: "var(--ink-muted)" }} />
          <div className="h-7 w-20 rounded-lg" style={{ background: "var(--ink-muted)" }} />
        </div>
      </div>
    </div>
  );
}

export default function CertificateVault() {
  const { data: certificates, isLoading } = useQuery<Certificate[]>({
    queryKey: ["certificates", "me"],
    queryFn: () => api.get("/certificates/me").then((r) => r.data),
  });

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold tracking-tight flex items-center gap-2"
            style={{ color: "var(--cream)" }}
          >
            <Award size={22} style={{ color: "var(--amber)" }} />
            Certificate Vault
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>
            All certificates you've earned across events.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !certificates || certificates.length === 0 ? (
          <div
            className="rounded-xl p-16 text-center"
            style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--amber-dim)" }}
            >
              <Award size={28} style={{ color: "var(--amber)" }} />
            </div>
            <h3 className="font-semibold mb-2" style={{ color: "var(--cream)" }}>
              No certificates yet
            </h3>
            <p className="text-sm max-w-xs mx-auto" style={{ color: "var(--ash)" }}>
              Participate in events and complete them to earn certificates that will appear here.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-1.5 text-sm hover:underline"
              style={{ color: "var(--amber)" }}
            >
              Browse events <ExternalLink size={13} />
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm" style={{ color: "var(--fog)" }}>
              {certificates.length} certificate{certificates.length !== 1 ? "s" : ""} earned
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {certificates.map((cert) => (
                <CertCard key={cert.id} cert={cert} />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
