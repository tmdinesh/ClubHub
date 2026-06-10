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

const CHANNEL_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  EMAIL: { label: "Email", icon: <Mail size={13} />, color: "bg-sky-50 text-sky-700 border-sky-200" },
  IN_APP: { label: "In-App", icon: <Bell size={13} />, color: "bg-violet-50 text-violet-700 border-violet-200" },
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
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Megaphone size={22} className="text-indigo-500" />
            Announcements
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Send updates to all registered participants.
          </p>
        </div>

        {/* Compose form */}
        <div className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Send size={14} className="text-indigo-500" />
            New Announcement
          </h2>
          <form onSubmit={handleSubmit((d) => sendMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Title
              </label>
              <input
                type="text"
                {...register("title")}
                placeholder="Announcement title…"
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 placeholder:text-slate-300"
              />
              {errors.title && (
                <p className="text-xs text-red-500 mt-0.5">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Message
              </label>
              <textarea
                {...register("body")}
                rows={4}
                placeholder="Write your announcement here…"
                className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 placeholder:text-slate-300 resize-none"
              />
              {errors.body && (
                <p className="text-xs text-red-500 mt-0.5">{errors.body.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">
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
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm font-medium select-none ${
                            checked
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          }`}
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
                <p className="text-xs text-red-500 mt-0.5">{errors.channels.message}</p>
              )}
            </div>

            {sendMutation.isError && (
              <p className="text-xs text-red-600">Failed to send announcement. Try again.</p>
            )}
            {sendMutation.isSuccess && (
              <p className="text-xs text-emerald-600">Announcement sent successfully!</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={sendMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
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
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Megaphone size={14} className="text-slate-400" />
            Past Announcements
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-2/3 mt-1" />
                </div>
              ))}
            </div>
          ) : !announcements || announcements.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
              <Megaphone size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No announcements sent yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...announcements]
                .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
                .map((ann) => (
                  <div
                    key={ann.id}
                    className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-sm font-semibold text-slate-800">{ann.title}</h3>
                      <p className="text-xs text-slate-400 shrink-0">
                        {fmtDateTimeMedIST(ann.sent_at)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{ann.body}</p>
                    <div className="flex items-center gap-1.5 mt-3">
                      {(ann.channels ?? []).map((ch) => {
                        const meta = CHANNEL_LABELS[ch];
                        return (
                          <span
                            key={ch}
                            className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta?.color ?? "bg-slate-50 text-slate-500 border-slate-200"}`}
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
