import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";
import api from "@/lib/api";
import type { Certificate } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDateLongIST } from "@/lib/dateIST";

interface VerifyResponse {
  valid: boolean;
  recipient?: string;
  event?: string;
  certificate_type?: Certificate["certificate_type"];
  issued_at?: string;
  message?: string;
}

const CERT_TYPE_LABEL: Record<Certificate["certificate_type"], string> = {
  PARTICIPATION: "Participation Certificate",
  VOLUNTEER: "Volunteer Certificate",
  WINNER: "Winner Certificate",
  RUNNER_UP: "Runner-Up Certificate",
};

export default function CertificateVerify() {
  const { code } = useParams<{ code: string }>();

  const { data, isLoading, isError } = useQuery<VerifyResponse>({
    queryKey: ["verify", code],
    queryFn: async () => {
      const res = await api.get<VerifyResponse>(`/verify/${code}`);
      return res.data;
    },
    enabled: !!code,
    retry: false,
  });

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: "var(--ink)" }}
    >
      {/* Brand mark */}
      <div className="mb-8 flex items-center gap-2">
        <ShieldCheck className="h-7 w-7" style={{ color: "var(--amber)" }} />
        <span className="text-xl font-bold" style={{ color: "var(--cream)" }}>
          ClubHub Certificate Verification
        </span>
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-8">
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin" style={{ color: "var(--amber)" }} />
              <p className="text-sm text-muted-foreground">
                Verifying certificate...
              </p>
            </div>
          )}

          {/* Error / fetch failed */}
          {isError && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--cinnabar) 15%, transparent)",
                }}
              >
                <XCircle className="h-10 w-10" style={{ color: "var(--cinnabar)" }} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Verification Failed
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Unable to verify the certificate. Please check the code and
                  try again.
                </p>
              </div>
              <div
                className="mt-2 rounded-md px-4 py-2 font-mono text-sm"
                style={{
                  background: "var(--ink-muted)",
                  color: "var(--ash)",
                  border: "1px solid var(--seam)",
                }}
              >
                Code: {code}
              </div>
            </div>
          )}

          {/* Valid certificate */}
          {!isLoading && !isError && data?.valid && (
            <div className="flex flex-col items-center gap-6 text-center">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--jade) 15%, transparent)",
                }}
              >
                <CheckCircle2 className="h-12 w-12" style={{ color: "var(--jade)" }} />
              </div>

              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--jade)" }}
                >
                  Certificate Verified
                </p>
                <h2
                  className="mt-1 text-2xl font-bold"
                  style={{ color: "var(--cream)" }}
                >
                  {data.recipient ?? "Recipient"}
                </h2>
              </div>

              <div className="w-full space-y-3 text-left">
                <div
                  className="rounded-lg p-4 space-y-3"
                  style={{
                    background: "var(--ink-muted)",
                    border: "1px solid var(--seam)",
                  }}
                >
                  <InfoRow label="Event" value={data.event ?? "—"} />
                  {data.certificate_type && (
                    <InfoRow
                      label="Certificate Type"
                      value={CERT_TYPE_LABEL[data.certificate_type]}
                    />
                  )}
                  {data.issued_at && (
                    <InfoRow
                      label="Issued On"
                      value={fmtDateLongIST(data.issued_at)}
                    />
                  )}
                  <InfoRow label="Certificate Code" value={code ?? ""} mono />
                </div>
              </div>
            </div>
          )}

          {/* Invalid certificate */}
          {!isLoading && !isError && data && !data.valid && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{
                  background: "color-mix(in srgb, var(--cinnabar) 15%, transparent)",
                }}
              >
                <XCircle className="h-10 w-10" style={{ color: "var(--cinnabar)" }} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Certificate Not Found
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data.message ??
                    "No certificate matches this verification code. It may have been revoked or the code is incorrect."}
                </p>
              </div>
              <div
                className="mt-2 rounded-md px-4 py-2 font-mono text-sm"
                style={{
                  background: "var(--ink-muted)",
                  color: "var(--ash)",
                  border: "1px solid var(--seam)",
                }}
              >
                Code: {code}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs" style={{ color: "var(--dust)" }}>
        This verification is provided by ClubHub. Certificates are
        cryptographically signed and tamper-evident.
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
      <span
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--fog)" }}
      >
        {label}
      </span>
      <span
        className={`text-sm font-semibold ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--cream)" }}
      >
        {value}
      </span>
    </div>
  );
}
