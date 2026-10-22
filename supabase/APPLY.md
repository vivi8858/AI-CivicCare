# Apply the CivicCare database migration

Do this in the Supabase SQL editor. The app does not run SQL for you.

1. Open the project `hottfizrzmizqtmmybcb` (or your linked project).
2. SQL Editor → New query.
3. Paste `supabase/migrations/20261015_civiccare_secure_workflow.sql`.
4. Run it. It should complete inside a transaction.
5. Create at least one authority (citizens cannot self-promote):

```sql
update public.profiles
set role = 'authority', department = null
where id = '<auth user uuid>';
```

Use a department name such as `Roads & Public Works` if that officer should only see that queue.

6. Authentication → Providers → Email:
   - For local testing you may disable “Confirm email”, or add custom SMTP so more than ~2 signups per hour succeed.
7. Confirm the bucket `complaint-evidence` exists under Storage.

The frontend uses only the publishable/anon key. Never put the service-role key in `frontend/.env.local`.
