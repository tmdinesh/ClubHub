import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import EventCard from "@/components/EventCard";
import type { Event } from "@/types";

const baseEvent: Event = {
  id: "evt-001",
  title: "HackFest 2024",
  slug: "hackfest-2024",
  description: "A 24-hour hackathon",
  venue: "Main Auditorium",
  start_datetime: "2024-09-01T09:00:00Z",
  end_datetime: "2024-09-02T09:00:00Z",
  registration_start: null,
  registration_end: null,
  category: "Hackathon",
  event_type: "INTERNAL",
  status: "PUBLISHED",
  max_participants: 200,
  banner_url: null,
  organizer_club_id: "club-001",
  faculty_advisor_id: null,
  created_at: "2024-08-01T00:00:00Z",
};

function renderCard(event: Event) {
  return render(
    <BrowserRouter>
      <EventCard event={event} />
    </BrowserRouter>
  );
}

// Helper: find badge by partial text regardless of casing
function getBadge(text: string) {
  return screen.getByText((content) =>
    content.toLowerCase().includes(text.toLowerCase())
  );
}

describe("EventCard", () => {
  it("renders the event title", () => {
    renderCard(baseEvent);
    expect(screen.getByText("HackFest 2024")).toBeInTheDocument();
  });

  it("renders PUBLISHED status badge", () => {
    renderCard(baseEvent);
    const badge = getBadge("open");
    expect(badge).toBeInTheDocument();
  });

  it("renders DRAFT status badge", () => {
    renderCard({ ...baseEvent, status: "DRAFT" });
    const badge = getBadge("draft");
    expect(badge).toBeInTheDocument();
  });

  it("renders COMPLETED status badge", () => {
    renderCard({ ...baseEvent, status: "COMPLETED" });
    const badge = getBadge("ended");
    expect(badge).toBeInTheDocument();
  });

  it("renders PENDING_APPROVAL status badge", () => {
    renderCard({ ...baseEvent, status: "PENDING_APPROVAL" });
    const badge = getBadge("pending");
    expect(badge).toBeInTheDocument();
  });

  it("renders ARCHIVED status badge", () => {
    renderCard({ ...baseEvent, status: "ARCHIVED" });
    const badge = getBadge("archived");
    expect(badge).toBeInTheDocument();
  });

  it("renders venue when provided", () => {
    renderCard(baseEvent);
    expect(screen.getByText(/Main Auditorium/)).toBeInTheDocument();
  });

  it("renders category tag", () => {
    renderCard(baseEvent);
    expect(screen.getByText(/Hackathon/i)).toBeInTheDocument();
  });

  it("renders a link to the event detail page", () => {
    renderCard(baseEvent);
    const link = screen.getByRole("link", { name: /register/i });
    expect(link).toHaveAttribute("href", "/events/hackfest-2024");
  });
});
