
import { useRef, useState } from "react";
import Login from "./Login";
import "./App.css";

const starterComplaints = [
  {
    id: "CC-1001",
    category: "Pothole",
    description: "Large pothole outside the main market.",
    location: "New Delhi",
    coordinates: null,
    severity: "High",
    priority: 88,
    department: "Roads & Public Works",
    status: "In Progress",
    sla: "48 hours",
    reports: 6,
    date: "Today",
    duplicate: false,
    beforeImage: null,
    afterImage: null,
  },
  {
    id: "CC-1000",
    category: "Garbage",
    description: "Overflowing garbage bin near the park.",
    location: "New Delhi",
    coordinates: null,
    severity: "Medium",
    priority: 65,
    department: "Sanitation Department",
    status: "Resolved",
    sla: "4 days",
    reports: 3,
    date: "Yesterday",
    duplicate: false,
    beforeImage: null,
    afterImage: null,
  },
];

const categoryOptions = [
  { value: "Pothole", label: "Road / Pothole" },
  { value: "Garbage", label: "Garbage / Waste" },
  { value: "Water Leak", label: "Water Leak" },
  { value: "Street Light", label: "Street Light" },
  { value: "Drainage", label: "Drainage / Flooding" },
  { value: "Fallen Tree", label: "Fallen Tree" },
  { value: "Other", label: "Something Else" },
];

const departmentRoutes = {
  Pothole: "Roads & Public Works",
  Garbage: "Sanitation Department",
  "Water Leak": "Water & Utilities",
  "Street Light": "Electrical Department",
  Drainage: "Drainage & Municipal Works",
  "Fallen Tree": "Horticulture Department",
  Other: "Municipal Helpdesk",
};

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Ignore common words when comparing descriptions.
const commonWords = new Set([
  "the", "and", "near", "outside", "inside",
  "road", "issue", "there", "with", "from",
  "this", "that", "have", "has", "large",
  "small", "very", "problem", "area", "street",
  "around", "a", "an", "at", "of", "to",
  "in", "is", "on",
]);

function words(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 2 && !commonWords.has(word)
      )
  );
}

// Compare the important words in two pieces of text.
function similarity(a, b) {
  const left = words(a);
  const right = words(b);

  if (!left.size || !right.size) return 0;

  let shared = 0;

  for (const word of left) {
    if (right.has(word)) shared++;
  }

  return shared / Math.min(left.size, right.size);
}

// Calculate approximate distance between two GPS points.
function gpsDistanceMeters(a, b) {
  if (!a || !b) return Infinity;

  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return (
    6371000 *
    2 *
    Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  );
}

// Find a possible duplicate among active complaints.
function findPossibleDuplicate(
  category,
  description,
  location,
  coordinates,
  complaints
) {
  return (
    complaints.find((item) => {
      if (
        item.category !== category ||
        ["Resolved", "Verified"].includes(item.status)
      ) {
        return false;
      }

      const distance = gpsDistanceMeters(
        coordinates,
        item.coordinates
      );

      const sameLocation =
        location.trim().toLowerCase() ===
        (item.location || "").trim().toLowerCase();

      const locationSimilarity = similarity(
        location,
        item.location
      );

      const descriptionSimilarity = similarity(
        description,
        item.description
      );

      const close =
        distance <= 150 ||
        sameLocation ||
        locationSimilarity >= 0.65;

      return (
        close &&
        (descriptionSimilarity >= 0.35 || distance <= 30)
      );
    }) || null
  );
}

// Demo rule-based assessment, not a trained AI model.
function assessIssue(
  category,
  description,
  complaints,
  location,
  coordinates
) {
  const text = `${category} ${description}`.toLowerCase();

  const hasAny = (keywords) =>
    keywords.some((word) => text.includes(word));

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
  } else if (
    hasAny(["small", "minor", "slightly", "tiny"])
  ) {
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

  const sla = {
    Critical: "24 hours",
    High: "48 hours",
    Medium: "4 days",
    Low: "7 days",
  }[severity];

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
    department:
      departmentRoutes[category] || departmentRoutes.Other,
    sla,
    duplicate,
  };
}

function readComplaints() {
  try {
    const saved = localStorage.getItem(
      "civiccare_complaints"
    );

    const parsed = saved ? JSON.parse(saved) : null;

    return Array.isArray(parsed)
      ? parsed
      : starterComplaints;
  } catch {
    return starterComplaints;
  }
}

function App() {
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("report");
  const [complaints, setComplaints] =
    useState(readComplaints);

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);

  const [image, setImage] = useState(null);
  const [imageName, setImageName] = useState("");

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [analysisRunning, setAnalysisRunning] =
    useState(false);

  const [analysisStage, setAnalysisStage] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [message, setMessage] = useState("");

  const [selectedComplaint, setSelectedComplaint] =
    useState(null);

  const [pendingReport, setPendingReport] = useState(null);

  const fileInputRef = useRef(null);
  const afterImageRef = useRef(null);

  function saveComplaints(updated) {
    setComplaints(updated);

    try {
      // Browser blob URLs cannot persist as real uploads.
      localStorage.setItem(
        "civiccare_complaints",
        JSON.stringify(
          updated.map((complaint) => ({
            ...complaint,
            beforeImage: null,
            afterImage: null,
          }))
        )
      );
    } catch {
      setMessage(
        "Storage is full or unavailable. Reports may not persist."
      );
    }
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Please select an image smaller than 5 MB.");
      return;
    }

    if (image) URL.revokeObjectURL(image);

    setImage(URL.createObjectURL(file));
    setImageName(file.name);
    setAnalysis(null);
    setPendingReport(null);
    setMessage("");
  }

  function removeImage() {
    if (image) URL.revokeObjectURL(image);

    setImage(null);
    setImageName("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function reverseGeocode(latitude, longitude) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
      );

      if (!response.ok) {
        throw new Error("Address lookup failed");
      }

      const data = await response.json();

      setLocation(
        data.display_name ||
          `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      );
    } catch {
      setLocation(
        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      );
    }
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setMessage(
        "Location detection is not supported on this device."
      );
      return;
    }

    setLocationLoading(true);
    setMessage("Detecting your location...");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const nextCoordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        setCoordinates(nextCoordinates);

        await reverseGeocode(
          coords.latitude,
          coords.longitude
        );

        setLocationLoading(false);
        setAnalysis(null);
        setPendingReport(null);

        setMessage(
          "Location detected. Please check the address."
        );
      },
      (error) => {
        setLocationLoading(false);

        setMessage(
          error.code === 1
            ? "Location permission denied. Enter it manually."
            : "Could not detect location. Enter it manually."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  async function runAnalysis() {
    if (
      !category ||
      !description.trim() ||
      !location.trim()
    ) {
      setMessage(
        "Please enter the issue type, description and location."
      );
      return null;
    }

    setAnalysisRunning(true);
    setMessage("");

    const stages = [
      "Understanding the issue...",
      "Calculating priority...",
      "Checking possible duplicates...",
      "Finding a department...",
    ];

    for (const stage of stages) {
      setAnalysisStage(stage);
      await delay(350);
    }

    const result = assessIssue(
      category,
      description,
      complaints,
      location,
      coordinates
    );

    setAnalysis(result);
    setAnalysisRunning(false);
    setAnalysisStage("");

    return result;
  }

  function resetReport() {
    setCategory("");
    setDescription("");
    setLocation("");
    setCoordinates(null);

    removeImage();

    setAnalysis(null);
    setPendingReport(null);
    setMessage("");
  }

  function createNewComplaint(result) {
    const complaint = {
      id: `CC-${Date.now()}`,
      category,
      description: description.trim(),
      location: location.trim(),
      coordinates,
      severity: result.severity,
      priority: result.priority,
      department: result.department,
      status: "Submitted",
      sla: result.sla,
      reports: 1,
      date: new Date().toLocaleDateString(),
      duplicate: false,
      beforeImage: image,
      afterImage: null,
    };

    saveComplaints([complaint, ...complaints]);
    resetReport();

    setActivePage("complaints");
    setSelectedComplaint(complaint);
  }

  async function submitComplaint(event) {
    event.preventDefault();

    if (analysisRunning) return;

    const result = await runAnalysis();
    if (!result) return;

    if (result.duplicate) {
      // Ask before merging.
      setPendingReport(result);
      return;
    }

    createNewComplaint(result);
  }

  // Merge the new report into an existing complaint.
  function mergeWithExisting() {
    if (!pendingReport?.duplicate) return;

    const id = pendingReport.duplicate.id;

    const existing = complaints.find(
      (complaint) => complaint.id === id
    );

    if (
      !existing ||
      ["Resolved", "Verified"].includes(existing.status)
    ) {
      setPendingReport(null);
      setMessage(
        "That complaint is no longer active. Please submit again."
      );
      return;
    }

    const updated = complaints.map((complaint) =>
      complaint.id === id
        ? {
            ...complaint,
            reports: complaint.reports + 1,
            priority: Math.min(
              100,
              complaint.priority + 3
            ),
          }
        : complaint
    );

    saveComplaints(updated);
    resetReport();

    setActivePage("complaints");

    setSelectedComplaint(
      updated.find((complaint) => complaint.id === id)
    );
  }

  function confirmSameIssue(id) {
    const updated = complaints.map((complaint) =>
      complaint.id === id
        ? {
            ...complaint,
            reports: complaint.reports + 1,
            priority: Math.min(
              100,
              complaint.priority + 3
            ),
          }
        : complaint
    );

    saveComplaints(updated);

    setSelectedComplaint(
      updated.find((complaint) => complaint.id === id) ||
        null
    );
  }

  function handleAfterImage(event) {
    const file = event.target.files?.[0];

    if (!file || !selectedComplaint) return;

    if (
      !file.type.startsWith("image/") ||
      file.size > 5 * 1024 * 1024
    ) {
      return;
    }

    const afterImage = URL.createObjectURL(file);

    const updated = complaints.map((complaint) =>
      complaint.id === selectedComplaint.id
        ? { ...complaint, afterImage }
        : complaint
    );

    saveComplaints(updated);

    setSelectedComplaint((previous) => ({
      ...previous,
      afterImage,
    }));
  }

  const totalReports = complaints.length;

  const activeReports = complaints.filter(
    (complaint) =>
      complaint.status !== "Resolved" &&
      complaint.status !== "Verified"
  ).length;

  const resolvedReports = complaints.filter(
    (complaint) =>
      complaint.status === "Resolved" ||
      complaint.status === "Verified"
  ).length;

  const highPriorityReports = complaints.filter(
    (complaint) => complaint.priority >= 80
  ).length;

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => setActivePage("report")}
        >
          <div className="brand-mark">✳</div>

          <div>
            <div className="brand-name">
              AI CivicCare
            </div>

            <div className="brand-tagline">
              A little care makes a better city
            </div>
          </div>
        </button>

        <nav
          className="navigation"
          aria-label="Main navigation"
        >
          <button
            type="button"
            className={`nav-button ${
              activePage === "report" ? "active" : ""
            }`}
            onClick={() => setActivePage("report")}
          >
            Report Issue
          </button>

          <button
            type="button"
            className={`nav-button ${
              activePage === "complaints" ? "active" : ""
            }`}
            onClick={() => setActivePage("complaints")}
          >
            My Complaints
            <span className="nav-count">
              {complaints.length}
            </span>
          </button>
        </nav>

        <div className="system-status">
          <span className="live-dot" />
          Demo assessment
        </div>

        <button
          type="button"
          className="logout-button"
          onClick={() => {
            setSelectedComplaint(null);
            setUser(null);
          }}
        >
          Log out
        </button>
      </header>

      <main className="main-content">
        {activePage === "report" ? (
          <section className="report-page">
            <div className="hero">
              <div>
                <div className="eyebrow">
                  WELCOME,{" "}
                  {user.name?.toUpperCase() || "NEIGHBOUR"}
                </div>

                <h1>
                  Little actions.
                  <br />
                  <span>Lovelier cities.</span>
                </h1>

                <p>
                  Spot a problem in your neighbourhood?
                  Share the details and location.
                  CivicCare will estimate its urgency
                  and suggest the responsible department.
                </p>
              </div>

              <div className="hero-ai-card">
                <span className="hero-ai-icon">
                  ✳
                </span>

                <div>
                  <strong>
                    Thoughtful civic reporting
                  </strong>

                  <small>
                    Report → Assess → Track → Verify
                  </small>
                </div>
              </div>
            </div>

            <div className="stats-row">
              <Stat
                title="Total reports"
                value={totalReports}
              />

              <Stat
                title="High priority"
                value={highPriorityReports}
              />

              <Stat
                title="Active issues"
                value={activeReports}
              />

              <Stat
                title="Resolved"
                value={resolvedReports}
              />
            </div>

            <form
              className="report-card"
              onSubmit={submitComplaint}
            >
              <div className="card-header">
                <div>
                  <h2>Report a civic issue</h2>

                  <p>
                    Tell us what needs attention
                    in your community.
                  </p>
                </div>

                <span className="secure-label">
                  Local demo
                </span>
              </div>

              <div className="report-steps">
                <div className="step-pill active">
                  <span>1</span>
                  Evidence
                </div>

                <div className="step-pill">
                  <span>2</span>
                  Details
                </div>

                <div className="step-pill">
                  <span>3</span>
                  Review
                </div>
              </div>

              <div className="form-grid">
                <div className="form-section">
                  <label>
                    Photo evidence (optional)
                  </label>

                  <div
                    className={`upload-box ${
                      image ? "has-image" : ""
                    }`}
                  >
                    {image ? (
                      <>
                        <img
                          className="preview-image"
                          src={image}
                          alt="Complaint photo preview"
                        />

                        <div className="preview-actions">
                          <button
                            type="button"
                            onClick={() =>
                              fileInputRef.current?.click()
                            }
                          >
                            Replace
                          </button>

                          <button
                            type="button"
                            onClick={removeImage}
                          >
                            Remove
                          </button>
                        </div>

                        <small>{imageName}</small>
                      </>
                    ) : (
                      <>
                        <span className="upload-symbol">
                          ↑
                        </span>

                        <strong>Add a photo</strong>

                        <p>
                          Show us what needs attention
                        </p>

                        <button
                          type="button"
                          className="gps-button"
                          onClick={() =>
                            fileInputRef.current?.click()
                          }
                        >
                          Choose image
                        </button>

                        <small>
                          Image up to 5 MB
                        </small>
                      </>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleImageChange}
                    aria-label="Choose complaint photo"
                  />
                </div>

                <div className="form-section">
                  <label htmlFor="category">
                    What is the problem?
                  </label>

                  <select
                    id="category"
                    value={category}
                    required
                    onChange={(event) => {
                      setCategory(event.target.value);
                      setAnalysis(null);
                      setPendingReport(null);
                    }}
                  >
                    <option value="">
                      Choose an issue
                    </option>

                    {categoryOptions.map((item) => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="description">
                    Tell us what you noticed
                  </label>

                  <textarea
                    id="description"
                    rows={5}
                    required
                    value={description}
                    placeholder="For example: A pothole outside the school is causing traffic problems."
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setAnalysis(null);
                      setPendingReport(null);
                    }}
                  />

                  <label htmlFor="location">
                    Where is the problem?
                  </label>

                  <div className="location-area">
                    <input
                      id="location"
                      value={location}
                      required
                      placeholder="Enter a street or area"
                      onChange={(event) => {
                        setLocation(event.target.value);
                        setCoordinates(null);
                        setAnalysis(null);
                        setPendingReport(null);
                      }}
                    />

                    <button
                      type="button"
                      className="gps-button"
                      onClick={getLocation}
                      disabled={locationLoading}
                    >
                      {locationLoading
                        ? "Detecting..."
                        : "⌖ Detect my location"}
                    </button>
                  </div>

                  {coordinates && (
                    <small className="coordinates">
                      GPS:{" "}
                      {coordinates.latitude.toFixed(5)},
                      {" "}
                      {coordinates.longitude.toFixed(5)}
                    </small>
                  )}
                </div>
              </div>

              {message && (
                <div
                  className="message"
                  role="status"
                >
                  {message}
                </div>
              )}

              {!analysis && !analysisRunning && (
                <div className="analyse-row">
                  <div>
                    <strong>
                      Ready for a quick assessment?
                    </strong>

                    <p>
                      We'll estimate severity, priority
                      and department using demo rules.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="analyse-button"
                    onClick={runAnalysis}
                  >
                    ✳ Analyse issue
                  </button>
                </div>
              )}

              {analysisRunning && (
                <div
                  className="ai-processing"
                  role="status"
                >
                  <span className="processing-dot" />

                  <div>
                    <strong>
                      Assessing your report
                    </strong>

                    <p>{analysisStage}</p>
                  </div>
                </div>
              )}

              {analysis && (
                <AIAnalysis analysis={analysis} />
              )}

              {pendingReport?.duplicate && (
                <div
                  className="ai-analysis-card"
                  role="region"
                  aria-label="Confirm possible duplicate"
                >
                  <div className="analysis-kicker">
                    POSSIBLE DUPLICATE — YOUR CHOICE
                  </div>

                  <h3>
                    Is this the same problem?
                  </h3>

                  <p>
                    Existing complaint{" "}
                    <strong>
                      {pendingReport.duplicate.id}
                    </strong>
                    :{" "}
                    {pendingReport.duplicate.description}
                  </p>

                  <p>
                    Location:{" "}
                    {pendingReport.duplicate.location}
                  </p>

                  <p>
                    Already reported by{" "}
                    <strong>
                      {pendingReport.duplicate.reports}
                    </strong>{" "}
                    citizen(s).
                  </p>

                  <p>
                    Matching is only a suggestion.
                    Please check before combining reports.
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      marginTop: 16,
                    }}
                  >
                    <button
                      type="button"
                      className="submit-button"
                      onClick={mergeWithExisting}
                    >
                      Yes, same issue — add my report
                    </button>

                    <button
                      type="button"
                      className="gps-button"
                      onClick={() =>
                        createNewComplaint(pendingReport)
                      }
                    >
                      No, different issue — create new
                    </button>
                  </div>
                </div>
              )}

              <div className="form-footer">
                <span>
                  This is a student prototype;
                  reports are stored only in this browser.
                </span>

                <button
                  type="submit"
                  className="submit-button"
                  disabled={
                    analysisRunning ||
                    Boolean(pendingReport)
                  }
                >
                  {pendingReport
                    ? "Choose an option above"
                    : "Submit complaint →"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="complaints-page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  YOUR COMMUNITY ACTIVITY
                </div>

                <h1>My complaints</h1>

                <p>
                  Follow your reports from
                  submission to resolution.
                </p>
              </div>

              <button
                type="button"
                className="submit-button"
                onClick={() =>
                  setActivePage("report")
                }
              >
                + New report
              </button>
            </div>

            <div className="complaints-list">
              {complaints.length ? (
                complaints.map((complaint) => (
                  <ComplaintCard
                    key={complaint.id}
                    complaint={complaint}
                    onOpen={() =>
                      setSelectedComplaint(complaint)
                    }
                  />
                ))
              ) : (
                <p>
                  No reports yet. Create your first report.
                </p>
              )}
            </div>
          </section>
        )}
      </main>

      {selectedComplaint && (
        <ComplaintModal
          complaint={selectedComplaint}
          onClose={() =>
            setSelectedComplaint(null)
          }
          onSameIssue={() =>
            confirmSameIssue(selectedComplaint.id)
          }
          afterImageRef={afterImageRef}
          onAfterImage={handleAfterImage}
        />
      )}
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AIAnalysis({ analysis }) {
  return (
    <div className="ai-analysis-card">
      <div className="analysis-heading">
        <div>
          <span className="analysis-kicker">
            ✳ RULE-BASED DEMO ASSESSMENT
          </span>

          <h3>Assessment complete</h3>
        </div>

        <div className="priority-score">
          <strong>{analysis.priority}</strong>
          <span>/100</span>
        </div>
      </div>

      <div className="analysis-grid">
        <AnalysisItem
          title="Severity"
          value={analysis.severity}
          className={`severity-text ${analysis.severity.toLowerCase()}`}
        />

        <AnalysisItem
          title="Priority"
          value={
            analysis.priority >= 85
              ? "Urgent"
              : analysis.priority >= 65
              ? "Important"
              : "Normal"
          }
        />

        <AnalysisItem
          title="Suggested department"
          value={analysis.department}
        />

        <AnalysisItem
          title="Illustrative resolution target"
          value={analysis.sla}
        />
      </div>

      {analysis.duplicate ? (
        <div className="duplicate-warning">
          <strong>
            Possible similar report
          </strong>

          <p>
            {analysis.duplicate.id} may describe
            a similar issue.{" "}
            {analysis.duplicate.reports} report(s)
            already exist.
          </p>
        </div>
      ) : (
        <div className="analysis-success">
          No obvious matching active report found
          by the demo checker.
        </div>
      )}
    </div>
  );
}

function AnalysisItem({
  title,
  value,
  className = "",
}) {
  return (
    <div className="analysis-item">
      <span>{title}</span>

      <strong className={className}>
        {value}
      </strong>
    </div>
  );
}

function ComplaintCard({
  complaint,
  onOpen,
}) {
  return (
    <button
      type="button"
      className="complaint-card"
      onClick={onOpen}
    >
      <div className="complaint-card-top">
        <div>
          <span className="complaint-id">
            {complaint.id}
          </span>

          <h3>{complaint.category}</h3>
          <p>{complaint.description}</p>
        </div>

        <div className="complaint-score">
          <span>Priority</span>
          <strong>{complaint.priority}</strong>
        </div>
      </div>

      <div className="complaint-tags">
        <span
          className={`severity-tag ${complaint.severity.toLowerCase()}`}
        >
          {complaint.severity}
        </span>

        <span>{complaint.department}</span>
        <span>Target: {complaint.sla}</span>
      </div>

      <ComplaintTimeline
        status={complaint.status}
      />

      <div className="complaint-card-footer">
        <span>⌖ {complaint.location}</span>

        <span>
          {complaint.reports} citizen report(s)
        </span>

        <strong>View details →</strong>
      </div>
    </button>
  );
}

function ComplaintTimeline({ status }) {
  const steps = [
    "Submitted",
    "AI Reviewed",
    "Assigned",
    "In Progress",
    "Resolved",
    "Verified",
  ];

  const progress = {
    Submitted: 1,
    "AI Reviewed": 2,
    Assigned: 3,
    "In Progress": 4,
    Resolved: 5,
    Verified: 6,
  };

  const current = progress[status] || 1;

  return (
    <div
      className="timeline"
      aria-label={`Complaint status: ${status}`}
    >
      {steps.map((step, index) => (
        <div
          key={step}
          className={`timeline-step ${
            index < current ? "done" : ""
          }`}
        >
          <span />
          <small>{step}</small>
        </div>
      ))}
    </div>
  );
}

function ComplaintModal({
  complaint,
  onClose,
  onSameIssue,
  afterImageRef,
  onAfterImage,
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="complaint-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Complaint ${complaint.id}`}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="modal-header">
          <div>
            <span className="analysis-kicker">
              {complaint.id}
            </span>

            <h2>{complaint.category}</h2>
            <p>{complaint.description}</p>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close details"
          >
            ×
          </button>
        </div>

        <div className="analysis-grid modal-grid">
          <AnalysisItem
            title="Severity"
            value={complaint.severity}
          />

          <AnalysisItem
            title="Priority"
            value={`${complaint.priority}/100`}
          />

          <AnalysisItem
            title="Suggested department"
            value={complaint.department}
          />

          <AnalysisItem
            title="Illustrative target"
            value={complaint.sla}
          />
        </div>

        <div className="modal-section">
          <h3>Complaint lifecycle</h3>

          <ComplaintTimeline
            status={complaint.status}
          />
        </div>

        <div className="community-card">
          <div>
            <strong>
              Is this issue also affecting you?
            </strong>

            <p>
              {complaint.reports} citizen(s)
              have confirmed this issue.
            </p>
          </div>

          <button
            type="button"
            onClick={onSameIssue}
          >
            + Same issue
          </button>
        </div>

        {complaint.status === "Resolved" && (
          <div className="verification-card">
            <span className="analysis-kicker">
              RESOLUTION VERIFICATION
            </span>

            <h3>Review the repair</h3>

            <p>
              Compare before and after photos.
              Adding an after photo does not
              automatically verify the repair.
            </p>

            <div className="verification-images">
              <div>
                <span>Before</span>

                {complaint.beforeImage ? (
                  <img
                    src={complaint.beforeImage}
                    alt="Before repair"
                  />
                ) : (
                  <div className="image-placeholder">
                    No saved original photo
                  </div>
                )}
              </div>

              <div>
                <span>After</span>

                {complaint.afterImage ? (
                  <img
                    src={complaint.afterImage}
                    alt="After repair"
                  />
                ) : (
                  <button
                    type="button"
                    className="after-upload"
                    onClick={() =>
                      afterImageRef.current?.click()
                    }
                  >
                    + Add after photo
                  </button>
                )}
              </div>
            </div>

            <input
              ref={afterImageRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onAfterImage}
              aria-label="Upload after photo"
            />

            {complaint.afterImage && (
              <div className="analysis-success">
                Before/after review is available
                for this session.
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <span>{complaint.location}</span>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
