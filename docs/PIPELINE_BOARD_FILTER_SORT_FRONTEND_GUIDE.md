# Pipeline Board Filter and Sort (Frontend Guide)

## Endpoint

Use the existing pipeline details endpoint with query params:

- `GET /api/pipelines/:id`

Example:

- `/api/pipelines/5?leadName=rahul&stageId=2&sortBy=name&sortOrder=asc`

---

## What It Returns

This endpoint returns:

- Pipeline basic details (`id`, `name`, `branchId`, `companyId`, etc.)
- `stages` array for board columns
- `leads` flat array (filtered + sorted list)
- `filters` object (echo of applied filters)
- `sort` object (echo of sort options)

Important behavior:

- All assigned stages are always returned in `stages` (even when no lead matches filters).
- Each stage contains `leads: []` if no leads match for that stage.

---

## Supported Query Parameters

### Filters

- `stageId` (number)
- `assignedToId` (number)
- `leadName` (string)  
  - Alias supported: `name`
- `mobile` (string)
- `interestedFor` (string)
- `dateFrom` (date string, e.g. `2026-05-01`)
- `dateTo` (date string, e.g. `2026-05-20`)

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

- No filters
- `sortBy=createdAt`
- `sortOrder=desc`

---

## Query Examples

### 1) Filter by Stage

- `/api/pipelines/5?stageId=3`

### 2) Filter by Assigned User

- `/api/pipelines/5?assignedToId=14`

### 3) Search by Lead Name

- `/api/pipelines/5?leadName=anil`

### 4) Filter by Date Range

- `/api/pipelines/5?dateFrom=2026-05-01&dateTo=2026-05-20`

### 5) Combine Multiple Filters + Sorting

- `/api/pipelines/5?stageId=2&assignedToId=14&leadName=rahul&sortBy=name&sortOrder=asc`

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
- `dateFrom` and `dateTo` must be valid dates
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

