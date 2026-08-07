# Prompt: Build the EMT / Referral Tab (Frontend)

## Context

Add a new **EMT / Referral** tab to the facility-side application. This tab lets facility staff see incoming ambulance/EMT referrals for their facility, review the patient's Client Registry (CR) data, and perform a **handover** (OTP-verified) that transfers the patient from the ambulance/EMT team to a receiving doctor at the facility. Once handover completes, the patient's visit should start automatically.

### Where it lives (placement — important)

The EMT / Referral tab must live **inside the existing dashboard/queue window** that the app already renders for worklists — the same window that hosts queues like **Laboratory**, **Radiology**, **Pharmacy**, etc. Specifically, it should appear as:

- A **left-hand navigation entry** grouped with the other queue modules (Laboratory, Radiology, Pharmacy, …), reusing the existing nav item/icon/styling pattern — do **not** create a new top-level page or a separate shell/route outside this window.
- A **summary count card** in the dashboard's top strip (the row of stat cards showing per-queue counts), mirroring how Laboratory/Radiology/Pharmacy surface their pending counts. Clicking the card navigates into the EMT queue, same as the others.
- A **queue view panel** rendered in the same content area as the other queues, with the same table/list styling, sort controls, search/filter bar, and auto-refresh behavior already used by those queues.

In short: this is a **new queue module inside the existing window**, not a standalone screen. Mirror the Laboratory/Radiology/Pharmacy queues exactly — the only new behavior is the handover (initiate → OTP → verify) flow on each row.

Before writing any code, **explore the existing repo** to identify:
- The frontend framework/conventions already in use (component library, routing, state management, API client/fetch wrapper, auth token storage).
- **How the dashboard/queue window is composed** — where the left nav items, the summary count cards, and the queue panels are registered. Find the exact files/config where Laboratory / Radiology / Pharmacy are wired in, and add EMT / Referral in the same place(s) using the same registration mechanism (extension slot, registry, route config — whatever the app uses).
- How an existing queue (e.g. Laboratory) fetches its list, renders its table, handles pagination, auto-refresh, and per-row actions — clone that structure and swap in the EMT endpoints/data.
- Where the summary count cards are defined and how each card's count is sourced — add an EMT card the same way (count sourced from `GET /api/v1/claims/emt/pending`, or the queue's total).
- Where the authenticated facility (`X-Facility-Id` / `X-Facility-Id-Type`) and bearer token are currently sourced from, since the new tab reuses them.
- Whether a Client Registry (CR) lookup service/hook already exists elsewhere in the app (it's referenced by other flows). Reuse it instead of writing a new CR client.
- How "launch patient visit workspace" is triggered elsewhere in the app (there should be an existing action/route/event for starting a visit) — reuse it.

State the conventions you found in one short summary before implementing, explicitly calling out the file(s)/registration points where you added the nav entry, summary card, and queue panel.

## Data sources

### 1. List pending referrals
`GET /api/v1/claims/emt/pending` — list referrals for the current facility. Use the app's existing authenticated API client (which already injects `Authorization: Bearer <token>`, `X-Facility-Id`, and `X-Facility-Id-Type`). Confirm the exact base URL/path prefix from the codebase's existing API client config; the app already knows how to reach the backend.

Support the standard pagination query params (`limit`, `offset`) that the endpoint accepts.

Example response:
```json
{
  "results": [
    {
      "submission_id": 3,
      "cr_id": "CR5617849204955-8",
      "status": "pending_acceptance",
      "case_number": "AMB-d22419d8-6d36-4b2f-a33c-3e008bd85f77-FAC",
      "ambulance_fr_code": "FID-AMB-916293-3",
      "facility_fr_code": "FID-47-108521-3",
      "evacuation_scene": "",
      "referral_reason": "",
      "referral_category": "",
      "transport_modality": "",
      "referral_notes": "Chief complaint: Test. History of present illness: Test. Medical history: Test",
      "bundle_id": "d22419d8-6d36-4b2f-a33c-3e008bd85f77",
      "interventions": ["SHA-01-001"],
      "requested_at": "2026-08-04T09:37:39.438967Z",
      "updated_at": "2026-08-04T09:37:40.428903Z"
    }
  ],
  "count": 3,
  "limit": 50,
  "offset": 0
}
```
Treat `limit`/`offset`/`count` as real pagination — implement paging (or "load more") rather than assuming everything fits on one page.

### 2. Patient dataset for each referral
For each `cr_id` in the list, fetch the patient's Client Registry record via the existing CR lookup mechanism in the codebase, and merge it into the row (name, sex, DOB, national ID, etc. — whatever fields the CR service returns) so the queue shows a human-readable patient, not just a `cr_id`. Fetch lazily (on row expand / on demand) if eagerly fetching all CR records for every row would be slow or rate-limited — use judgment based on typical queue size, and note your choice.

### 3. Initiate handover
`POST /api/v1/claims/emt/handover/initiate` — using the app's authenticated API client (auth headers + facility headers injected automatically).

Request body:
```json
{
  "incidence_number": "AMB-d22419d8-6d36-4b2f-a33c-3e008bd85f77-FAC",
  "identifier": "A13579",
  "identifier_type": "registration_number",
  "regulator": "KMPDC"
}
```
- `incidence_number` = the referral's `case_number`.
- `identifier` / `identifier_type` / `regulator` describe the **receiving doctor** — source these from the logged-in practitioner's profile (registration number, regulator body). Find how the app already resolves the current practitioner's regulatory identifiers; if there's no such lookup yet, surface that as a blocking dependency rather than hardcoding a value.
- Capture the response's request/reference id (e.g. `request_id`) — you'll need it for the verify call. Inspect the actual response shape at implementation time and adapt.

### 4. Verify handover OTP
`POST /api/v1/claims/emt/handover/verify` — using the app's authenticated API client.

Request body:
```json
{
  "incidence_number": "AMB-d22419d8-6d39-4b2f-a33c-3e008bd85f77-FAC",
  "request_id": "82fd22b6-e366-4077-9866-e1c4ed7328b0",
  "otp": "623415"
}
```

## Required UI/UX flow

1. **Queue view** — table/list of pending referrals: patient name (from CR), CR ID, case number, ambulance code, requested-at (relative + absolute time), interventions, referral notes (truncated with expand), status badge. Sort by `requested_at` descending by default.
2. **Row detail** — expandable/clickable row shows full CR dataset and full referral fields (`referral_reason`, `referral_category`, `transport_modality`, `evacuation_scene`, `referral_notes`, `interventions`).
3. **"Handover" action** on each row:
   - Confirmation step showing which patient/case is being handed over and to which doctor (their name, not just registration number).
   - On confirm, call **initiate**. Show a loading state ("Sending OTP to doctor…").
   - On success, open an **OTP entry modal**. Include a way to resend/re-initiate if the doctor didn't receive it (only if the backend supports it — check for a resend capability before assuming one).
   - On OTP submit, call **verify**. Show loading state.
   - On verify success:
     - Mark the referral as handed over / remove it from the pending queue.
     - Refresh the referral list from the source of truth (don't just splice locally — re-fetch, or reconcile with the server's returned status).
     - Automatically launch the patient visit workspace for that patient (reuse the app's existing "start visit" mechanism).
     - Show a success confirmation (toast/banner) naming the patient and case number.
4. **Auto-refresh**: poll the referral list on an interval (find the app's existing polling convention/interval for similar queues; otherwise default to something reasonable like 30s) and also allow manual refresh.

## Error handling (API layer)

The backend can fail in several distinct ways — handle each with a specific, user-readable message rather than a generic "something went wrong":

- **Network/timeout** — show a retry affordance; don't silently drop the queue.
- **401/403** — token/session issue; surface a re-authenticate prompt consistent with how the rest of the app handles auth expiry.
- **404 / already handled** — e.g. another facility/user already accepted or the case no longer exists — remove it from the queue and tell the user why, don't leave a dead row.
- **409 / conflict** (e.g. handover already initiated or already completed) — reflect the real current status rather than retrying blindly.
- **400/422 validation errors** — surface the upstream message (or a mapped, human version of it) rather than a raw stack trace/JSON blob.
- **5xx** — treat as transient; allow retry, and don't mark the referral as failed permanently.
- **Invalid/expired OTP** — keep the modal open, show a specific "incorrect or expired code" message, let the user retry or re-initiate; don't force them back to the queue.
- **CR fetch failure for a given row** — degrade gracefully (show the row with cr_id and a "patient details unavailable" note) rather than failing the whole queue render.

All error states must be visible in the UI (not just console-logged) and must not leave the row stuck in a perpetual loading spinner.

## Acceptance criteria

- [ ] EMT / Referral is registered as a **module inside the existing dashboard/queue window** — a left-nav entry, a summary count card in the top strip, and a queue panel — wired in the exact same places/configs as Laboratory / Radiology / Pharmacy (no new top-level page or separate shell).
- [ ] The summary card shows the pending EMT referral count and navigates into the EMT queue when clicked, matching the other cards.
- [ ] Queue lists all `pending_acceptance` referrals for the current facility, paginated correctly against `count`/`limit`/`offset`, fetched from `GET /api/v1/claims/emt/pending`.
- [ ] Each row displays merged CR + referral data.
- [ ] Handover flow: `POST /api/v1/claims/emt/handover/initiate` → OTP modal → `POST /api/v1/claims/emt/handover/verify` → completion, matching the exact request/response fields above.
- [ ] On successful verify: queue refreshes from source of truth, and the patient's visit workspace launches automatically.
- [ ] Every specified error case has a distinct, user-facing treatment (see list above) with no unhandled promise rejections or blank screens.
- [ ] Loading, empty ("no pending referrals"), and error states are all implemented for the queue itself, not just for the handover modal.
- [ ] Unit tests cover: list rendering, initiate success/failure, verify success/failure, and the "already handled elsewhere" race condition.

## Deliverable

Implement the feature end to end (components, hooks/services, types, tests) following this spec, using the conventions you identified during exploration. Summarize what you found/assumed at the top of your response before diving into code.
