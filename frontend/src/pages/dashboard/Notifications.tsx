import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Bell, CheckCheck, Inbox, Circle } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Notification } from "@/types";

const TYPE_COLORS: Record<string, string> = {
  EVENT_UPDATE: "text-blue-500 bg-blue-50",
  REGISTRATION_CONFIRMED: "text-emerald-600 bg-emerald-50",
  CERTIFICATE_ISSUED: "text-amber-600 bg-amber-50",
  ANNOUNCEMENT: "text-indigo-600 bg-indigo-50",
  TEAM_INVITE: "text-violet-600 bg-violet-50",
};

function NotificationItem({ notif, onMarkRead }: { notif: Notification; onMarkRead: (id: string) => void }) {
  const colorClass = TYPE_COLORS[notif.type] ?? "text-slate-500 bg-slate-50";

  return (
    <div
      className={`flex items-start gap-4 px-5 py-4 transition-colors ${
        notif.is_read ? "bg-white" : "bg-indigo-50/30"
      }`}
    >
      {/* Unread indicator */}
      <div className="mt-1 shrink-0">
        {!notif.is_read ? (
          <Circle size={8} className="text-indigo-500 fill-indigo-500" />
        ) : (
          <Circle size={8} className="text-transparent" />
        )}
      </div>

      <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center shrink-0`}>
        <Bell size={14} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`text-sm font-semibold ${notif.is_read ? "text-slate-700" : "text-slate-900"}`}>
              {notif.title}
            </p>
            <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{notif.body}</p>
          </div>
          <p className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
            {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true })}
          </p>
        </div>
        {!notif.is_read && (
          <button type="button"
            onClick={() => onMarkRead(notif.id)}
            className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <CheckCheck size={12} />
            Mark as read
          </button>
        )}
      </div>
    </div>
  );
}

function SkeletonNotif() {
  return (
    <div className="flex items-start gap-4 px-5 py-4 animate-pulse">
      <div className="w-2 h-2 mt-2 rounded-full bg-slate-100 shrink-0" />
      <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-100 rounded w-1/3" />
        <div className="h-3 bg-slate-100 rounded w-2/3" />
      </div>
    </div>
  );
}

export default function Notifications() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch("/notifications/read-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;
  const sorted = [...(notifications ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Layout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Bell size={22} className="text-indigo-500" />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <CheckCheck size={15} />
              Mark all read
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {isLoading ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonNotif key={i} />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <Inbox size={24} className="text-slate-300" />
              </div>
              <h3 className="text-slate-600 font-semibold mb-1">No notifications</h3>
              <p className="text-slate-400 text-sm">You're all caught up. Check back later.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {sorted.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notif={notif}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
