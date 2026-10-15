import { useRef, useState } from "react";
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
  { value: "Pothole", label: "🛣️ Road / Pothole" },
  { value: "Garbage", label: "🗑️ Garbage / Waste" },
  { value: "Water Leak", label: "💧 Water Leak" },
  { value: "Street Light", label: "💡 Street Light" },
  { value: "Drainage", label: "🌧️ Drainage / Flooding" },
  { value: "Fallen Tree", label: "🌳 Fallen Tree" },
  { value: "Other", label: "📍 Something Else" },
];

function App() {
  const fileInputRef = useRef(null);
  const afterImageRef = useRef(null);

  const [activePage, setActivePage] = useState("report");

  const [image, setImage] = useState(null);
  const [imageName, setImageName] = useState("");

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState(null);

  const [locationLoading, setLocationLoading] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [message, setMessage] = useState("");

  const [selectedComplaint, setSelectedComplaint] = useState(null);

  const [complaints, setComplaints] = useState(() => {
    const saved = localStorage.getItem("civiccare_complaints");

    if (!saved) {
      return starterComplaints;
    }

    try {
      return JSON.parse(saved);
    } catch {
      return starterComplaints;
    }
  });

  const saveComplaints = (updated) => {
    setComplaints(updated);

    localStorage.setItem(
      "civiccare_complaints",
      JSON.stringify(updated)
    );
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImage(URL.createObjectURL(file));
    setImageName(file.name);
    setAnalysis(null);
    setMessage("");
  };

  const removeImage = () => {
    setImage(null);
    setImageName("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
      );

      if (!response.ok) {
        throw new Error("Address lookup failed");
      }

      const data = await response.json();

      if (data.display_name) {
        setLocation(data.display_name);
      } else {
        setLocation(
          `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        );
      }
    } catch {
      setLocation(
        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      );
    }
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setMessage(
        "Location detection is not supported on this device."
      );
      return;
    }

    setLocationLoading(true);
    setMessage("Detecting your location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setCoordinates({
          latitude,
          longitude,
        });

        await reverseGeocode(latitude, longitude);

        setLocationLoading(false);
        setMessage("Location detected.");
      },
      (error) => {
        setLocationLoading(false);

        if (error.code === 1) {
          setMessage(
            "Location permission was denied. You can enter the location manually."
          );
        } else {
          setMessage(
            "We could not detect your location. Please enter it manually."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const detectSeverity = () => {
    const text = `${category} ${description}`.toLowerCase();

    const criticalWords = [
      "fire",
      "electric shock",
      "live wire",
      "collapsed",
      "life threatening",
      "emergency",
    ];

    const highWords = [
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
    ];

    const lowWords = [
      "small",
      "minor",
      "slightly",
      "tiny",
    ];

    if (
      criticalWords.some((word) =>
        text.includes(word)
      )
    ) {
      return "Critical";
    }

    if (
      highWords.some((word) =>
        text.includes(word)
      )
    ) {
      return "High";
    }

    if (
      lowWords.some((word) =>
        text.includes(word)
      )
    ) {
      return "Low";
    }

    return "Medium";
  };

  const calculatePriority = (severity) => {
    let score = 40;

    if (severity === "Critical") {
      score += 50;
    } else if (severity === "High") {
      score += 35;
    } else if (severity === "Medium") {
      score += 20;
    } else {
      score += 8;
    }

    const text = `${category} ${description}`.toLowerCase();

    const impactWords = [
      "school",
      "hospital",
      "busy road",
      "traffic",
      "many people",
      "accident",
      "dangerous",
      "emergency",
    ];

    if (
      impactWords.some((word) =>
        text.includes(word)
      )
    ) {
      score += 10;
    }

    return Math.min(score, 100);
  };

  const getDepartment = () => {
    const routes = {
      Pothole: "Roads & Public Works",
      Garbage: "Sanitation Department",
      "Water Leak": "Water & Utilities",
      "Street Light": "Electrical Department",
      Drainage: "Drainage & Municipal Works",
      "Fallen Tree": "Horticulture Department",
      Other: "Municipal Helpdesk",
    };

    return routes[category] || "Municipal Helpdesk";
  };

  const getSla = (severity) => {
    if (severity === "Critical") {
      return "24 hours";
    }

    if (severity === "High") {
      return "48 hours";
    }

    if (severity === "Medium") {
      return "4 days";
    }

    return "7 days";
  };

  const detectDuplicate = () => {
    const match = complaints.find((complaint) => {
      return (
        complaint.category === category &&
        complaint.status !== "Resolved"
      );
    });

    if (!match) {
      return null;
    }

    return {
      id: match.id,
      reports: match.reports,
      location: match.location,
    };
  };

  const runAnalysis = async () => {
    if (!category || !description || !location) {
      setMessage(
        "Please add the issue type, description and location first."
      );

      return null;
    }

    setAnalysisRunning(true);
    setMessage("");

    setAnalysisStage("Understanding the issue...");
    await wait(650);

    const severity = detectSeverity();

    setAnalysisStage("Calculating priority...");
    await wait(650);

    const priority = calculatePriority(severity);

    setAnalysisStage("Checking nearby complaints...");
    await wait(650);

    const duplicate = detectDuplicate();

    setAnalysisStage("Finding the responsible department...");
    await wait(650);

    const result = {
      severity,
      priority,
      department: getDepartment(),
      sla: getSla(severity),
      duplicate,
    };

    setAnalysis(result);
    setAnalysisRunning(false);
    setAnalysisStage("");

    return result;
  };

  const submitComplaint = async (event) => {
    event.preventDefault();

    let result = analysis;

    if (!result) {
      result = await runAnalysis();
    }

    if (!result) {
      return;
    }

    if (result.duplicate) {
      setMessage(
        `Possible duplicate detected: ${result.duplicate.id}. You can still submit this report as another citizen confirmation.`
      );
    }

    const newComplaint = {
      id: `CC-${1000 + complaints.length + 2}`,
      category,
      description,
      location,
      coordinates,
      severity: result.severity,
      priority: result.priority,
      department: result.department,
      status: "Submitted",
      sla: result.sla,
      reports: 1,
      date: "Just now",
      duplicate: Boolean(result.duplicate),
      beforeImage: image,
      afterImage: null,
    };

    saveComplaints([
      newComplaint,
      ...complaints,
    ]);

    setCategory("");
    setDescription("");
    setLocation("");
    setCoordinates(null);
    setImage(null);
    setImageName("");
    setAnalysis(null);

    setActivePage("complaints");
  };

  const confirmSameIssue = (complaintId) => {
    const updated = complaints.map(
      (complaint) =>
        complaint.id === complaintId
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

    const refreshed = updated.find(
      (complaint) =>
        complaint.id === complaintId
    );

    setSelectedComplaint(refreshed);
  };

  const handleAfterImage = (event) => {
    const file = event.target.files?.[0];

    if (!file || !selectedComplaint) {
      return;
    }

    const afterImage = URL.createObjectURL(file);

    const updated = complaints.map(
      (complaint) =>
        complaint.id === selectedComplaint.id
          ? {
              ...complaint,
              afterImage,
            }
          : complaint
    );

    saveComplaints(updated);

    setSelectedComplaint({
      ...selectedComplaint,
      afterImage,
    });
  };

  const totalReports = complaints.length;

  const activeReports = complaints.filter(
    (complaint) =>
      complaint.status !== "Resolved"
  ).length;

  const resolvedReports = complaints.filter(
    (complaint) =>
      complaint.status === "Resolved"
  ).length;

  const highPriorityReports = complaints.filter(
    (complaint) =>
      complaint.priority >= 80
  ).length;

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand"
          onClick={() =>
            setActivePage("report")
          }
        >
          <div className="brand-mark">
            AI
          </div>

          <div>
            <div className="brand-name">
              AI CivicCare
            </div>

            <div className="brand-tagline">
              Smarter civic issue management
            </div>
          </div>
        </button>

        <nav className="navigation">
          <button
            className={
              activePage === "report"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() =>
              setActivePage("report")
            }
          >
            Report Issue
          </button>

          <button
            className={
              activePage === "complaints"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() =>
              setActivePage("complaints")
            }
          >
            My Complaints

            <span className="nav-count">
              {complaints.length}
            </span>
          </button>
        </nav>

        <div className="system-status">
          <span className="live-dot"></span>
          AI Ready
        </div>
      </header>

      <main className="main-content">
        {activePage === "report" ? (
          <section className="report-page">
            <div className="hero">
              <div>
                <div className="eyebrow">
                  SMARTER CIVIC REPORTING
                </div>

                <h1>
                  Report the problem.
                  <br />
                  <span>
                    We'll prioritize the rest.
                  </span>
                </h1>

                <p>
                  Add a photo, describe what happened
                  and share the location. AI CivicCare
                  evaluates severity, priority,
                  duplicates and the responsible
                  department.
                </p>
              </div>

              <div className="hero-ai-card">
                <span className="hero-ai-icon">
                  ✦
                </span>

                <div>
                  <strong>
                    AI-assisted workflow
                  </strong>

                  <small>
                    Assess → Prioritize → Route → Track
                  </small>
                </div>
              </div>
            </div>

            <div className="stats-row">
              <Stat
                title="Total Reports"
                value={totalReports}
              />

              <Stat
                title="High Priority"
                value={highPriorityReports}
              />

              <Stat
                title="Active Issues"
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
                  <h2>
                    Report a civic issue
                  </h2>

                  <p>
                    Three simple steps.
                  </p>
                </div>

                <span className="secure-label">
                  ✓ Secure report
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
                  AI Review
                </div>
              </div>

              <div className="form-grid">
                <div className="form-section">
                  <label>
                    Add a photo
                  </label>

                  <div
                    className={
                      image
                        ? "upload-box has-image"
                        : "upload-box"
                    }
                    onClick={() =>
                      !image &&
                      fileInputRef.current?.click()
                    }
                  >
                    {image ? (
                      <>
                        <img
                          className="preview-image"
                          src={image}
                          alt="Complaint evidence"
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

                        <small>
                          {imageName}
                        </small>
                      </>
                    ) : (
                      <>
                        <span className="upload-symbol">
                          ↑
                        </span>

                        <strong>
                          Add photo evidence
                        </strong>

                        <p>
                          Take a photo or choose one
                          from your device
                        </p>

                        <small>
                          JPG, PNG or HEIC
                        </small>
                      </>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={handleImageChange}
                  />
                </div>

                <div className="form-section">
                  <label htmlFor="category">
                    What is the problem?
                  </label>

                  <select
                    id="category"
                    value={category}
                    onChange={(event) => {
                      setCategory(
                        event.target.value
                      );
                      setAnalysis(null);
                    }}
                  >
                    <option value="">
                      Choose an issue
                    </option>

                    {categoryOptions.map(
                      (item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      )
                    )}
                  </select>

                  <label htmlFor="description">
                    Tell us what you noticed
                  </label>

                  <textarea
                    id="description"
                    rows="5"
                    value={description}
                    placeholder="Example: Large pothole outside the school causing traffic problems."
                    onChange={(event) => {
                      setDescription(
                        event.target.value
                      );
                      setAnalysis(null);
                    }}
                  />

                  <label>
                    Where is the problem?
                  </label>

                  <div className="location-area">
                    <input
                      value={location}
                      placeholder="Enter location manually"
                      onChange={(event) => {
                        setLocation(
                          event.target.value
                        );
                        setAnalysis(null);
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
                      {coordinates.latitude.toFixed(
                        5
                      )}
                      ,{" "}
                      {coordinates.longitude.toFixed(
                        5
                      )}
                    </small>
                  )}
                </div>
              </div>

              {message && (
                <div className="message">
                  {message}
                </div>
              )}

              {!analysis &&
                !analysisRunning && (
                  <div className="analyse-row">
                    <div>
                      <strong>
                        Ready for AI review?
                      </strong>

                      <p>
                        We'll check severity,
                        priority, duplicates and
                        routing.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="analyse-button"
                      onClick={runAnalysis}
                    >
                      ✦ Analyse with AI
                    </button>
                  </div>
                )}

              {analysisRunning && (
                <div className="ai-processing">
                  <span className="processing-dot"></span>

                  <div>
                    <strong>
                      AI CivicCare is analysing
                    </strong>

                    <p>
                      {analysisStage}
                    </p>
                  </div>
                </div>
              )}

              {analysis && (
                <AIAnalysis
                  analysis={analysis}
                />
              )}

              <div className="form-footer">
                <span>
                  You can review everything before
                  submission.
                </span>

                <button
                  type="submit"
                  className="submit-button"
                  disabled={analysisRunning}
                >
                  Submit Complaint →
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="complaints-page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  CITIZEN DASHBOARD
                </div>

                <h1>
                  My complaints
                </h1>

                <p>
                  Track every report from submission
                  to verified resolution.
                </p>
              </div>

              <button
                className="submit-button"
                onClick={() =>
                  setActivePage("report")
                }
              >
                + New Report
              </button>
            </div>

            <div className="complaints-list">
              {complaints.map(
                (complaint) => (
                  <ComplaintCard
                    key={complaint.id}
                    complaint={complaint}
                    onOpen={() =>
                      setSelectedComplaint(
                        complaint
                      )
                    }
                  />
                )
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
            confirmSameIssue(
              selectedComplaint.id
            )
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
            ✦ AI CIVICCARE ANALYSIS
          </span>

          <h3>
            Assessment complete
          </h3>
        </div>

        <div className="priority-score">
          <strong>
            {analysis.priority}
          </strong>

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
          title="Assigned department"
          value={analysis.department}
        />

        <AnalysisItem
          title="Resolution target"
          value={analysis.sla}
        />
      </div>

      {analysis.duplicate ? (
        <div className="duplicate-warning">
          <strong>
            ◎ Possible duplicate found
          </strong>

          <p>
            Complaint{" "}
            {analysis.duplicate.id} may describe
            the same issue. It already has{" "}
            {analysis.duplicate.reports} citizen
            report(s).
          </p>
        </div>
      ) : (
        <div className="analysis-success">
          ✓ No active duplicate complaint found.
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
      className="complaint-card"
      onClick={onOpen}
    >
      <div className="complaint-card-top">
        <div>
          <span className="complaint-id">
            {complaint.id}
          </span>

          <h3>
            {complaint.category}
          </h3>

          <p>
            {complaint.description}
          </p>
        </div>

        <div className="complaint-score">
          <span>Priority</span>
          <strong>
            {complaint.priority}
          </strong>
        </div>
      </div>

      <div className="complaint-tags">
        <span
          className={`severity-tag ${complaint.severity.toLowerCase()}`}
        >
          {complaint.severity}
        </span>

        <span>
          {complaint.department}
        </span>

        <span>
          SLA {complaint.sla}
        </span>
      </div>

      <ComplaintTimeline
        status={complaint.status}
      />

      <div className="complaint-card-footer">
        <span>
          ⌖ {complaint.location}
        </span>

        <span>
          {complaint.reports} citizen report(s)
        </span>

        <strong>
          View details →
        </strong>
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
    Assigned: 3,
    "In Progress": 4,
    Resolved: 5,
    Verified: 6,
  };

  const current =
    progress[status] || 1;

  return (
    <div className="timeline">
      {steps.map((step, index) => (
        <div
          key={step}
          className={
            index < current
              ? "timeline-step done"
              : "timeline-step"
          }
        >
          <span></span>
          <small>
            {step}
          </small>
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
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="modal-header">
          <div>
            <span className="analysis-kicker">
              {complaint.id}
            </span>

            <h2>
              {complaint.category}
            </h2>

            <p>
              {complaint.description}
            </p>
          </div>

          <button
            className="close-button"
            onClick={onClose}
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
            title="Department"
            value={complaint.department}
          />

          <AnalysisItem
            title="Resolution target"
            value={complaint.sla}
          />
        </div>

        <div className="modal-section">
          <h3>
            Complaint lifecycle
          </h3>

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
            onClick={onSameIssue}
          >
            + Same issue
          </button>
        </div>

        {complaint.status ===
          "Resolved" && (
          <div className="verification-card">
            <span className="analysis-kicker">
              RESOLUTION VERIFICATION
            </span>

            <h3>
              Verify the repair
            </h3>

            <p>
              Compare the original evidence with
              an after-image before closing the
              complaint.
            </p>

            <div className="verification-images">
              <div>
                <span>
                  Before
                </span>

                {complaint.beforeImage ? (
                  <img
                    src={
                      complaint.beforeImage
                    }
                    alt="Before"
                  />
                ) : (
                  <div className="image-placeholder">
                    Original report
                  </div>
                )}
              </div>

              <div>
                <span>
                  After
                </span>

                {complaint.afterImage ? (
                  <img
                    src={
                      complaint.afterImage
                    }
                    alt="After"
                  />
                ) : (
                  <button
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
            />

            {complaint.afterImage && (
              <div className="analysis-success">
                ✓ Before/after evidence available
                for verification.
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <span>
            {complaint.location}
          </span>

          <button
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

const wait = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

export default App;