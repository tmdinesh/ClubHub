import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Megaphone, Send, Loader2, Mail, Bell } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import { fmtDateTimeMedIST } from "@/lib/dateIST";

interface Announcement {
  id: string;
  title: string;
  body: string;
  channels: string[] | null;
  sent_at: string;
  created_by: string;
}

const announcementSchema = z.object({
  title: z.string().min(1, "Title required").max(120, "Max 120 characters"),
  body: z.string().min(1, "Body required"),
  channels: z.array(z.enum(["EMAIL", "IN_APP"])).min(1, "Select at least one channel"),
});

type AnnouncementForm = z.infer<typeof announcementSchema>;

const CHANNEL_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  EMAIL: { label: "Email", icon: <Mail size={13} /> },
  IN_APP: { label: "In-App", icon: <Bell size={13} /> },
};

export default function AnnouncementsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();

  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ["announcements", eventId],
    queryFn: () => api.get(`/events/${eventId}/announcements`).then((r) => r.data),
    enabled: !!eventId,
  });

  const sendMutation = useMutation({
    mutationFn: (data: AnnouncementForm) =>
      api.post(`/events/${eventId}/announcements`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", eventId] });
      reset();
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<AnnouncementForm>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { channels: ["IN_APP"] },
  });

  const selectedChannels = watch("channels") ?? [];

  return (
    <Layout eventId={eventId}>
      <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold tracking-tight flex items-center gap-2"
            style={{ color: "var(--cream)" }}
          >
            <Megaphone size={22} style={{ color: "var(--amber)" }} />
            Announcements
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>
            Send updates to all registered participants.
          </p>
        </div>

        {/* Compose form */}
        <div
          className="rounded-xl p-6 mb-6"
          style={{
            background: "var(--ink-soft)",
            border: "1px solid var(--seam)",
          }}
        >
          <h2
            className="text-sm font-semibold mb-4 flex items-center gap-2"
            style={{ color: "var(--cream)" }}
          >
            <Send size={14} style={{ color: "var(--amber)" }} />
            New Announcement
          </h2>
          <form onSubmit={handleSubmit((d) => sendMutation.mutate(d))} className="space-y-4">
            <div>
              <label
                className="text-xs font-semibold block mb-1"
                style={{ color: "var(--dust)" }}
              >
                Title
              </label>
              <input
                type="text"
                {...register("title")}
                placeholder="Announcement title…"
                className="w-full text-sm px-3 py-2.5 rounded-lg focus:outline-none"
                style={{
                  background: "var(--ink-muted)",
                  border: "1px solid var(--seam)",
                  color: "var(--cream)",
                  // @ts-ignore
                  "--placeholder-color": "var(--dust)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--amber)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--seam)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {errors.title && (
                <p className="text-xs mt-0.5" style={{ color: "var(--cinnabar)" }}>
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <label
                className="text-xs font-semibold block mb-1"
                style={{ color: "var(--dust)" }}
              >
                Message
              </label>
              <textarea
                {...register("body")}
                rows={4}
                placeholder="Write your announcement here…"
                className="w-full text-sm px-3 py-2.5 rounded-lg focus:outline-none resize-none"
                style={{
                  background: "var(--ink-muted)",
                  border: "1px solid var(--seam)",
                  color: "var(--cream)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--amber)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(245,166,35,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--seam)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {errors.body && (
                <p className="text-xs mt-0.5" style={{ color: "var(--cinnabar)" }}>
                  {errors.body.message}
                </p>
              )}
            </div>

            <div>
              <label
                className="text-xs font-semibold block mb-2"
                style={{ color: "var(--dust)" }}
              >
                Channels
              </label>
              <Controller
                name="channels"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    {(["EMAIL", "IN_APP"] as const).map((ch) => {
                      const meta = CHANNEL_LABELS[ch];
                      const checked = field.value?.includes(ch);
                      return (
                        <label
                          key={ch}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm font-medium select-none"
                          style={
                            checked
                              ? {
                                  background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                                  borderColor: "var(--amber)",
                                  color: "var(--amber)",
                                }
                              : {
                                  background: "var(--ink-muted)",
                                  border: "1px solid var(--seam)",
                                  color: "var(--fog)",
                                }
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...(field.value ?? []), ch]
                                : (field.value ?? []).filter((v) => v !== ch);
                              field.onChange(next);
                            }}
                            className="sr-only"
                          />
                          {meta.icon}
                          {meta.label}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
              {errors.channels && (
                <p className="text-xs mt-0.5" style={{ color: "var(--cinnabar)" }}>
                  {errors.channels.message}
                </p>
              )}
            </div>

            {sendMutation.isError && (
              <p className="text-xs" style={{ color: "var(--cinnabar)" }}>
                Failed to send announcement. Try again.
              </p>
            )}
            {sendMutation.isSuccess && (
              <p className="text-xs" style={{ color: "var(--jade)" }}>
                Announcement sent successfully!
              </p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={sendMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: "var(--amber)",
                  color: "var(--ink)",
                  opacity: sendMutation.isPending ? 0.4 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!sendMutation.isPending)
                    e.currentTarget.style.background = "var(--amber-glow)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--amber)";
                }}
              >
                {sendMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Send to{" "}
                {selectedChannels.length === 0
                  ? "…"
                  : selectedChannels.join(" & ")}
              </button>
            </div>
          </form>
        </div>

        {/* Past announcements */}
        <div>
          <h2
            className="text-sm font-semibold mb-3 flex items-center gap-2"
            style={{ color: "var(--cream)" }}
          >
            <Megaphone size={14} style={{ color: "var(--dust)" }} />
            Past Announcements
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 animate-pulse"
                  style={{
                    background: "var(--ink-soft)",
                    border: "1px solid var(--seam)",
                  }}
                >
                  <div
                    className="h-4 rounded w-1/3 mb-2"
                    style={{ background: "var(--ink-muted)" }}
                  />
                  <div
                    className="h-3 rounded w-full"
                    style={{ background: "var(--ink-muted)" }}
                  />
                  <div
                    className="h-3 rounded w-2/3 mt-1"
                    style={{ background: "var(--ink-muted)" }}
                  />
                </div>
              ))}
            </div>
          ) : !announcements || announcements.length === 0 ? (
            <div
              className="rounded-xl p-10 text-center"
              style={{
                background: "var(--ink-soft)",
                border: "1px solid var(--seam)",
              }}
            >
              <Megaphone size={32} className="mx-auto mb-3" style={{ color: "var(--dust)" }} />
              <p className="text-sm" style={{ color: "var(--fog)" }}>
                No announcements sent yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...announcements]
                .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
                .map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-xl p-4 transition-shadow"
                    style={{
                      background: "var(--ink-soft)",
                      border: "1px solid var(--seam)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-sm font-semibold" style={{ color: "var(--cream)" }}>
                        {ann.title}
                      </h3>
                      <p className="text-xs shrink-0" style={{ color: "var(--dust)" }}>
                        {fmtDateTimeMedIST(ann.sent_at)}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--fog)" }}>
                      {ann.body}
                    </p>
                    <div className="flex items-center gap-1.5 mt-3">
                      {(ann.channels ?? []).map((ch) => {
                        const meta = CHANNEL_LABELS[ch];
                        const badgeStyle =
                          ch === "EMAIL"
                            ? {
                                background: "color-mix(in srgb, var(--sky) 15%, transparent)",
                                color: "var(--sky)",
                                border: "1px solid color-mix(in srgb, var(--sky) 40%, transparent)",
                              }
                            : {
                                background: "color-mix(in srgb, var(--amber) 15%, transparent)",
                                color: "var(--amber)",
                                border: "1px solid color-mix(in srgb, var(--amber) 40%, transparent)",
                              };
                        return (
                          <span
                            key={ch}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={badgeStyle}
                          >
                            {meta?.icon}
                            {meta?.label ?? ch}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
