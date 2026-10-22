# AI CivicCare Testing Guide

## Frontend Test

cd ~/AI-CivicCare/frontend
npm run dev

Open the Local URL displayed by Vite.

## Express Backend Test

curl http://localhost:5001/api/health

## Python Service Test

curl http://localhost:8000/health

## Prediction Test

curl -X POST http://localhost:5001/api/predict \
-H "Content-Type: application/json" \
-d '{"description":"Garbage near my house"}'

## Functional Tests

1. Register and log in as a citizen.
2. Submit a complaint.
3. Test Suggest Category.
4. Check complaint records in Supabase.
5. Open the hotspot map.
6. Test Authority login and permitted complaint processing.

## Security Tests

Verify that an Authority cannot access or modify complaints
belonging to another department.

These are testing instructions, not proof that all tests passed.
