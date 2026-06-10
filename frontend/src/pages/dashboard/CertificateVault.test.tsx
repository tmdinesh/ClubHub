import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import CertificateVault from "@/pages/dashboard/CertificateVault";
import type { Certificate } from "@/types";

// Mock the api module
vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
  },
}));

import api from "@/lib/api";
const mockedApi = vi.mocked(api);

const mockCertificates: Certificate[] = [
  {
    id: "cert-001",
    event_id: "evt-001",
    recipient_id: "user-001",
    certificate_type: "PARTICIPATION",
    unique_code: "CERT-HACK-ABCD1234",
    pdf_url: "/media/certificates/CERT-HACK-ABCD1234.pdf",
    issued_at: "2024-09-03T10:00:00Z",
  },
  {
    id: "cert-002",
    event_id: "evt-002",
    recipient_id: "user-001",
    certificate_type: "WINNER",
    unique_code: "CERT-FEST-EFGH5678",
    pdf_url: "/media/certificates/CERT-FEST-EFGH5678.pdf",
    issued_at: "2024-10-01T12:00:00Z",
  },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe("CertificateVault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders certificates after loading", async () => {
    (mockedApi.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockCertificates,
    });
    render(<CertificateVault />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText("CERT-HACK-ABCD1234")).toBeInTheDocument();
    });
  });

  it("shows both certificate entries", async () => {
    (mockedApi.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: mockCertificates,
    });
    render(<CertificateVault />, { wrapper });
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /download/i })).toHaveLength(2);
    });
  });

  it("download button links to pdf_url", async () => {
    (mockedApi.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [mockCertificates[0]],
    });
    render(<CertificateVault />, { wrapper });
    await waitFor(() => {
      const downloadLinks = screen.getAllByRole("link", { name: /download/i });
      expect(downloadLinks[0]).toHaveAttribute(
        "href",
        "/media/certificates/CERT-HACK-ABCD1234.pdf"
      );
    });
  });

  it("shows empty state when no certificates", async () => {
    (mockedApi.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [],
    });
    render(<CertificateVault />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/no certificates/i)).toBeInTheDocument();
    });
  });
});
