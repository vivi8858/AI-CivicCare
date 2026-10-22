import { describe, expect, it } from "vitest";
import {
  assessIssue,
  authorityScopedComplaints,
  citizenVisibleComplaints,
  fallbackDescription,
  findPossibleDuplicate,
  isAuthorityRole,
  slaFromSeverity,
  validateImageFile,
} from "./civicLogic";

const nearby = {
  latitude: 28.6139,
  longitude: 77.209,
};

describe("fallbackDescription", () => {
  it("builds a safe description when the citizen leaves the field empty", () => {
    expect(fallbackDescription("Pothole", "Connaught Place")).toBe(
      "Pothole issue reported at Connaught Place."
    );
  });
});

describe("assessIssue", () => {
  it("labels itself as a rule-based demo through explicit severity rules", () => {
    const result = assessIssue(
      "Pothole",
      "Dangerous hole near the school",
      [],
      "Main Road",
      nearby
    );
    expect(result.severity).toBe("High");
    expect(result.department).toBe("Roads & Public Works");
    expect(result.sla).toBe(slaFromSeverity("High"));
  });
});

describe("findPossibleDuplicate", () => {
  it("matches a nearby active complaint of the same category", () => {
    const existing = [
      {
        id: "a",
        category: "Pothole",
        description: "Dangerous hole near the school gate",
        location: "Main Road",
        coordinates: nearby,
        status: "Submitted",
        reports: 2,
      },
    ];

    const match = findPossibleDuplicate(
      "Pothole",
      "Dangerous hole near the school",
      "Main Road",
      nearby,
      existing
    );

    expect(match?.id).toBe("a");
  });
});

describe("visibility helpers", () => {
  const rows = [
    { id: "1", createdBy: "citizen-a", confirmedByMe: false, department: "Roads & Public Works" },
    { id: "2", createdBy: "citizen-b", confirmedByMe: true, department: "Sanitation Department" },
  ];

  it("keeps a citizen on their own or confirmed complaints", () => {
    expect(citizenVisibleComplaints(rows, "citizen-a").map((item) => item.id)).toEqual([
      "1",
      "2",
    ]);
    expect(citizenVisibleComplaints(rows, "citizen-c").map((item) => item.id)).toEqual([
      "2",
    ]);
  });

  it("does not treat a browser-supplied role as authority", () => {
    expect(isAuthorityRole({ role: "authority" })).toBe(true);
    expect(isAuthorityRole({ role: "citizen" })).toBe(false);
    expect(isAuthorityRole({ role: "authority", fromBrowser: true })).toBe(true);
    expect(isAuthorityRole(null)).toBe(false);
  });

  it("scopes authority queues by department when set", () => {
    const scoped = authorityScopedComplaints(rows, {
      role: "authority",
      department: "Roads & Public Works",
    });
    expect(scoped.map((item) => item.id)).toEqual(["1"]);
  });
});

describe("validateImageFile", () => {
  it("rejects non-images and oversized files", () => {
    expect(validateImageFile({ type: "application/pdf", size: 10 })).toMatch(/image/);
    expect(
      validateImageFile({ type: "image/jpeg", size: 6 * 1024 * 1024 })
    ).toMatch(/5 MB/);
    expect(validateImageFile({ type: "image/jpeg", size: 100 })).toBeNull();
  });
});
