# Pipeline Board Filter and Sort (Frontend Guide)

## Endpoint

Use the existing pipeline details endpoint with query params:

- `GET /api/pipelines/:id`

Example:

- `/api/pipelines/5?search=rahul&stageId=2&sortBy=name&sortOrder=asc`

---

## What It Returns

This endpoint returns:

- Pipeline basic details (`id`, `name`, `branchId`, `companyId`, etc.)
- `stages` array for board columns
- `leads` flat array (filtered + sorted list)
- **`assignableUsers`** — active users in the **pipeline’s branch** for the “Assign to” / **assignedToId** dropdown (`id`, `name`, `email`, `role`). Build the dropdown from `name` (or `name` + `email`); when the user picks a row, send that user’s `id` as `assignedToId` in the query string.
- `filters` object (echo of applied filters)
- `sort` object (echo of sort options)

Important behavior:

- All assigned stages are always returned in `stages` (even when no lead matches filters).
- Each stage contains `leads: []` if no leads match for that stage.

### Assignee dropdown flow (recommended)

1. Call `GET /api/pipelines/:id` once (no need for a separate users call for the board).
2. Render `pipeline.assignableUsers` in the dropdown (show `name`; value = `id`).
3. When the user selects someone, refetch (or update URL) with `assignedToId=<selected id>`.
4. Omit `assignedToId` to show leads for all assignees (subject to other filters).

**Alternative (same user list, different route):** `GET /api/leads/branch-users` returns the same shape for the **logged-in user’s** branch only, and requires `LEAD` create permission. Prefer **`assignableUsers` on the pipeline response** for the board so company users opening a branch pipeline still get the correct branch’s users.

---

## Supported Query Parameters

### Filters

- `stageId` (number)
- `assignedToId` (number) — must match an `id` from `assignableUsers`
- **`search`** (string) — **one field** for the search box. Backend matches if the text appears in **any** of:
  - lead **name**
  - lead **mobile**
  - lead **interestedFor**  
  (case-insensitive, partial match; OR logic — one match is enough)  
  - Aliases (same behavior): `leadName`, `name`, `q`  
  - **Removed:** separate `mobile` and `interestedFor` query params
- `dateFrom` (date string, e.g. `2026-05-01`)
- `dateTo` (date string, e.g. `2026-05-20`)
- **`allDates`** — optional. When `1`, `true`, or `yes`, **no** date filter is applied (shows leads for any lead `date`). Use this when you need the full board without picking dates.

### Date default (when user picks no date)

If **both** `dateFrom` and `dateTo` are omitted (or empty), the API filters leads whose **`date`** falls on **today’s calendar day in UTC** (start `00:00:00.000Z` through end `23:59:59.999Z`). That matches how lead dates are stored (UTC day).

- Response echoes this in `filters.dateDefaultedToToday: true` and includes the effective `dateFrom` / `dateTo` used.
- To load **all** dates instead, pass `allDates=1`.

### Sort

- `sortBy`:
  - `createdAt` (default)
  - `updatedAt`
  - `name`
  - `date`
  - `mobile`
- `sortOrder`:
  - `asc`
  - `desc` (default)

---

## Default Behavior (No Query Params)

Request:

- `GET /api/pipelines/:id`

Default applied:

- **Lead `date`:** today (UTC day), unless you pass `allDates=1`
- No other filters (`assignedToId`, `stageId`, `search`, etc.)
- `sortBy=createdAt`
- `sortOrder=desc`
- `assignableUsers` is always included for the assignee dropdown

---

## Query Examples

### 1) Filter by Stage

- `/api/pipelines/5?stageId=3`

### 2) Filter by Assigned User

- `/api/pipelines/5?assignedToId=14`

### 3) Unified text search (name, mobile, or interested for)

- `/api/pipelines/5?search=99999` → matches mobile containing `99999`
- `/api/pipelines/5?search=MBA` → matches `interestedFor` containing `MBA`
- `/api/pipelines/5?search=anil` → matches name containing `anil`

### 4) Filter by Date Range

- `/api/pipelines/5?dateFrom=2026-05-01&dateTo=2026-05-20`

### 5) Full board without date filter

- `/api/pipelines/5?allDates=1`

### 6) Combine Multiple Filters + Sorting

- `/api/pipelines/5?stageId=2&assignedToId=14&search=rahul&sortBy=name&sortOrder=asc`

---

## Response Usage for Board UI

Use:

- `pipeline.stages` to render columns
- `stage.leads` inside each stage for cards

This avoids frontend grouping logic because API already groups leads by stage.

---

## Validation and Error Notes

Backend validates query values:

- `stageId` and `assignedToId` must be positive integers
- `sortBy` must be one of allowed values
- `sortOrder` must be `asc` or `desc`
- `dateFrom` and `dateTo` must be valid dates (when provided)
- `dateFrom` cannot be after `dateTo`

On invalid values, API returns validation error response.

---

## Suggested Frontend Integration Pattern

1. Keep filter state in URL query params.
2. On filter/sort change, update URL and refetch endpoint.
3. Render:
   - Empty stage columns if `stage.leads.length === 0`
   - Card list from `stage.leads`
4. Optionally display currently applied options from response:
   - `pipeline.filters`
   - `pipeline.sort`

