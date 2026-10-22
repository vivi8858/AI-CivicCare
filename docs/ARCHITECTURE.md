# AI CivicCare Architecture

React + Vite: Displays the user interface.

Node.js + Express: Exposes REST API endpoints and communicates
with the Python service.

Python + FastAPI: Processes complaint descriptions using
rule-based keyword classification.

Supabase: Provides authentication, PostgreSQL and file storage.

## Data Flow

Citizen enters complaint description
-> React sends POST request
-> Express receives request
-> Python FastAPI classifies text
-> Express returns JSON
-> React displays suggested category

Some complaint database operations use the Supabase
JavaScript client directly from React.
