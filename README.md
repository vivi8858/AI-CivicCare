# AI CivicCare
**AI-Assisted Crowdsourced Civic Issue Reporting and Management System**

## 1. Project Overview
AI CivicCare is a web application where citizens can report civic problems such as garbage, potholes, water leakage and broken streetlights. The system helps categorize complaints, assign departments and track complaint status.

## 2. Technologies Used

| Technology | Purpose |
|---|---|
| React.js | Frontend website |
| CSS | Website design and responsiveness |
| Vite | Runs the frontend locally |
| Node.js | Backend JavaScript runtime |
| Express.js | Creates REST APIs |
| Python + FastAPI | Complaint category prediction |
| Supabase | Authentication, PostgreSQL database and file storage |
| Cursor | Code development |

## 3. Project Architecture

```text
Citizen / Authority
        |
        v
React Frontend (Port 5173)
        |
        +------> Supabase
        |        - Authentication
        |        - Complaint Database
        |        - Evidence Storage
        |
        v
Express Backend (Port 5001)
        |
        v
Python FastAPI (Port 8000)
        |
        v
Rule-Based Category Prediction
```

## 4. Frontend

**Folder:** `frontend/src/`

- `App.jsx` — Main website, navigation, complaint forms and dashboards.
- `App.css` — Website styling.
- `Login.jsx` — Login and registration.
- `complaintApi.js` — Supabase complaint operations.
- `aiApi.js` — Connects React with the prediction API.
- `civicLogic.js` — Complaint categorization, priority and department-routing logic.
- `HotspotMap.jsx` — Displays civic complaint locations.

## 5. Backend

**Folder:** `backend/src/`

- `server.js` — Express server running on port 5001.
- `aiRoutes.js` — Handles AI prediction requests.

The backend receives requests from React, communicates with Python FastAPI and returns responses in JSON format.

## 6. AI Service

**Folder:** `ai-service/`

- Developed using Python and FastAPI.
- Receives complaint descriptions.
- Uses keyword-based rules to suggest categories.
- Returns the predicted category through an API.

**Current implementation:** Rule-based text classification, not OCR or a trained machine-learning model.

## 7. APIs Used

| API | Purpose |
|---|---|
| `GET /api/health` | Checks Express backend |
| `POST /api/predict` | Requests complaint classification |
| `GET /health` (Python) | Checks FastAPI service |
| `POST /predict` (Python) | Runs category prediction |
| Supabase Auth API | Login and registration |
| Supabase Database API | Store and retrieve complaints |
| Supabase Storage API | Store complaint evidence |
| Supabase RPC API | Execute complaint workflow functions |

## 8. How the System Works

1. Citizen logs in using Supabase Auth.
2. Citizen enters complaint details and location.
3. The **Suggest Category** button sends the description to Express.
4. Express forwards it to Python FastAPI.
5. Python suggests the complaint category.
6. The category is mapped to the relevant department.
7. The complaint is stored in Supabase.
8. Citizens can view complaints and track their status.
9. Authorities can process complaints through the Authority workflow.

## 9. Citizen and Authority Portals

**Citizen Portal**
- Report civic issues.
- Upload supporting evidence.
- View complaints and status.
- Confirm existing community issues.
- View the hotspot map.

**Authority Portal**
- View department-related complaints.
- Open complaint details.
- Update permitted complaint statuses.
- Add processing notes and evidence.

Department-based frontend filtering exists. Full database-level department isolation still requires verification.

## 10. What Is Localhost?

Localhost refers to the computer running the application.

| Address | Service |
|---|---|
| `localhost:5173` | React frontend (default) |
| `localhost:5001` | Express backend |
| `localhost:8000` | Python FastAPI |

The numbers are **port numbers**, used to identify different services. Vite may use another port if 5173 is occupied.

## 11. Testing

- Frontend: `npm run dev` from the `frontend` folder.
- Frontend build: `npm run build`.
- Express API: `curl http://localhost:5001/api/health`.
- Python API: `curl http://localhost:8000/health`.
- AI prediction: Enter a complaint and click **Suggest Category**.
- Database: Verify submitted complaints in Supabase.
- Authentication: Test citizen and Authority login.

## 12. Future Scope

- Trained AI/NLP classification model.
- Complete secure department-wise Authority access.
- Separate Admin Portal.
- Advanced analytics and reports.
- Automated notifications and alerts.

## 13. Conclusion

AI CivicCare integrates React, Node.js, Express, Python FastAPI and Supabase to provide an AI-assisted civic complaint reporting and management platform. It combines citizen participation, complaint tracking, automated category suggestions and department-oriented processing.