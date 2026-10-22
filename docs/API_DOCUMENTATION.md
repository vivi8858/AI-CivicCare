# AI CivicCare API Documentation

## Express API

GET http://localhost:5001/api/health
Checks whether the backend is running.

POST http://localhost:5001/api/predict
Sends complaint text for classification.

## Python FastAPI

GET http://localhost:8000/health
Checks whether the Python service is running.

POST http://localhost:8000/predict
Runs rule-based complaint classification.

## Example JSON Request

{
  "description": "Garbage near my house"
}

## Supabase APIs

Supabase Auth API: Registration and login.

Supabase Database API: Complaint and profile data.

Supabase Storage API: Complaint evidence.

Supabase RPC API: Database functions for complaint workflows.
