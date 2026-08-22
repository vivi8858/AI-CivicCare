import { useRef, useState } from "react";
import "./App.css";

const defaultComplaints = [
  {
    id: "CC-1001",
    category: "Pothole",
    description: "Large pothole near the main road.",
    status: "In Progress",
    location: "Sector 12, New Delhi",
    date: "Today",
    severity: "High",
    reports: 4,
  },
  {
    id: "CC-1000",
    category: "Garbage",
    description: "Overflowing garbage bin near the park.",
    status: "Resolved",
    location: "Sector 8, New Delhi",
    date: "Yesterday",
    severity: "Medium",
    reports: 7,
  },
];

function App() {
  const fileInputRef = useRef(null);

  const [activePage, setActivePage] = useState("report");

  const [image, setImage] = useState(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const [locationLoading, setLocationLoading] = useState(false);

  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiStage, setAiStage] = useState("");
  const [message, setMessage] = useState("");

  const [severity, setSeverity] = useState(null);
  const [priority, setPriority] = useState(null);

  const [selectedComplaint, setSelectedComplaint] = useState(null);

  const [complaints, setComplaints] = useState(() => {
    const saved = localStorage.getItem("civiccare_complaints");

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return defaultComplaints;
      }
    }

    return defaultComplaints;
  });

  const saveComplaints = (updatedComplaints) => {
    setComplaints(updatedComplaints);

    localStorage.setItem(
      "civiccare_complaints",
      JSON.stringify(updatedComplaints)
    );
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    setImage(imageUrl);
    setMessage("");
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Location is not supported by this browser.");
      return;
    }

    setLocationLoading(true);
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        setLocation(
          `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        );

        setLocationLoading(false);
      },
      () => {
        setMessage(
          "Location permission was not available. You can enter it manually."
        );

        setLocationLoading(false);
      }
    );
  };

  /*
   * ---------------------------------------------------------
   * AI CIVICCARE — SEVERITY DETECTION
   *
   * This is currently a prototype rule-based engine.
   * Later we will replace this with a real AI backend.
   * ---------------------------------------------------------
   */

  const detectSeverity = () => {
    const text = `${category} ${description}`.toLowerCase();

    let detectedSeverity = "Medium";

    const highSeverityKeywords = [
      "dangerous",
      "danger",
      "accident",
      "injury",
      "injured",
      "school",
      "hospital",
      "fire",
      "flood",
      "flooding",
      "electric",
      "electricity",
      "wire",
      "exposed",
      "collapse",
      "collapsed",
      "blocked",
      "major",
      "huge",
      "severe",
    ];
    const calculatePriority = (detectedSeverity) => {
      let score = 50;
    
      const text = `${category} ${description}`.toLowerCase();
    
      // Severity contributes to the base score
      if (detectedSeverity === "Critical") {
        score += 40;
      } else if (detectedSeverity === "High") {
        score += 30;
      } else if (detectedSeverity === "Medium") {
        score += 15;
      } else {
        score += 5;
      }
    
      // Public safety / high-impact situations
      const highImpactKeywords = [
        "school",
        "hospital",
        "accident",
        "injury",
        "dangerous",
        "fire",
        "flood",
        "electric",
        "wire",
        "blocked",
      ];
    
      if (
        highImpactKeywords.some((keyword) =>
          text.includes(keyword)
        )
      ) {
        score += 10;
      }
    
      // More citizens affected / urgent wording
      const urgencyKeywords = [
        "huge",
        "major",
        "severe",
        "many people",
        "busy road",
        "traffic",
        "emergency",
      ];
    
      if (
        urgencyKeywords.some((keyword) =>
          text.includes(keyword)
        )
      ) {
        score += 5;
      }
    
      // Keep the score between 0 and 100
      score = Math.min(100, Math.max(0, score));
    
      setPriority(score);
    
      return score;
    };

    const lowSeverityKeywords = [
      "small",
      "minor",
      "slightly",
      "tiny",
      "small issue",
    ];

    const isHighSeverity = highSeverityKeywords.some(
      (keyword) => text.includes(keyword)
    );

    const isLowSeverity = lowSeverityKeywords.some(
      (keyword) => text.includes(keyword)
    );

    if (isHighSeverity) {
      detectedSeverity = "High";
    } else if (isLowSeverity) {
      detectedSeverity = "Low";
    }

    setSeverity(detectedSeverity);

    return detectedSeverity;
  };

  const submitComplaint = async (event) => {
    event.preventDefault();

    if (!category || !description || !location) {
      setMessage(
        "Please complete the category, description and location."
      );

      return;
    }

    setAiProcessing(true);
    setMessage("");

    /*
     * STEP 1
     * Analyze the complaint.
     */

    setAiStage("severity");
    setMessage("AI is analyzing the severity...");

    await new Promise((resolve) => {
      setTimeout(resolve, 900);
    });

    const detectedSeverity = detectSeverity();
    const calculatedPriority = calculatePriority(
      detectedSeverity
    );

    /*
     * STEP 2
     * Continue the prototype AI workflow.
     */

    setAiStage("duplicate");
    setMessage("Checking for nearby reports...");

    await new Promise((resolve) => {
      setTimeout(resolve, 900);
    });

    /*
     * STEP 3
     * Smart routing placeholder.
     */

    setAiStage("routing");
    setMessage("Finding the right department...");

    await new Promise((resolve) => {
      setTimeout(resolve, 900);
    });

    /*
     * STEP 4
     * Create the complaint.
     */

    const newComplaint = {
      id: `CC-${1002 + complaints.length}`,
      category,
      description,
      status: "Submitted",
      location,
      date: "Just now",
      severity: detectedSeverity,
      priority: calculatedPriority,
      reports: 1,
    };

    const updatedComplaints = [
      newComplaint,
      ...complaints,
    ];

    saveComplaints(updatedComplaints);

    /*
     * Keep the severity visible briefly so
     * the citizen can see the AI result.
     */

    setAiStage("complete");
    setMessage(
      `AI analysis complete. Severity: ${detectedSeverity}.`
    );

    await new Promise((resolve) => {
      setTimeout(resolve, 1200);
    });

    /*
     * Reset form.
     */

    setCategory("");
    setDescription("");
    setLocation("");
    setImage(null);
    setSeverity(null);
    setPriority(null);

    setAiProcessing(false);
    setAiStage("");

    setActivePage("complaints");
  };

  const upvoteComplaint = (complaintId) => {
    const updatedComplaints = complaints.map((complaint) =>
      complaint.id === complaintId
        ? {
            ...complaint,
            reports: complaint.reports + 1,
          }
        : complaint
    );

    saveComplaints(updatedComplaints);

    const updatedComplaint = updatedComplaints.find(
      (complaint) => complaint.id === complaintId
    );

    setSelectedComplaint(updatedComplaint);
  };

  const totalReports = complaints.length;

  const resolvedReports = complaints.filter(
    (complaint) => complaint.status === "Resolved"
  ).length;

  const activeReports = complaints.filter(
    (complaint) => complaint.status !== "Resolved"
  ).length;

  const highPriorityReports = complaints.filter(
    (complaint) => complaint.severity === "High"
  ).length;

  return (
    <div className="app">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <header className="topbar">

        <div className="brand">
          <div className="brand-mark">
            C
          </div>

          <div>
            <div className="brand-name">
              CivicCare
            </div>

            <div className="brand-tagline">
              AI-powered civic reporting
            </div>
          </div>
        </div>

        <nav className="navigation">

          <button
            className={
              activePage === "report"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => {
              setActivePage("report");
              setMessage("");
            }}
          >
            Report Issue
          </button>

          <button
            className={
              activePage === "complaints"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => {
              setActivePage("complaints");
              setMessage("");
            }}
          >
            My Complaints

            <span className="nav-count">
              {complaints.length}
            </span>
          </button>

        </nav>

        <div className="system-status">
          <span className="live-dot"></span>
          AI Online
        </div>

        <div className="profile">

          <div className="profile-avatar">
            C
          </div>

          <div>
            <div className="profile-name">
              Citizen
            </div>

            <div className="profile-city">
              New Delhi
            </div>
          </div>

        </div>

      </header>

      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}

      <main className="main-content">

        {activePage === "report" ? (

          <section className="report-page">

            {/* HERO */}

            <div className="hero">

              <div>

                <div className="eyebrow">
                  MAKE YOUR CITY BETTER
                </div>

                <h1>
                  Report a civic issue.
                  <br />

                  <span>
                    We'll take it from here.
                  </span>
                </h1>

                <p>
                  Report potholes, garbage, water leaks,
                  damaged roads and other civic problems.
                  CivicCare uses AI to validate and prioritize
                  your complaint.
                </p>

              </div>

              <div className="hero-badge">

                <div className="ai-pulse">
                  ✦
                </div>

                <div>
                  <strong>
                    AI Assisted
                  </strong>

                  <span>
                    Severity & smart routing
                  </span>
                </div>

              </div>

            </div>

            {/* =================================================
                DASHBOARD STATS
                ================================================= */}

            <div className="stats-row">

              <div className="stat-card">
                <span>
                  Total Reports
                </span>

                <strong>
                  {totalReports}
                </strong>
              </div>

              <div className="stat-card">
                <span>
                  High Priority
                </span>

                <strong>
                  {highPriorityReports}
                </strong>
              </div>

              <div className="stat-card">
                <span>
                  Active Issues
                </span>

                <strong>
                  {activeReports}
                </strong>
              </div>

              <div className="stat-card">
                <span>
                  Resolved
                </span>

                <strong>
                  {resolvedReports}
                </strong>
              </div>

            </div>

            {/* =================================================
                REPORT FORM
                ================================================= */}

            <form
              className="report-card"
              onSubmit={submitComplaint}
            >

              <div className="card-header">

                <div>

                  <h2>
                    New civic report
                  </h2>

                  <p>
                    Tell us what needs attention.
                  </p>

                </div>

                <div className="step-label">
                  STEP 1 OF 1
                </div>

              </div>

              <div className="form-grid">

                {/* PHOTO */}

                <div className="form-section image-section">

                  <label>
                    Photo evidence
                  </label>

                  <div
                    className={
                      image
                        ? "upload-box has-image"
                        : "upload-box"
                    }
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >

                    {image ? (

                      <div className="image-wrapper">

                        <img
                          src={image}
                          alt="Selected civic issue"
                          className="preview-image"
                        />

                        <div className="image-overlay">
                          Change photo
                        </div>

                      </div>

                    ) : (

                      <>
                        <div className="upload-icon">
                          ↑
                        </div>

                        <strong>
                          Upload a photo
                        </strong>

                        <span>
                          JPG, PNG or HEIC · Max 10 MB
                        </span>
                      </>

                    )}

                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    hidden
                  />

                </div>

                {/* DETAILS */}

                <div className="form-section">

                  <label htmlFor="category">
                    What is the problem?
                  </label>

                  <select
                    id="category"
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      setSeverity(null);
                      setMessage("");
                    }}
                  >

                    <option value="">
                      Select a problem
                    </option>

                    <option value="Pothole">
                      🛣️ Road / Pothole
                    </option>

                    <option value="Garbage">
                      🗑️ Garbage
                    </option>

                    <option value="Water Leak">
                      💧 Water Leak
                    </option>

                    <option value="Street Light">
                      💡 Street Light
                    </option>

                    <option value="Drainage">
                      🌧️ Drainage / Flooding
                    </option>

                    <option value="Other">
                      📍 Other Civic Issue
                    </option>

                  </select>

                  <label htmlFor="description">
                    What is happening?
                  </label>

                  <textarea
                    id="description"
                    placeholder="Tell us what you noticed..."
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setSeverity(null);
                      setMessage("");
                    }}
                    rows="5"
                  />

                  <label>
                    Location
                  </label>

                  <div className="location-row">

                    <input
                      type="text"
                      placeholder="Enter location or use GPS"
                      value={location}
                      onChange={(event) =>
                        setLocation(event.target.value)
                      }
                    />

                    <button
                      type="button"
                      className="location-button"
                      onClick={getLocation}
                    >
                      {locationLoading
                        ? "Locating..."
                        : "⌖ GPS"}
                    </button>

                  </div>

                </div>

              </div>

              {/* =================================================
                  AI SEVERITY RESULT
                  ================================================= */}
                  {severity && priority !== null && (
  <div className="ai-assessment-card">

    <div className="assessment-header">

      <div>
        <span className="assessment-label">
          AI CivicCare Assessment
        </span>

        <p>
          Your report has been assessed for urgency.
        </p>
      </div>

      <div className="priority-score">
        <strong>
          {priority}
        </strong>

        <span>
          /100
        </span>
      </div>

    </div>

    <div className="assessment-results">

      <div className="assessment-result">

        <span>
          Severity
        </span>

        <strong
          className={`severity-value severity-${severity.toLowerCase()}`}
        >
          {severity}
        </strong>

      </div>

      <div className="assessment-result">

        <span>
          Priority
        </span>

        <strong>
          {priority >= 80
            ? "High"
            : priority >= 60
            ? "Medium"
            : "Low"}
        </strong>

      </div>

    </div>

  </div>
)}

              {/* =================================================
                  FORM FOOTER
                  ================================================= */}

              <div className="form-footer">

                <div className="privacy-note">

                  <span>
                    ✓
                  </span>

                  Your report is securely stored.

                </div>

                <button
                  type="submit"
                  className="submit-button"
                  disabled={aiProcessing}
                >

                  {aiProcessing
                    ? "Analyzing..."
                    : "Submit Report"}

                  <span>
                    →
                  </span>

                </button>

              </div>

            </form>

            {/* =================================================
                FEATURES
                ================================================= */}

            <div className="feature-row">

              <div className="feature-card">

                <span className="feature-icon">
                  AI
                </span>

                <div>

                  <strong>
                    AI severity
                  </strong>

                  <p>
                    Understands issue seriousness
                  </p>

                </div>

              </div>

              <div className="feature-card">

                <span className="feature-icon">
                  ◎
                </span>

                <div>

                  <strong>
                    Duplicate detection
                  </strong>

                  <p>
                    Groups nearby reports
                  </p>

                </div>

              </div>

              <div className="feature-card">

                <span className="feature-icon">
                  ↗
                </span>

                <div>

                  <strong>
                    Smart routing
                  </strong>

                  <p>
                    Sends issues to the right team
                  </p>

                </div>

              </div>

            </div>

          </section>

        ) : (

          /* ===================================================
             MY COMPLAINTS
             =================================================== */

          <section className="complaints-page">

            <div className="page-heading">

              <div>

                <div className="eyebrow">
                  CITIZEN PORTAL
                </div>

                <h1>
                  My complaints
                </h1>

                <p>
                  Track the issues you've reported.
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

              {complaints.map((complaint) => (

                <div
                  className="complaint-card clickable"
                  key={complaint.id}
                  onClick={() =>
                    setSelectedComplaint(complaint)
                  }
                >

                  <div className="complaint-main">

                    <div className="complaint-icon">

                      {complaint.category === "Pothole"
                        ? "⌁"
                        : complaint.category === "Garbage"
                        ? "▥"
                        : "○"}

                    </div>

                    <div>

                      <div className="complaint-title-row">

                        <h3>
                          {complaint.category}
                        </h3>

                        <span
                          className={`status ${complaint.status
                            .toLowerCase()
                            .replaceAll(" ", "-")}`}
                        >
                          {complaint.status}
                        </span>

                      </div>

                      <p>
                        {complaint.description}
                      </p>

                      <div className="complaint-meta">

                        <span>
                          {complaint.id}
                        </span>

                        <span>
                          •
                        </span>

                        <span>
                          {complaint.location}
                        </span>

                        <span>
                          •
                        </span>

                        <span>
                          {complaint.date}
                        </span>

                      </div>

                      {/* TIMELINE */}

                      <div className="timeline">

                        <div className="timeline-step done">
                          <span></span>
                          Submitted
                        </div>

                        <div
                          className={
                            complaint.status !== "Submitted"
                              ? "timeline-step done"
                              : "timeline-step"
                          }
                        >
                          <span></span>
                          Assigned
                        </div>

                        <div
                          className={
                            complaint.status === "In Progress" ||
                            complaint.status === "Resolved"
                              ? "timeline-step done"
                              : "timeline-step"
                          }
                        >
                          <span></span>
                          In Progress
                        </div>

                        <div
                          className={
                            complaint.status === "Resolved"
                              ? "timeline-step done"
                              : "timeline-step"
                          }
                        >
                          <span></span>
                          Resolved
                        </div>

                      </div>

                    </div>

                  </div>

                  <div className="severity">

                    <span>
                      Severity
                    </span>

                    <strong>
                      {complaint.severity}
                    </strong>

                    <small>
                      {complaint.reports} report
                      {complaint.reports !== 1
                        ? "s"
                        : ""}
                    </small>

                  </div>

                </div>

              ))}

            </div>

          </section>

        )}

      </main>

      {/* =====================================================
          COMPLAINT DETAILS MODAL
          ===================================================== */}

      {selectedComplaint && (

        <div
          className="modal-backdrop"
          onClick={() =>
            setSelectedComplaint(null)
          }
        >

          <div
            className="complaint-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <div className="eyebrow">
                  CIVICCARE CASE
                </div>

                <h2>
                  {selectedComplaint.category}
                </h2>

                <span className="modal-id">
                  {selectedComplaint.id}
                </span>

              </div>

              <button
                className="close-button"
                onClick={() =>
                  setSelectedComplaint(null)
                }
              >
                ×
              </button>

            </div>

            <div className="modal-status">

              <div className="modal-status-title">

                <span
                  className={`status ${selectedComplaint.status
                    .toLowerCase()
                    .replaceAll(" ", "-")}`}
                >
                  {selectedComplaint.status}
                </span>

                <span>
                  Last updated just now
                </span>

              </div>

              <div className="modal-timeline">

                <div className="modal-timeline-line"></div>

                <div className="modal-timeline-item active">

                  <span></span>

                  <div>

                    <strong>
                      Report submitted
                    </strong>

                    <small>
                      Complaint received by CivicCare
                    </small>

                  </div>

                </div>

                <div className="modal-timeline-item active">

                  <span></span>

                  <div>

                    <strong>
                      AI analyzed
                    </strong>

                    <small>
                      Issue severity assessed
                    </small>

                  </div>

                </div>

                <div
                  className={
                    selectedComplaint.status !== "Submitted"
                      ? "modal-timeline-item active"
                      : "modal-timeline-item"
                  }
                >

                  <span></span>

                  <div>

                    <strong>
                      Department assigned
                    </strong>

                    <small>
                      Routed to the appropriate civic team
                    </small>

                  </div>

                </div>

                <div
                  className={
                    selectedComplaint.status === "In Progress" ||
                    selectedComplaint.status === "Resolved"
                      ? "modal-timeline-item active"
                      : "modal-timeline-item"
                  }
                >

                  <span></span>

                  <div>

                    <strong>
                      Work in progress
                    </strong>

                    <small>
                      Repair team working on the issue
                    </small>

                  </div>

                </div>

                <div
                  className={
                    selectedComplaint.status === "Resolved"
                      ? "modal-timeline-item active"
                      : "modal-timeline-item"
                  }
                >

                  <span></span>

                  <div>

                    <strong>
                      Resolved
                    </strong>

                    <small>
                      Issue marked as resolved
                    </small>

                  </div>

                </div>

              </div>

            </div>

            {/* AI ANALYSIS */}

            <div className="analysis-grid">

              <div className="analysis-card">

                <span>
                  AI SEVERITY
                </span>

                <strong>
                  {selectedComplaint.severity}
                </strong>

                <p>
                  Based on the reported issue and description.
                </p>

              </div>

              <div className="analysis-card">

                <span>
                  ROUTED DEPARTMENT
                </span>

                <strong>
                  {selectedComplaint.category === "Pothole"
                    ? "Roads & Infrastructure"
                    : selectedComplaint.category === "Garbage"
                    ? "Waste Management"
                    : selectedComplaint.category === "Water Leak"
                    ? "Water & Utilities"
                    : selectedComplaint.category === "Street Light"
                    ? "Electrical Department"
                    : "Civic Services"}
                </strong>

                <p>
                  Automatically selected by CivicCare.
                </p>

              </div>

            </div>

            {/* LOCATION */}

            <div className="location-card">

              <div className="location-symbol">
                ⌖
              </div>

              <div>

                <span>
                  REPORTED LOCATION
                </span>

                <strong>
                  {selectedComplaint.location}
                </strong>

              </div>

            </div>

            {/* DUPLICATE */}

            <div className="duplicate-card">

              <div>

                <strong>
                  Is this the same issue you're seeing?
                </strong>

                <p>
                  {selectedComplaint.reports} citizens have
                  reported this issue.
                </p>

              </div>

              <button
                className="upvote-button"
                onClick={() =>
                  upvoteComplaint(
                    selectedComplaint.id
                  )
                }
              >
                + Same Issue
              </button>

            </div>

            {/* MODAL FOOTER */}

            <div className="modal-footer">

              <span>
                CivicCare keeps you updated as the issue
                moves through the resolution process.
              </span>

              <button
                className="modal-close"
                onClick={() =>
                  setSelectedComplaint(null)
                }
              >
                Done
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default App;