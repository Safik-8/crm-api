# Phase 1 Update (Pipeline + Stages + Leads)

This file documents the **latest Phase‑1 backend update** based on the “CRM Development (Phase 1)” requirements.

Base URL prefix: **`/api`**

All routes below require **Authentication**:
- Header: **`Authorization: Bearer <accessToken>`**
- Permissions are enforced via `hasPermission("<MODULE>", "<action>")`

Note:
- Some newer routes may use **role authorization** via `authorize("ROLE")` instead of `hasPermission(...)`. See **Daily Branch Reports** below.

---

## Standard response formats

### Success response envelope

All controllers return this shape:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human readable message",
  "data": {},
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

Notes:
- Create endpoints usually return **`statusCode: 201`**
- Real payload is always inside **`data`**

### Error response envelope

Operational errors return:

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "name", "message": "name is required" }
  ],
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

Common error codes:
- `VALIDATION_ERROR` (400) → `details` is usually an array of `{ field, message }`
- `BAD_REQUEST` (400)
- `UNAUTHORIZED` / `TOKEN_EXPIRED` / `TOKEN_INVALID` (401)
- `PERMISSION_DENIED` (403) → `details.required = "<MODULE>:<ACTION>"`
- `ROLE_NOT_ALLOWED` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)

---

## What was removed

- **Prospect module removed**
  - Deleted: `src/modules/prospect/*`
  - Removed route: `/api/prospects`

If your frontend previously used prospect APIs, switch to the **Lead + Pipeline + Stage** APIs below.

---

## What was added (Database / Prisma)

### New Phase‑1 tables

- `pipelines`
- `stages`
- `pipeline_stages`
- `leads`
- `lead_comments`

### Meaning of tables (important)

- **`stages`**: global stage master (shared across all pipelines).
- **`pipeline_stages`**: mapping table connecting a pipeline to stages with `order_no` (ordering is per pipeline).
- **`leads`**: belongs to a pipeline and a stage.
- **`lead_comments`**: comments/activity per lead.

### Default “Prospect” stage

On server startup, `initializeSystem()` ensures a default stage exists:
- `stages.name = "Prospect"`
- `stages.is_default = true`

---

## Roles & permissions (what each role can do)

Permissions are enforced as **module actions**:
- Actions: `canView`, `canCreate`, `canEdit`, `canDelete`
- Modules used in Phase‑1: `PIPELINE`, `STAGE`, `LEAD`, `ACTIVITY`

### Role → Phase‑1 access matrix (high level)

| Role | Pipelines (`PIPELINE`) | Stages Master (`STAGE`) | Leads (`LEAD`) | Lead Comments (`ACTIVITY`) |
|------|-------------------------|--------------------------|----------------|----------------------------|
| `SUPER_ADMIN` | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| `BRANCH_ADMIN` | Full CRUD | Full CRUD | Full CRUD | View/Create (edit/delete depends on your permissions seed) |
| `MANAGER` | View | View | Create/View/Edit | View/Create |
| `ISE` | No access | No access | Create/View/Edit (to move stage) | View/Create |

Important:
- If a user gets **403 `PERMISSION_DENIED`**, it means their permission record doesn’t allow that module/action (even if their role name is “ISE”).
- The backend checks permissions from the authenticated user’s permission map (not role name strings).

---

## Database tables (who uses which table)

| Table | Used by | When it changes |
|------|---------|-----------------|
| `stages` | Stage master APIs + pipeline assignment logic + lead creation | Create/update/delete a stage; or initial seeding of `Prospect` |
| `pipelines` | Pipeline APIs | Create/update/delete pipeline |
| `pipeline_stages` | Pipeline stage assignment + ordering + frontend kanban columns | Assign/reorder stages per pipeline; pipeline create auto-adds Prospect |
| `leads` | Lead APIs | Create lead; update lead stage |
| `lead_comments` | Lead comments APIs | Add/fetch comments |

---

## Phase‑1 Business Rules Implemented

### 1) Every pipeline MUST have “Prospect”

- When creating a pipeline, backend **auto-assigns** the global `Prospect` stage into `pipeline_stages` with `order_no = 1`.
- When assigning stages to a pipeline, backend always **forces** Prospect to be included.

### 2) Stages are global, assigned per pipeline

- Creating a stage does **not** automatically add it to pipelines.
- Use pipeline assignment API to connect stages to a specific pipeline.

### 3) When creating pipeline (frontend requirement)

Frontend can:
- **Show existing stages**: `GET /api/stages`
- **Allow new creation**: `POST /api/stages` OR use pipeline assign API with `newStages`
- **Assign + Order**: `POST /api/pipelines/:id/stages` (supports ordering + new stage creation)

### 4) Lead default stage is always Prospect

- `POST /api/leads` always sets lead’s `stageId` to the **default Prospect** stage.
- It also validates Prospect is assigned to the chosen pipeline.

### 5) ISE allowed actions (permissions)

ISE is configured to:
- **Add leads**: `LEAD:canCreate`
- **Update lead stage**: `LEAD:canEdit`
- **Add comments**: `ACTIVITY:canCreate`

ISE has **no** pipeline/stage master access by default.

---

## New APIs (Endpoints) — detailed

In all examples below, assume:
- Header: `Authorization: Bearer <token>`
- Content-Type: `application/json`

---

## Quick reference: request body fields (tables)

> For endpoints with **no JSON body** (GET/DELETE), no table is shown.

### Org context rule (important)

Some endpoints derive `companyId`/`branchId` from the authenticated user. For **pipeline creation**, required org fields depend on who is logged in:

- **Branch user** *(actor has `companyId` + `branchId`)*: send **only** `name`
- **Company-level user** *(actor has `companyId` but no `branchId`)*: must send **`branchId`**
- **SUPER_ADMIN** *(actor has no `companyId` and no `branchId`)*: must send **both `companyId` + `branchId`**

### Pipelines

#### POST `/api/pipelines`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `name` | string | ✅ Yes | Trimmed; cannot be empty. |
| `branchId` | number | ⚠️ Conditional | Required for company-level user; also required for `SUPER_ADMIN` (must send both `companyId` + `branchId`). |
| `companyId` | number | ⚠️ Conditional | Required only for `SUPER_ADMIN` (must send both `companyId` + `branchId`). |

#### PUT `/api/pipelines/:id`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `name` | string | ✅ Yes | Trimmed; cannot be empty. |

#### POST `/api/pipelines/:id/stages`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `stageIds` | number[] | ❌ No | Existing global `stages.id` to assign. |
| `newStages` | `{ name: string }[]` | ❌ No | Creates/restores global stages by name, then assigns them. |
| `orderedStageIds` | number[] | ❌ No | If provided, must contain **exactly** the final assigned stage ids (including Prospect). |

#### PUT `/api/pipelines/:id/stages/order`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `orderedStageIds` | number[] | ✅ Yes | Must match the pipeline’s current assigned stage id set; must include Prospect. |

### Stages (Master)

#### POST `/api/stages`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `name` | string | ✅ Yes | Trimmed; cannot be empty. |

#### PUT `/api/stages/:id`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `name` | string | ✅ Yes | Trimmed; cannot be empty. Default stage (`Prospect`) cannot be renamed. |

### Leads + Comments

#### POST `/api/leads`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `pipelineId` | number | ✅ Yes | Lead will be created in Prospect stage for this pipeline. |
| `name` | string | ✅ Yes | Trimmed; cannot be empty. |
| `mobile` | string | ✅ Yes | Trimmed; cannot be empty. |
| `date` | string (parseable date) | ✅ Yes | Must be parseable by `new Date(date)`. |
| `interestedFor` | string | ❌ No | Also accepted as `interested_for`. Stored as `interestedFor`. |

#### PATCH `/api/leads/:id/stage`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `stageId` | number | ✅ Yes | Must be assigned to the lead’s pipeline via `pipeline_stages`. |

#### POST `/api/leads/:id/comments`

| Field | Type | Required | Notes |
|------|------|----------|------|
| `comment` | string | ✅ Yes | Trimmed; cannot be empty. |

### Daily Branch Reports (`/api/daily-branch-reports`)

These endpoints are used to submit and view **daily ISE performance reports**.

Important:
- Uses **role authorization** (`authorize("ISE")`, `authorize("BRANCH_ADMIN")`) instead of module permissions.
- Branch is derived from the logged-in user (`req.user.branchId`).

#### POST `/api/daily-branch-reports/submit`

Who can access:
- Role: `ISE`

What it does:
- Creates or updates the current user’s daily report for the given date.
- Guarantees **one report per day per user per branch** (it upserts on `branchId + reportDate + createdById`).

Request body fields:

| Field | Type | Required | Notes |
|------|------|----------|------|
| `reportDate` | string (date/datetime) | ✅ Yes | Use `YYYY-MM-DD` or ISO datetime. |
| `callsReceived` | number | ✅ Yes | `0` is treated as missing in current validation. |
| `qualifiedLeads` | number | ✅ Yes | `0` is treated as missing in current validation. |
| `counsellingDone` | number | ✅ Yes | `0` is treated as missing in current validation. |
| `counsellingBooked` | number | ✅ Yes | `0` is treated as missing in current validation. |
| `officeVisits` | number | ✅ Yes | `0` is treated as missing in current validation. |
| `closures` | number | ✅ Yes | `0` is treated as missing in current validation. |
| `followupsDone` | number | ✅ Yes | `0` is treated as missing in current validation. |
| `pendingFollowups` | number | ✅ Yes | `0` is treated as missing in current validation. |

Request example:

```json
{
  "reportDate": "2026-04-27",
  "callsReceived": 20,
  "qualifiedLeads": 5,
  "counsellingDone": 3,
  "counsellingBooked": 2,
  "officeVisits": 1,
  "closures": 1,
  "followupsDone": 10,
  "pendingFollowups": 4
}
```

Success (201):

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Form filled successfully",
  "data": {},
  "timestamp": "2026-04-27T00:00:00.000Z"
}
```

Validation error (400) example:

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "reportDate", "message": "Report date is required" }
  ],
  "timestamp": "2026-04-27T00:00:00.000Z"
}
```

#### GET `/api/daily-branch-reports/get-reports`

Who can access:
- Role: `BRANCH_ADMIN`

What it returns:
- Branch totals (sum) for all ISE reports in the range
- Count of reports
- Top performers (ISE users) ranked by a metric

Query params (optional):
- `startDate`, `endDate`: date/datetime (defaults to today)
- `sortBy`: `callsReceived | qualifiedLeads | counsellingDone | counsellingBooked | officeVisits | closures | followupsDone | pendingFollowups` (default `pendingFollowups`)
- `order`: `asc | desc` (default `desc`)
- `top`: number (default 5, min 1, max 50)

Success (200) (shape):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Daily branch reports fetched successfully",
  "data": {
    "range": { "startDate": "ISO", "endDate": "ISO" },
    "totals": {
      "callsReceived": 0,
      "qualifiedLeads": 0,
      "counsellingDone": 0,
      "counsellingBooked": 0,
      "officeVisits": 0,
      "closures": 0,
      "followupsDone": 0,
      "pendingFollowups": 0
    },
    "reportsCount": 0,
    "topMetric": "pendingFollowups",
    "topOrder": "desc",
    "topPerformers": [
      {
        "user": { "id": 1, "name": "User", "email": "user@example.com" },
        "totals": {
          "callsReceived": 0,
          "qualifiedLeads": 0,
          "counsellingDone": 0,
          "counsellingBooked": 0,
          "officeVisits": 0,
          "closures": 0,
          "followupsDone": 0,
          "pendingFollowups": 0
        }
      }
    ]
  },
  "timestamp": "2026-04-27T00:00:00.000Z"
}
```

### Pipelines (`/api/pipelines`)

#### POST `/api/pipelines` (create pipeline)

Permission: `PIPELINE:canCreate`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`

Request body fields:

- **name** *(string, required)*: Pipeline name (trimmed). Example: `"Admissions 2026"`.
- **branchId** *(number, conditionally required)*:
  - Required **only** when logged-in user has `companyId` but **no** `branchId` (company-level user).
- **companyId** *(number, conditionally required)*:
  - Required **only** for `SUPER_ADMIN` users (no `companyId` and no `branchId` on actor).

Request body (branch user):

```json
{ "name": "Admissions 2026" }
```

Notes about org fields:
- Branch user: company/branch resolved from logged-in user.
- Company-level user (no branch): must send `branchId`.
- Super admin: must send `companyId` + `branchId`.

Request body (company-level user without branch):

```json
{ "name": "Admissions 2026", "branchId": 2 }
```

Request body (super admin):

```json
{ "name": "Admissions 2026", "companyId": 1, "branchId": 2 }
```

Success (201):

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Pipeline created successfully",
  "data": {
    "pipeline": {
      "id": 1,
      "companyId": 1,
      "branchId": 2,
      "name": "Admissions 2026",
      "isDeleted": false,
      "createdById": 10,
      "updatedById": null,
      "createdAt": "2026-04-16T00:00:00.000Z",
      "updatedAt": "2026-04-16T00:00:00.000Z"
    }
  },
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

Common errors:
- 403 `PERMISSION_DENIED` (`PIPELINE:canCreate`)
- 400 `VALIDATION_ERROR` (missing `name`, or missing `branchId` / `companyId` depending on actor)

---

#### GET `/api/pipelines` (list)

Permission: `PIPELINE:canView`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`, `MANAGER`

Success (200):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pipelines fetched",
  "data": {
    "pipelines": [
      { "id": 1, "companyId": 1, "branchId": 2, "name": "Admissions 2026" }
    ]
  },
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

Common errors:
- 403 `PERMISSION_DENIED` (`PIPELINE:canView`)

---

#### GET `/api/pipelines/:id` (details: stages + leads)

Permission: `PIPELINE:canView`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`, `MANAGER`

Success (200):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pipeline fetched",
  "data": {
    "pipeline": {
      "id": 1,
      "name": "Admissions 2026",
      "companyId": 1,
      "branchId": 2,
      "stages": [
        { "id": 1, "name": "Prospect", "isDefault": true, "orderNo": 1 }
      ],
      "leads": [
        {
          "id": 100,
          "name": "Aman",
          "mobile": "9999999999",
          "stageId": 1,
          "pipelineId": 1,
          "createdAt": "2026-04-16T00:00:00.000Z"
        }
      ]
    }
  },
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

Common errors:
- 404 `NOT_FOUND` (pipeline not found / deleted)
- 400 `BAD_REQUEST` (invalid id)
- 403 `PERMISSION_DENIED` (`PIPELINE:canView`)

---

#### PUT `/api/pipelines/:id` (update name)

Permission: `PIPELINE:canEdit`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`

Request body fields:

- **name** *(string, required)*: New pipeline name (trimmed).

Request body:

```json
{ "name": "Admissions 2026 - Updated" }
```

Success (200): `data = { pipeline: ... }`

Common errors:
- 404 `NOT_FOUND`
- 403 `PERMISSION_DENIED` (`PIPELINE:canEdit`)

---

#### DELETE `/api/pipelines/:id` (soft delete)

Permission: `PIPELINE:canDelete`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`

Success (200): `data = { pipeline: ... }`

Common errors:
- 404 `NOT_FOUND`
- 403 `PERMISSION_DENIED` (`PIPELINE:canDelete`)

---

#### POST `/api/pipelines/:id/stages` (assign stages + create new + ordering)

Permission: `PIPELINE:canEdit`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`

Rules:
- Backend always includes **Prospect**
- `orderedStageIds` (if provided) must contain exactly the stage ids being assigned

Request body fields (all optional, but at least one should be provided):

- **stageIds** *(number[], optional)*: Existing global `stages.id` values to assign to the pipeline.
- **newStages** *(array, optional)*: Create global stages (if they don’t exist), then assign them.
  - **newStages[].name** *(string, required per item)*: Stage name (trimmed). Empty names are ignored.
- **orderedStageIds** *(number[], optional)*: If provided, it must contain **exactly** the same stage ids that will end up assigned (including Prospect + stageIds + created/undeleted stages).
  - If omitted, backend orders as: Prospect first, then remaining by stage name (A→Z).

Request body:

```json
{
  "stageIds": [1, 2],
  "newStages": [{ "name": "Follow Up" }],
  "orderedStageIds": [1, 3, 2]
}
```

Success (200):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stages assigned to pipeline",
  "data": {
    "stages": [
      { "stageId": 1, "name": "Prospect", "isDefault": true, "orderNo": 1 },
      { "stageId": 3, "name": "Follow Up", "isDefault": false, "orderNo": 2 },
      { "stageId": 2, "name": "Qualified", "isDefault": false, "orderNo": 3 }
    ]
  },
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

Common errors:
- 400 `BAD_REQUEST` (orderedStageIds mismatch)
- 404 `NOT_FOUND` (pipeline not found)
- 403 `PERMISSION_DENIED` (`PIPELINE:canEdit`)

---

#### PUT `/api/pipelines/:id/stages/order` (reorder only)

Permission: `PIPELINE:canEdit`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`

Request body fields:

- **orderedStageIds** *(number[], required)*: Must match the pipeline’s currently assigned stage ids (same set).
  - Must include Prospect stage id (default stage).

Request body:

```json
{ "orderedStageIds": [1, 3, 2] }
```

Success (200): `data = { stages: [...] }`

Common errors:
- 400 `VALIDATION_ERROR` (missing orderedStageIds)
- 400 `BAD_REQUEST` (orderedStageIds doesn’t match existing assigned stages)
- 403 `PERMISSION_DENIED` (`PIPELINE:canEdit`)

---

### Stages (Master) (`/api/stages`)

#### POST `/api/stages` (create stage)

Permission: `STAGE:canCreate`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`

Request body fields:

- **name** *(string, required)*: Stage name (trimmed).

Request body:

```json
{ "name": "Qualified" }
```

Success (201): `data = { stage: ... }`

Common errors:
- 409 `CONFLICT` (duplicate stage name)
- 403 `PERMISSION_DENIED` (`STAGE:canCreate`)

---

#### GET `/api/stages` (list global stages)

Permission: `STAGE:canView`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`, `MANAGER`

Success (200):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stages fetched",
  "data": {
    "stages": [
      { "id": 1, "name": "Prospect", "isDefault": true },
      { "id": 2, "name": "Qualified", "isDefault": false }
    ]
  },
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

Common errors:
- 403 `PERMISSION_DENIED` (`STAGE:canView`)

---

#### PUT `/api/stages/:id` (rename)

Permission: `STAGE:canEdit`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`

Request body fields:

- **name** *(string, required)*: New stage name (trimmed).
  - Default stage (`Prospect`) cannot be renamed.

Request body:

```json
{ "name": "Contacted" }
```

Common errors:
- 400 `BAD_REQUEST` (attempt to rename default stage `Prospect`)
- 404 `NOT_FOUND` (stage not found)
- 403 `PERMISSION_DENIED` (`STAGE:canEdit`)

---

#### DELETE `/api/stages/:id` (soft delete)

Permission: `STAGE:canDelete`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`

Common errors:
- 400 `BAD_REQUEST` (attempt to delete default stage `Prospect`)
- 404 `NOT_FOUND`
- 403 `PERMISSION_DENIED` (`STAGE:canDelete`)

#### Reusable frontend endpoint (stages for a pipeline)

#### GET `/api/stages/pipeline/:pipelineId`

Permission: `PIPELINE:canView`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`, `MANAGER`

Success (200): ordered stages for Kanban columns

```json
{
  "stages": [
    { "id": 1, "name": "Prospect", "isDefault": true, "orderNo": 1 }
  ]
}
```

Common errors:
- 404 `NOT_FOUND` (pipeline not found)
- 403 `PERMISSION_DENIED` (`PIPELINE:canView`)

---

### Leads + Comments (`/api/leads`)

#### POST `/api/leads` (create lead; default stage = Prospect)

Permission: `LEAD:canCreate`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`, `MANAGER`, `ISE`

Request body fields:

- **pipelineId** *(number, required)*: Target pipeline id.
- **name** *(string, required)*: Lead name (trimmed).
- **mobile** *(string, required)*: Mobile number (trimmed).
- **date** *(string | datetime, required)*: Any value parseable by `new Date(date)`. Example: `"2026-04-16"` or `"2026-04-16T10:30:00.000Z"`.
- **interestedFor** *(string, optional)*: Stored as `interestedFor`.
  - Also accepted as **interested_for** (legacy) or **interestedFor** (preferred).

Request body:

```json
{
  "pipelineId": 1,
  "name": "Aman",
  "mobile": "9999999999",
  "date": "2026-04-16T00:00:00.000Z",
  "interested_for": "MBA"
}
```

Success (201): `data = { lead: ... }` (includes `pipeline` and `stage`)

Common errors:
- 400 `VALIDATION_ERROR` (missing required fields)
- 404 `NOT_FOUND` (pipeline not found)
- 400 `BAD_REQUEST` (pipeline missing required Prospect assignment)
- 403 `PERMISSION_DENIED` (`LEAD:canCreate`)

---

#### GET `/api/leads` (list leads)

Permission: `LEAD:canView`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`, `MANAGER`, `ISE`

Query params (optional):
- `pipelineId`
- `stageId`
- `page`, `limit`

Success (200):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Leads fetched",
  "data": {
    "leads": [
      {
        "id": 100,
        "pipelineId": 1,
        "stageId": 1,
        "name": "Aman",
        "mobile": "9999999999",
        "date": "2026-04-16T00:00:00.000Z",
        "interestedFor": "MBA"
      }
    ],
    "pagination": { "total": 1, "page": 1, "limit": 20, "pages": 1 }
  },
  "timestamp": "2026-04-16T00:00:00.000Z"
}
```

Common errors:
- 403 `PERMISSION_DENIED` (`LEAD:canView`)

---

#### PATCH `/api/leads/:id/stage` (move lead to another stage)

Permission: `LEAD:canEdit`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`, `MANAGER`, `ISE`

Request body fields:

- **stageId** *(number, required)*: New stage id.
  - Must be assigned to the lead’s pipeline in `pipeline_stages`.

Request body:

```json
{ "stageId": 2 }
```

Backend validation:
- `stageId` must be assigned to the lead’s pipeline in `pipeline_stages`.

Common errors:
- 404 `NOT_FOUND` (lead not found)
- 400 `BAD_REQUEST` (stage not assigned to pipeline)
- 403 `PERMISSION_DENIED` (`LEAD:canEdit`)

#### Comments

---

#### POST `/api/leads/:id/comments`

Permission: `ACTIVITY:canCreate`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`, `MANAGER`, `ISE`

Request body fields:

- **comment** *(string, required)*: Comment text (trimmed).

Request body:

```json
{ "comment": "Called lead, interested." }
```

Success (201): `data = { comment: ... }`

Common errors:
- 404 `NOT_FOUND` (lead not found)
- 403 `PERMISSION_DENIED` (`ACTIVITY:canCreate`)

---

#### GET `/api/leads/:id/comments`

Permission: `ACTIVITY:canView`

Access (roles): `SUPER_ADMIN`, `BRANCH_ADMIN`, `MANAGER`, `ISE`

Success (200): `data = { comments: [...] }`

Common errors:
- 404 `NOT_FOUND`
- 403 `PERMISSION_DENIED` (`ACTIVITY:canView`)

---

## Files changed (high signal)

- Added:
  - `src/modules/pipeline/*`
  - `src/modules/stage/*`
  - `src/modules/lead/*`
- Updated:
  - `src/index.js` (new routes)
  - `src/config/initSystem.js` (sync roles/permissions + seed default Prospect stage)
  - `prisma/schema.prisma` (Phase‑1 models and relation fixes)
- Removed:
  - `src/modules/prospect/*`

---

## Notes (DB sync)

If your database was missing Phase‑1 tables, a safe additive SQL script was added and executed:
- `prisma/phase1_safe_add_tables.sql`

This script **creates missing tables only** and does **not** drop existing tables.

