export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  venue: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  registration_start: string | null;
  registration_end: string | null;
  category: string | null;
  event_type: "INTERNAL" | "EXTERNAL";
  status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "COMPLETED" | "ARCHIVED";
  max_participants: number | null;
  banner_url: string | null;
  organizer_club_id: string;
  faculty_advisor_id: string | null;
  created_at: string;
  club_name: string;
  is_team_event: boolean;
  team_min_size: number;
  team_max_size: number;
}

export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  team_id: string | null;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "WAITLISTED";
  registered_at: string;
  confirmed_at: string | null;
  created_at: string;
  // enriched fields (present when fetched via /registrations/me)
  event_title: string;
  event_slug: string;
  event_start_datetime: string | null;
  club_name: string;
  is_team_event: boolean;
  team_min_size: number;
  team_max_size: number;
}

export interface Certificate {
  id: string;
  event_id: string;
  recipient_id: string;
  recipient_name: string;
  certificate_type: "PARTICIPATION" | "VOLUNTEER" | "WINNER" | "RUNNER_UP";
  unique_code: string;
  pdf_url: string | null;
  issued_at: string;
  event_title: string;
  metadata_: Record<string, string> | null;
}

export interface Team {
  id: string;
  event_id: string;
  name: string;
  lead_id: string;
  status: "FORMING" | "READY" | "SUBMITTED" | "DISQUALIFIED";
  max_size: number;
  min_size: number;
  is_public: boolean;
  join_key: string | null;
  created_at: string;
  member_count: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface FinanceSummary {
  total_budget: number;
  total_spent: number;
  remaining: number;
  by_category: {
    category: string;
    allocated: number;
    spent: number;
    variance: number;
  }[];
}

export interface AttendanceDashboard {
  registered: number;
  present: number;
  absent: number;
  rate: number;
}

export interface Club {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  department: string | null;
  is_active: boolean;
  faculty_advisor_id: string | null;
  created_at: string;
}
