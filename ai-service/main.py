from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="AI CivicCare AI Service",
    version="1.0.0"
)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "AI CivicCare Python AI Service"
    }

class ComplaintRequest(BaseModel):
    description: str

@app.post("/predict")
def predict_complaint(complaint: ComplaintRequest):
    text = complaint.description.lower()

    if "garbage" in text or "waste" in text:
        category = "Garbage"
    elif "pothole" in text or "road" in text:
        category = "Road"
    elif "water" in text or "leakage" in text:
        category = "Water"
    elif "streetlight" in text or "light" in text:
        category = "Streetlight"
    else:
        category = "Other"

    return {
        "category": category,
        "method": "rule-based-demo",
        "message": "Prediction service is working"
    }
