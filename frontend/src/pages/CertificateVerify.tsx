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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      {/* Brand mark */}
      <div className="mb-8 flex items-center gap-2">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <span className="text-xl font-bold text-foreground">
          ClubOps Certificate Verification
        </span>
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-8">
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Verifying certificate...
              </p>
            </div>
          )}

          {/* Error / fetch failed */}
          {isError && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-10 w-10 text-destructive" />
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
              <div className="mt-2 rounded-md bg-muted px-4 py-2 font-mono text-sm text-muted-foreground">
                Code: {code}
              </div>
            </div>
          )}

          {/* Valid certificate */}
          {!isLoading && !isError && data?.valid && (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-green-600">
                  Certificate Verified
                </p>
                <h2 className="mt-1 text-2xl font-bold text-foreground">
                  {data.recipient ?? "Recipient"}
                </h2>
              </div>

              <div className="w-full space-y-3 text-left">
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <InfoRow
                    label="Event"
                    value={data.event ?? "—"}
                  />
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
                  <InfoRow
                    label="Certificate Code"
                    value={code ?? ""}
                    mono
                  />
                </div>
              </div>
            </div>
          )}

          {/* Invalid certificate */}
          {!isLoading && !isError && data && !data.valid && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-10 w-10 text-destructive" />
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
              <div className="mt-2 rounded-md bg-muted px-4 py-2 font-mono text-sm text-muted-foreground">
                Code: {code}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        This verification is provided by ClubOps. Certificates are
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
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={`text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
