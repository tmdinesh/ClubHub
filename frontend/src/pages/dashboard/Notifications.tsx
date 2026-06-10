import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Bell, CheckCheck, Inbox, Circle } from "lucide-react";
import Layout from "@/components/Layout";
import api from "@/lib/api";
import type { Notification } from "@/types";

interface TypeStyle {
  color: string;
  background: string;
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  EVENT_UPDATE: {
    color: "var(--sky)",
    background: "color-mix(in srgb, var(--sky) 12%, transparent)",
  },
  REGISTRATION_CONFIRMED: {
    color: "var(--jade)",
    background: "color-mix(in srgb, var(--jade) 12%, transparent)",
  },
  CERTIFICATE_ISSUED: {
    color: "var(--amber)",
    background: "color-mix(in srgb, var(--amber) 12%, transparent)",
  },
  ANNOUNCEMENT: {
    color: "var(--amber)",
    background: "color-mix(in srgb, var(--amber) 12%, transparent)",
  },
  TEAM_INVITE: {
    color: "var(--sky)",
    background: "color-mix(in srgb, var(--sky) 12%, transparent)",
  },
};

const DEFAULT_TYPE_STYLE: TypeStyle = {
  color: "var(--fog)",
  background: "var(--ink-muted)",
};

function NotificationItem({ notif, onMarkRead }: { notif: Notification; onMarkRead: (id: string) => void }) {
  const typeStyle = TYPE_STYLES[notif.type] ?? DEFAULT_TYPE_STYLE;

  return (
    <div
      className="flex items-start gap-4 px-5 py-4 transition-colors"
      style={{
        background: notif.is_read
          ? "transparent"
          : "color-mix(in srgb, var(--amber) 5%, transparent)",
      }}
    >
      {/* Unread indicator */}
      <div className="mt-1 shrink-0">
        {!notif.is_read ? (
          <Circle
            size={8}
            style={{ color: "var(--amber)", fill: "var(--amber)" }}
          />
        ) : (
          <Circle size={8} style={{ color: "transparent" }} />
        )}
      </div>

      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ color: typeStyle.color, background: typeStyle.background }}
      >
        <Bell size={14} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: notif.is_read ? "var(--cream)" : "var(--cream)" }}
            >
              {notif.title}
            </p>
            <p className="text-sm mt-0.5 leading-relaxed" style={{ color: "var(--fog)" }}>
              {notif.body}
            </p>
          </div>
          <p className="text-xs shrink-0 whitespace-nowrap" style={{ color: "var(--ash)" }}>
            {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true })}
          </p>
        </div>
        {!notif.is_read && (
          <button
            type="button"
            onClick={() => onMarkRead(notif.id)}
            className="mt-2 flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: "var(--amber)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--amber-glow)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--amber)";
            }}
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
      <div
        className="w-2 h-2 mt-2 rounded-full shrink-0"
        style={{ background: "var(--ink-muted)" }}
      />
      <div
        className="w-8 h-8 rounded-lg shrink-0"
        style={{ background: "var(--ink-muted)" }}
      />
      <div className="flex-1 space-y-2">
        <div className="h-4 rounded w-1/3" style={{ background: "var(--ink-muted)" }} />
        <div className="h-3 rounded w-2/3" style={{ background: "var(--ink-muted)" }} />
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
            <h1
              className="text-2xl font-bold tracking-tight flex items-center gap-2"
              style={{ color: "var(--cream)" }}
            >
              <Bell size={22} style={{ color: "var(--amber)" }} />
              Notifications
              {unreadCount > 0 && (
                <span
                  className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                  style={{ background: "var(--amber)", color: "var(--ink)" }}
                >
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--fog)" }}>
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
              style={{ color: "var(--amber)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "color-mix(in srgb, var(--amber) 8%, transparent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <CheckCheck size={15} />
              Mark all read
            </button>
          )}
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--ink-soft)", border: "1px solid var(--seam)" }}
        >
          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={i > 0 ? { borderTop: "1px solid var(--seam)" } : undefined}
                >
                  <SkeletonNotif />
                </div>
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-16 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--ink-muted)" }}
              >
                <Inbox size={24} style={{ color: "var(--ash)" }} />
              </div>
              <h3 className="font-semibold mb-1" style={{ color: "var(--fog)" }}>
                No notifications
              </h3>
              <p className="text-sm" style={{ color: "var(--ash)" }}>
                You're all caught up. Check back later.
              </p>
            </div>
          ) : (
            <div>
              {sorted.map((notif, i) => (
                <div
                  key={notif.id}
                  style={i > 0 ? { borderTop: "1px solid var(--seam)" } : undefined}
                >
                  <NotificationItem
                    notif={notif}
                    onMarkRead={(id) => markReadMutation.mutate(id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
