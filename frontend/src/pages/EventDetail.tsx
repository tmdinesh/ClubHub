import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  format,
  formatDistanceToNow,
  isPast,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";
import {
  MapPin,
  Calendar,
  Clock,
  Users,
  Building2,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import api, { apiError } from "@/lib/api";
import type { Event } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/auth.store";
import { fmtTimeIST, fmtDateTimeMedIST } from "@/lib/dateIST";

const STATUS_BADGE: Record<Event["status"], { label: string; variant: string }> = {
  PUBLISHED: { label: "Published", variant: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Completed", variant: "bg-gray-100 text-gray-600" },
  DRAFT: { label: "Draft", variant: "bg-yellow-100 text-yellow-700" },
  PENDING_APPROVAL: { label: "Pending Approval", variant: "bg-orange-100 text-orange-700" },
  ARCHIVED: { label: "Archived", variant: "bg-muted text-muted-foreground" },
};

function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(deadline);

  if (isPast(target)) {
    return (
      <span className="text-sm font-medium text-destructive">
        Registration closed
      </span>
    );
  }

  const days = differenceInDays(target, now);
  const hours = differenceInHours(target, now) % 24;
  const minutes = differenceInMinutes(target, now) % 60;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="h-4 w-4 text-amber-500" />
      <span className="font-medium text-foreground">
        Registration closes in{" "}
        <span className="text-amber-600">
          {days > 0 ? `${days}d ` : ""}
          {hours > 0 ? `${hours}h ` : ""}
          {minutes}m
        </span>
      </span>
    </div>
  );
}

export default function EventDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const {
    data: event,
    isLoading,
    isError,
  } = useQuery<Event>({
    queryKey: ["event", slug],
    queryFn: async () => {
      const res = await api.get<Event>(`/events/${slug}`);
      return res.data;
    },
    enabled: !!slug,
  });

  const [registered, setRegistered] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error("No event");
      await api.post(`/events/${event.id}/register`);
    },
    onSuccess: () => {
      setRegistered(true);
      setRegisterError(null);
    },
    onError: (err: unknown) => {
      setRegisterError(apiError(err, "Registration failed. Please try again."));
    },
  });

  function handleRegister() {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    registerMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl py-8">
          <Skeleton className="mb-4 h-5 w-24" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-semibold">Event not found</p>
        <Button asChild variant="outline">
          <Link to="/">Back to Events</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_BADGE[event.status];
  const registrationOpen =
    event.registration_end && !isPast(new Date(event.registration_end));

  return (
    <div className="min-h-screen bg-background">
      {/* Back link */}
      <div className="container max-w-4xl py-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Events
        </Link>
      </div>

      {/* Banner */}
      <div className="container max-w-4xl">
        <div className="relative overflow-hidden rounded-xl bg-muted">
          {event.banner_url ? (
            <img
              src={event.banner_url}
              alt={event.title}
              className="h-72 w-full object-cover sm:h-96"
            />
          ) : (
            <div className="flex h-72 w-full items-center justify-center bg-gradient-to-br from-primary/20 to-accent/30 sm:h-96">
              <span className="text-6xl font-black text-primary/20">
                {event.title.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="absolute right-4 top-4">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${statusConfig.variant}`}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            {event.category && (
              <span className="inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                {event.category}
              </span>
            )}

            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {event.title}
            </h1>

            {event.description && (
              <div className="prose prose-sm max-w-none text-foreground/80">
                <p className="whitespace-pre-line leading-relaxed">
                  {event.description}
                </p>
              </div>
            )}

            {/* Agenda section placeholder */}
            <div className="rounded-lg border bg-muted/30 p-5">
              <h2 className="mb-3 text-lg font-semibold text-foreground">
                Event Details
              </h2>
              <div className="space-y-3">
                {event.start_datetime && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">
                        {new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Kolkata",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date(event.start_datetime))}
                      </p>
                      <p className="text-muted-foreground">
                        {fmtTimeIST(event.start_datetime)}
                        {event.end_datetime &&
                          ` – ${fmtTimeIST(event.end_datetime)}`}
                      </p>
                    </div>
                  </div>
                )}

                {event.venue && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <span>{event.venue}</span>
                  </div>
                )}

                {event.max_participants && (
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="h-4 w-4 shrink-0 text-primary" />
                    <span>Max {event.max_participants} participants</span>
                  </div>
                )}

                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">
                    Organised by {event.club_name}
                  </span>
                </div>

                {event.is_team_event && (
                  <div className="flex items-start gap-3 text-sm rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2.5">
                    <Users className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-indigo-700">Team Event</p>
                      <p className="text-indigo-600 text-xs mt-0.5">
                        Teams of {event.team_min_size}–{event.team_max_size} members.
                        Register first, then create or join a team from your dashboard.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Registration CTA */}
          <div className="space-y-4">
            <Card className="sticky top-20">
              <CardContent className="p-5 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Registration
                </h2>

                {event.registration_start && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Opens: </span>
                    {fmtDateTimeMedIST(event.registration_start)}
                  </div>
                )}

                {event.registration_end && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Closes: </span>
                    {fmtDateTimeMedIST(event.registration_end)}
                  </div>
                )}

                {event.registration_end && registrationOpen && (
                  <Countdown deadline={event.registration_end} />
                )}

                {registered ? (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="font-medium">
                      You&apos;re registered!
                    </span>
                  </div>
                ) : (
                  <>
                    {registerError && (
                      <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        {registerError}
                      </div>
                    )}
                    <Button
                      className="w-full"
                      onClick={handleRegister}
                      disabled={
                        registerMutation.isPending ||
                        event.status !== "PUBLISHED" ||
                        !registrationOpen
                      }
                    >
                      {registerMutation.isPending
                        ? "Registering..."
                        : !isAuthenticated
                        ? "Sign in to Register"
                        : event.status !== "PUBLISHED"
                        ? "Registration Unavailable"
                        : !registrationOpen
                        ? "Registration Closed"
                        : "Register Now"}
                    </Button>

                    {!isAuthenticated && (
                      <p className="text-center text-xs text-muted-foreground">
                        You&apos;ll be redirected to sign in.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
