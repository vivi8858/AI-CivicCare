export const categoryOptions = [
  { value: "Pothole", label: "Road / Pothole" },
  { value: "Garbage", label: "Garbage / Waste" },
  { value: "Water Leak", label: "Water Leak" },
  { value: "Street Light", label: "Street Light" },
  { value: "Drainage", label: "Drainage / Flooding" },
  { value: "Fallen Tree", label: "Fallen Tree" },
  { value: "Other", label: "Something Else" },
];

export const departmentRoutes = {
  Pothole: "Roads & Public Works",
  Garbage: "Sanitation Department",
  "Water Leak": "Water & Utilities",
  "Street Light": "Electrical Department",
  Drainage: "Drainage & Municipal Works",
  "Fallen Tree": "Horticulture Department",
  Other: "Municipal Helpdesk",
};

export const complaintStatuses = [
  "Submitted",
  "AI Reviewed",
  "Assigned",
  "In Progress",
  "Resolved",
  "Verified",
];

export const authorityStatusOptions = [
  "Submitted",
  "AI Reviewed",
  "Assigned",
  "In Progress",
  "Resolved",
];

export const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const commonWords = new Set([
  "the", "and", "near", "outside", "inside",
  "road", "issue", "there", "with", "from",
  "this", "that", "have", "has", "large",
  "small", "very", "problem", "area", "street",
  "around", "a", "an", "at", "of", "to",
  "in", "is", "on",
]);

export function words(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !commonWords.has(word))
  );
}

export function similarity(a, b) {
  const left = words(a);
  const right = words(b);

  if (!left.size || !right.size) return 0;

  let shared = 0;
  for (const word of left) {
    if (right.has(word)) shared += 1;
  }

  return shared / Math.min(left.size, right.size);
}

export function gpsDistanceMeters(a, b) {
  if (!a || !b) return Infinity;
  if (
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null
  ) {
    return Infinity;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function findPossibleDuplicate(
  category,
  description,
  location,
  coordinates,
  complaints
) {
  return (
    (complaints || []).find((item) => {
      if (
        item.category !== category ||
        ["Resolved", "Verified"].includes(item.status)
      ) {
        return false;
      }

      const distance = gpsDistanceMeters(coordinates, item.coordinates);
      const sameLocation =
        location.trim().toLowerCase() ===
        (item.location || "").trim().toLowerCase();
      const locationSimilarity = similarity(location, item.location);
      const descriptionSimilarity = similarity(description, item.description);
      const close =
        distance <= 150 || sameLocation || locationSimilarity >= 0.65;

      return close && (descriptionSimilarity >= 0.35 || distance <= 30);
    }) || null
  );
}

export function slaFromSeverity(severity) {
  return {
    Critical: "24 hours",
    High: "48 hours",
    Medium: "4 days",
    Low: "7 days",
  }[severity] || "4 days";
}

export function fallbackDescription(category, location) {
  const place = (location || "").trim() || "an unspecified location";
  const issue = (category || "Civic").trim();
  return `${issue} issue reported at ${place}.`;
}

export function assessIssue(
  category,
  description,
  complaints,
  location,
  coordinates
) {
  const text = `${category} ${description}`.toLowerCase();
  const hasAny = (keywords) => keywords.some((word) => text.includes(word));

  let severity = "Medium";

  if (
    hasAny([
      "fire",
      "electric shock",
      "live wire",
      "collapsed",
      "life threatening",
      "emergency",
    ])
  ) {
    severity = "Critical";
  } else if (
    hasAny([
      "dangerous",
      "accident",
      "injury",
      "school",
      "hospital",
      "flood",
      "major",
      "huge",
      "blocked",
      "busy road",
    ])
  ) {
    severity = "High";
  } else if (hasAny(["small", "minor", "slightly", "tiny"])) {
    severity = "Low";
  }

  const base = {
    Critical: 90,
    High: 75,
    Medium: 60,
    Low: 48,
  }[severity];

  const impact = hasAny([
    "school",
    "hospital",
    "busy road",
    "traffic",
    "many people",
    "accident",
    "dangerous",
    "emergency",
  ])
    ? 10
    : 0;

  const priority = Math.min(base + impact, 100);
  const possibleMatch = findPossibleDuplicate(
    category,
    description,
    location,
    coordinates,
    complaints
  );

  const duplicate = possibleMatch
    ? {
        id: possibleMatch.id,
        reports: possibleMatch.reports,
        location: possibleMatch.location,
        description: possibleMatch.description,
      }
    : null;

  return {
    severity,
    priority,
    department: departmentRoutes[category] || departmentRoutes.Other,
    sla: slaFromSeverity(severity),
    duplicate,
  };
}

export function displayName(user, profile) {
  return (
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "Neighbour"
  );
}

export function isAuthorityRole(profile) {
  return profile?.role === "authority";
}

export function shortComplaintId(id) {
  if (!id) return "CC-----";
  return `CC-${String(id).replace(/-/g, "").slice(-8).toUpperCase()}`;
}

export function validateImageFile(file, maxBytes = 5 * 1024 * 1024) {
  if (!file) return "Please choose a photo.";
  if (!file.type.startsWith("image/")) {
    return "Please select an image file.";
  }
  if (file.size > maxBytes) {
    return "Please select an image smaller than 5 MB.";
  }
  return null;
}

export function safeStorageFileName(file) {
  const ext = (file?.name || "jpg").split(".").pop()?.toLowerCase() || "jpg";
  const allowed = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const suffix = allowed.has(ext) ? ext : "jpg";
  return `${Date.now()}-${crypto.randomUUID?.() || Date.now()}.${suffix}`;
}

export function mapComplaint(row, evidence = []) {
  const original = evidence.find(
    (item) =>
      item.evidence_type === "original" || item.evidence_type === "before"
  );
  const resolution = evidence.find(
    (item) =>
      item.evidence_type === "resolution" || item.evidence_type === "after"
  );

  const latitude = row.latitude;
  const longitude = row.longitude;

  return {
    id: row.id,
    displayId: shortComplaintId(row.id),
    category: row.category,
    description: row.description,
    location: row.location,
    coordinates:
      latitude != null && longitude != null
        ? { latitude: Number(latitude), longitude: Number(longitude) }
        : null,
    severity: row.severity || "Medium",
    priority: Number(row.priority ?? 60),
    department: row.department || "Municipal Helpdesk",
    status: row.status || "Submitted",
    sla: row.sla || slaFromSeverity(row.severity),
    reports: Number(row.report_count ?? 1),
    date: row.created_at
      ? new Date(row.created_at).toLocaleDateString()
      : "",
    createdBy: row.created_by,
    duplicate: false,
    beforeImage: original?.signedUrl || null,
    afterImage: resolution?.signedUrl || null,
    confirmedByMe: Boolean(row.confirmedByMe),
  };
}

export function citizenVisibleComplaints(complaints, userId) {
  return (complaints || []).filter(
    (item) => item.createdBy === userId || item.confirmedByMe
  );
}

export function authorityScopedComplaints(complaints, profile) {
  if (profile?.role !== "authority") return [];
  if (!profile.department) return complaints || [];
  return (complaints || []).filter(
    (item) => item.department === profile.department
  );
}
