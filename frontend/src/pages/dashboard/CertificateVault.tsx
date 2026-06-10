import { useQuery } from "@tanstack/react-query";
import { Award, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Certificate } from "@/types";
import { fmtDateLongIST } from "@/lib/dateIST";

const CERT_TYPE_STYLES: Record<Certificate["certificate_type"], { label: string; style: string }> = {
  PARTICIPATION: { label: "Participation", style: "bg-blue-50 text-blue-700 border-blue-200" },
  VOLUNTEER: { label: "Volunteer", style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  WINNER: { label: "Winner", style: "bg-amber-50 text-amber-700 border-amber-200" },
  RUNNER_UP: { label: "Runner Up", style: "bg-orange-50 text-orange-700 border-orange-200" },
};

const CERT_ACCENT: Record<Certificate["certificate_type"], string> = {
  PARTICIPATION: "from-blue-400 to-indigo-500",
  VOLUNTEER: "from-emerald-400 to-teal-500",
  WINNER: "from-amber-400 to-yellow-500",
  RUNNER_UP: "from-orange-400 to-amber-500",
};

function CertCard({ cert }: { cert: Certificate }) {
  const meta = CERT_TYPE_STYLES[cert.certificate_type];
  const accent = CERT_ACCENT[cert.certificate_type];

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group">
      {/* Top accent strip */}
      <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${accent} flex items-center justify-center`}>
            <Award size={18} className="text-white" />
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.style}`}>
            {meta.label}
          </span>
        </div>

        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-800 mb-1 truncate">
            {cert.event_title || "Event"}
          </p>
          <p className="text-xs font-mono text-slate-400 tracking-wide">{cert.unique_code}</p>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Issued {fmtDateLongIST(cert.issued_at)}
        </p>

        <div className="flex items-center gap-2 pt-4 border-t border-slate-50">
          {cert.pdf_url ? (
            <a
              href={cert.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-100 transition-colors"
            >
              <Download size={12} />
              Download PDF
            </a>
          ) : (
            <span className="text-xs text-slate-300 italic">PDF not ready</span>
          )}
          <Link
            to={`/verify/${cert.unique_code}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"
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
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden animate-pulse">
      <div className="h-1.5 bg-slate-100" />
      <div className="p-5 space-y-3">
        <div className="flex justify-between">
          <div className="w-10 h-10 rounded-lg bg-slate-100" />
          <div className="h-5 w-20 bg-slate-100 rounded-full" />
        </div>
        <div className="h-4 bg-slate-100 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        <div className="flex gap-2 pt-4 border-t border-slate-50">
          <div className="h-7 w-28 bg-slate-100 rounded-lg" />
          <div className="h-7 w-20 bg-slate-100 rounded-lg" />
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
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Award size={22} className="text-amber-500" />
            Certificate Vault
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            All certificates you've earned across events.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !certificates || certificates.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Award size={28} className="text-amber-400" />
            </div>
            <h3 className="text-slate-700 font-semibold mb-2">No certificates yet</h3>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              Participate in events and complete them to earn certificates that will appear here.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
            >
              Browse events <ExternalLink size={13} />
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-slate-500">
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
