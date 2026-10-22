import { supabase } from "./supabaseClient";
import {
  fallbackDescription,
  mapComplaint,
  safeStorageFileName,
} from "./civicLogic";

export { mapComplaint } from "./civicLogic";

export const EVIDENCE_BUCKET = "complaint-evidence";

async function signEvidence(rows) {
  if (!rows?.length) return [];

  return Promise.all(
    rows.map(async (row) => {
      if (!row.storage_path) return { ...row, signedUrl: null };

      const { data, error } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(row.storage_path, 60 * 60);

      return {
        ...row,
        signedUrl: error ? null : data?.signedUrl || null,
      };
    })
  );
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, department, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error && /department/.test(error.message || "")) {
    const fallback = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (fallback.error) throw fallback.error;
    return fallback.data;
  }

  if (error) throw error;
  return data;
}

export async function fetchConfirmedIds(userId) {
  const { data, error } = await supabase
    .from("complaint_reports")
    .select("complaint_id")
    .eq("user_id", userId);

  if (error) throw error;
  return new Set((data || []).map((row) => row.complaint_id));
}

export async function fetchComplaintsForUser(user) {
  const { data: rows, error } = await supabase
    .from("complaints")
    .select(
      "id, created_by, category, description, location, latitude, longitude, severity, priority, department, status, report_count, created_at, updated_at, sla"
    )
    .order("created_at", { ascending: false });

  let complaintRows = rows;
  if (error && /sla/.test(error.message || "")) {
    const retry = await supabase
      .from("complaints")
      .select(
        "id, created_by, category, description, location, latitude, longitude, severity, priority, department, status, report_count, created_at, updated_at"
      )
      .order("created_at", { ascending: false });
    if (retry.error) throw retry.error;
    complaintRows = retry.data;
  } else if (error) {
    throw error;
  }

  const ids = (complaintRows || []).map((row) => row.id);
  let evidenceRows = [];

  if (ids.length) {
    const evidence = await supabase
      .from("complaint_evidence")
      .select("id, complaint_id, evidence_type, storage_path, created_at")
      .in("complaint_id", ids);

    if (evidence.error && /storage_path/.test(evidence.error.message || "")) {
      const retry = await supabase
        .from("complaint_evidence")
        .select("id, complaint_id, evidence_type, created_at")
        .in("complaint_id", ids);
      if (!retry.error) evidenceRows = retry.data || [];
    } else if (!evidence.error) {
      evidenceRows = await signEvidence(evidence.data || []);
    }
  }

  const confirmed = user?.id
    ? await fetchConfirmedIds(user.id)
    : new Set();

  const byComplaint = new Map();
  for (const item of evidenceRows) {
    const list = byComplaint.get(item.complaint_id) || [];
    list.push(item);
    byComplaint.set(item.complaint_id, list);
  }

  return (complaintRows || []).map((row) =>
    mapComplaint(
      { ...row, confirmedByMe: confirmed.has(row.id) },
      byComplaint.get(row.id) || []
    )
  );
}

export async function fetchSimilarComplaints({
  category,
  latitude,
  longitude,
  location,
}) {
  const { data, error } = await supabase.rpc("find_similar_complaints", {
    p_category: category,
    p_latitude: latitude ?? null,
    p_longitude: longitude ?? null,
    p_location: location,
  });

  if (error) return [];

  return (data || []).map((row) =>
    mapComplaint({
      ...row,
      report_count: row.report_count ?? row.reports,
      created_by: row.created_by || null,
    })
  );
}

export async function fetchHotspots() {
  const { data, error } = await supabase.rpc("get_civic_hotspots");
  if (error) throw error;
  return data || [];
}

export async function submitComplaintRecord({
  category,
  description,
  location,
  coordinates,
}) {
  const finalDescription =
    (description || "").trim() || fallbackDescription(category, location);

  const { data, error } = await supabase.rpc("submit_complaint", {
    p_category: category,
    p_description: finalDescription,
    p_latitude: coordinates?.latitude ?? null,
    p_location: location.trim(),
    p_longitude: coordinates?.longitude ?? null,
  });

  if (error) throw error;
  return data;
}

export async function confirmExistingIssue(complaintId) {
  const { error } = await supabase.rpc("confirm_existing_issue", {
    p_complaint_id: complaintId,
  });
  if (error) throw error;
}

export async function processComplaint(complaintId, newStatus, note = "") {
  const { error } = await supabase.rpc("process_complaint", {
    p_complaint_id: complaintId,
    p_new_status: newStatus,
    p_note: note || "",
  });
  if (error) throw error;
}

export async function reviewResolution(complaintId, approved, note = "") {
  const { error } = await supabase.rpc("review_resolution", {
    p_approved: approved,
    p_complaint_id: complaintId,
    p_note: note || "",
  });
  if (error) throw error;
}

export async function registerEvidence(complaintId, evidenceType, storagePath) {
  const { error } = await supabase.rpc("register_evidence", {
    p_complaint_id: complaintId,
    p_evidence_type: evidenceType,
    p_storage_path: storagePath,
  });
  if (error) throw error;
}

export async function uploadEvidenceFile(userId, complaintId, file) {
  const path = `${userId}/${complaintId}/${safeStorageFileName(file)}`;
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  return path;
}
