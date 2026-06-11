import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MeetingBanking from "@/components/meeting/MeetingBanking";

const updateMock = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "row-1",
                  meeting_id: "m-1",
                  bank_name: "First Bank",
                  loc_amount: 25000,
                  loc_interest_rate: "5%",
                },
              ],
              error: null,
            }),
          }),
        }),
        update: updateMock,
        insert: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  };
});

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MeetingBanking LOC Amount currency formatting", () => {
  beforeEach(() => updateMock.mockClear());

  it("displays the saved amount formatted as currency", async () => {
    renderWithClient(<MeetingBanking meetingId="m-1" />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("$25,000.00")).toBeInTheDocument();
    });
  });

  it("sanitizes typing and formats on blur, saving the numeric value", async () => {
    renderWithClient(<MeetingBanking meetingId="m-1" />);
    const input = (await screen.findByDisplayValue("$25,000.00")) as HTMLInputElement;

    fireEvent.focus(input);
    expect(input.value).toBe("25000.00");

    fireEvent.change(input, { target: { value: "$12,345.6abc" } });
    expect(input.value).toBe("12345.6");

    fireEvent.blur(input);
    expect(input.value).toBe("$12,345.60");
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ loc_amount: 12345.6 });
    });
  });

  it("clears to null when emptied", async () => {
    renderWithClient(<MeetingBanking meetingId="m-1" />);
    const input = (await screen.findByDisplayValue("$25,000.00")) as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(input.value).toBe("");
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ loc_amount: null });
    });
  });
});
