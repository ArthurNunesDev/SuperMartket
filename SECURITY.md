# Security

## Application boundaries

- The GitHub Pages frontend contains only the Supabase publishable key. This key is public by design; database access must remain protected by RLS and narrow SQL grants.
- The Supabase service-role key, family PIN, and rate-limit secrets must remain Edge Function secrets. Never add them to frontend code, Vite variables, commits, or issue comments.
- Anonymous Supabase Auth users are treated as authenticated database users. Every data policy must scope access through the current user's server-side session membership.

## Database protections

The migration `20261111160000_harden_session_data_access.sql`:
- removes TRUNCATE, TRIGGER, REFERENCES, and broad table privileges from browser users;
- grants only the table and column operations used by the client;
- derives item author/editor names from the authenticated session member rather than trusting request fields;
- keeps planned-item purchase and update operations behind validated RPCs.

Apply migrations through the Supabase migration workflow after review. Do not run the migration against production before confirming the target project and reviewing the SQL.

## Browser protections

The document CSP allows scripts only from the application origin and connections only to the configured Supabase project. React-rendered user text remains escaped; do not introduce `dangerouslySetInnerHTML` for user-controlled values.

GitHub Pages does not provide repository-controlled response headers. The HTML CSP therefore cannot replace response-header protections such as HSTS, X-Content-Type-Options, X-Frame-Options, or a response-header frame-ancestors directive. Those require a hosting/CDN layer that supports custom headers.

## Operational checks

- Dependabot is configured for weekly npm updates and monthly GitHub Actions updates.
- The repository currently has no committed npm lockfile. Until one is generated and reviewed, installs are not fully reproducible and npm audit cannot be used as a reliable CI gate. Generate and commit `package-lock.json`, then switch CI from `npm install` to `npm ci` and add `npm audit --audit-level=high`.
- Review Supabase Security Advisor after each database migration.
- Keep Realtime channels private and retain the `realtime.messages` policies that require authenticated membership in the channel's matching session.
- Test cross-session isolation with two separate anonymous devices before releasing security migrations.

## Reporting

Do not publish credentials, access tokens, family PINs, or exploit details in public issues. Rotate any secret that has been exposed.
