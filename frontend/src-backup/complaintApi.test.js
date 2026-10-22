import { describe, expect, it } from "vitest";
import {
  authorityScopedComplaints,
  citizenVisibleComplaints,
  mapComplaint,
} from "./civicLogic";

describe("mapComplaint", () => {
  it("maps a Supabase row into the existing card shape", () => {
    const mapped = mapComplaint(
      {
        id: "11111111-1111-1111-1111-111111111111",
        created_by: "user-1",
        category: "Garbage",
        description: "Overflowing bin",
        location: "Park Gate",
        latitude: 28.6,
        longitude: 77.2,
        severity: "Medium",
        priority: 65,
        department: "Sanitation Department",
        status: "Resolved",
        report_count: 3,
        created_at: "2026-10-15T10:00:00.000Z",
        confirmedByMe: true,
      },
      [
        { evidence_type: "original", signedUrl: "https://example/before.jpg" },
        { evidence_type: "resolution", signedUrl: "https://example/after.jpg" },
      ]
    );

    expect(mapped.displayId).toMatch(/^CC-/);
    expect(mapped.reports).toBe(3);
    expect(mapped.coordinates).toEqual({
      latitude: 28.6,
      longitude: 77.2,
    });
    expect(mapped.beforeImage).toBe("https://example/before.jpg");
    expect(mapped.afterImage).toBe("https://example/after.jpg");
    expect(mapped.confirmedByMe).toBe(true);
  });
});

describe("isolation helpers used by dashboards", () => {
  it("does not let a citizen dashboard keep another citizen's unconfirmed row", () => {
    const mine = citizenVisibleComplaints(
      [
        { id: "mine", createdBy: "a", confirmedByMe: false },
        { id: "theirs", createdBy: "b", confirmedByMe: false },
      ],
      "a"
    );
    expect(mine.map((item) => item.id)).toEqual(["mine"]);
  });

  it("hides the authority queue from a citizen profile", () => {
    expect(
      authorityScopedComplaints(
        [{ id: "1", department: "Roads & Public Works" }],
        { role: "citizen" }
      )
    ).toEqual([]);
  });
});
