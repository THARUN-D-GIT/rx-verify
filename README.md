# MediVerify

A full-stack medicine verification and pharmacy availability app built with React, TanStack Start, TypeScript, and Supabase.

## What I built

MediVerify brings together a public medicine lookup flow and separate pharmacy and admin workflows:

- **QR batch verification:** a rate-limited Supabase Edge Function checks a code against registered batches and returns only the details needed for the result.
- **Medicine availability search:** lets people search the catalog and compare pharmacy stock and prices.
- **Pharmacy workspace:** supports pharmacy registration, inventory updates, low-stock visibility, and reservation handling.
- **Admin workspace:** manages the medicine catalog, registered batches, user roles, and verification activity.
- **Authentication and database access:** uses Supabase Auth and Postgres row-level security for user, pharmacy, and admin access.

## Technical highlights

- React 19 and TypeScript with file-based TanStack Router routes.
- TanStack Query for asynchronous data fetching and cache updates.
- Supabase Auth, Postgres, generated database types, and row-level security.
- Server-only Supabase client configuration for privileged operations.
- Responsive interface built with Tailwind CSS and reusable Radix UI components.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in the Supabase URL and publishable key.
3. Apply the tracked Supabase migrations and deploy the `verify-medicine` Edge Function.
4. Start the development server with `npm run dev`.

Set `SUPABASE_SERVICE_ROLE_KEY` only in a trusted server environment. Never expose it in a `VITE_*` variable or commit a populated `.env` file.

## Data and safety note

This project demonstrates a registry-based QR lookup. A registry match does not independently authenticate the physical package or replace advice from a pharmacist, manufacturer, or regulator. Do not enter patient-identifying information into the demo.
