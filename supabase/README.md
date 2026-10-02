# Supabase setup

1. Create a Supabase project and apply `migrations/20261001000000_initial_schema.sql` in the SQL Editor.
2. Create or invite the intended users in Supabase Auth. Signup should remain disabled for this internal workspace.
3. Add each approved Auth user's UUID to `public.workspace_members` from the SQL Editor. RLS grants application access only to listed users.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's public API settings.
5. Set the same two `VITE_` variables in the Vercel project's Environment Variables for each environment and redeploy.

Never put a `service_role` key in the frontend or Vercel frontend environment. The shared browser's localStorage is origin-specific; review and back up the deployed origin's data before running any migration.

The schema preserves the current application model. Test results remain on tests and rounds. Assignment-to-test relationships are derived through `round_id`. Test notes retain their current optional links to tests, rounds, and assignments.
