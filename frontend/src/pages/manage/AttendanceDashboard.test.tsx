import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AttendanceDashboard from "@/pages/manage/AttendanceDashboard";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from "@/lib/api";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/manage/evt-001/attendance"]}>
        <Routes>
          <Route path="/manage/:eventId/attendance" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("AttendanceDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays present count from API", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { registered: 200, present: 150, absent: 50, rate: 0.75 },
    });
    render(<AttendanceDashboard />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
    });
  });

  it("displays registered count", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { registered: 200, present: 150, absent: 50, rate: 0.75 },
    });
    render(<AttendanceDashboard />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText("200")).toBeInTheDocument();
    });
  });

  it("shows attendance rate as percentage", async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { registered: 100, present: 83, absent: 17, rate: 0.83 },
    });
    render(<AttendanceDashboard />, { wrapper });
    await waitFor(() => {
      const elements = screen.getAllByText("83.0%");
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});
