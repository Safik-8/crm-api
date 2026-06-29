# Lead Update & Delete — Frontend Integration Guide (Detailed)

This document is the **primary frontend reference** for:

- **`PUT /api/leads/:id`** — update lead details  
- **`DELETE /api/leads/:id`** — soft-delete lead  

Both routes require the **same permission as create lead**: `LEAD:canCreate`.

**Backend file:** `src/modules/lead/lead.routes.js`  
**Base URL:** `/api` (example: `http://localhost:5000/api`)

---

## Table of contents

1. [Quick reference](#1-quick-reference)  
2. [Authentication & permissions](#2-authentication--permissions)  
3. [Response & error envelopes](#3-response--error-envelopes)  
4. [**UPDATE lead — `PUT /api/leads/:id` (full spec)**](#4-update-lead--put-apileadsid-full-spec)  
5. [**DELETE lead — `DELETE /api/leads/:id` (full spec)**](#5-delete-lead--delete-apileadsid-full-spec)  
6. [Board integration after update/delete](#6-board-integration-after-updatedelete)  
7. [What these routes do NOT do](#7-what-these-routes-do-not-do)  
8. [Other lead routes (short)](#8-other-lead-routes-short)  
9. [Checklist & common mistakes](#9-checklist--common-mistakes)  

---

## 1. Quick reference

| | **Update** | **Delete** |
|--|------------|------------|
| **Method** | `PUT` | `DELETE` |
| **URL** | `/api/leads/:id` | `/api/leads/:id` |
| **`:id`** | Lead primary key (integer) | Same |
| **Body** | JSON — at least 1 editable field | None |
| **Permission** | `LEAD:canCreate` | `LEAD:canCreate` |
| **Success HTTP** | `200` | `200` |
| **Success message** | `Lead updated successfully` | `Lead deleted successfully` |
| **Data key** | `data.lead` | `data.lead` |
| **Delete type** | — | Soft (`isDeleted: true`) |

---

## 2. Authentication & permissions

### Headers (both routes)

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

(`DELETE` has no body; `Content-Type` is optional but harmless.)

### Permission rule

The middleware checks:

```text
req.user.permissions.LEAD.canCreate === true
```

| If user can… | Update `PUT` | Delete `DELETE` |
|--------------|--------------|-----------------|
| Create lead (`POST /api/leads`) | Yes | Yes |
| Only view leads (`LEAD:canView` only, e.g. CEO) | No → `403` | No → `403` |
| Move stage only (`LEAD:canEdit` but no `canCreate`) | No → `403` | No → `403` |

**Frontend:** Show **Edit** and **Delete** only when the logged-in user has **`LEAD:canCreate`** (same flag as “Add lead”).

### Branch / company scope

Even with permission, the lead must belong to a pipeline the user can access:

- **Branch user:** lead’s pipeline `branchId` must match user’s `branchId`.
- **Company user (no branch):** pipeline `companyId` must match.
- Wrong scope → `400 Bad Request` — `Invalid pipeline scope`.
- Deleted or missing lead → `404 Not Found` — `Lead`.

---

## 3. Response & error envelopes

### Success (update & delete)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lead updated successfully",
  "data": {
    "lead": { }
  },
  "timestamp": "2026-05-21T12:00:00.000Z"
}
```

(delete uses `"message": "Lead deleted successfully"`)

Always read the lead from **`response.data.lead`**, not the root.

### Validation error `400` — `VALIDATION_ERROR`

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "name", "message": "name cannot be empty" }
  ],
  "timestamp": "2026-05-21T12:00:00.000Z"
}
```

**Frontend:** Loop `details` and set `errors[field] = message` on the form.

### Permission `403` — `PERMISSION_DENIED`

```json
{
  "success": false,
  "statusCode": 403,
  "code": "PERMISSION_DENIED",
  "details": { "required": "LEAD:canCreate" }
}
```

### Not found `404` — `NOT_FOUND`

Lead id invalid, lead soft-deleted already, or id does not exist.

### Bad request `400` — `BAD_REQUEST`

Examples: `Invalid lead id`, `Invalid pipeline scope`, `Assigned user is inactive`, `Assigned user does not belong to the pipeline branch`.

### Forbidden `403` — `FORBIDDEN`

`Assigned user does not belong to your branch` (branch-scoped actor).

---

## 4. UPDATE lead — `PUT /api/leads/:id` (full spec)

### 4.1 Route

```http
PUT /api/leads/:id
```

| Part | Value |
|------|--------|
| `:id` | Lead `id` from card/list (e.g. `100`) |
| Body | JSON object |
| Response | Full lead with relations |

### 4.2 What can be updated

| Field | In `PUT` body? | Notes |
|-------|----------------|--------|
| `name` | Yes | Trimmed; cannot be empty string |
| `mobile` | Yes | Trimmed; cannot be empty string |
| `date` | Yes | Any value `new Date()` accepts |
| `interestedFor` | Yes | `null` or `""` clears field |
| `assignedToId` | Yes | `null` or `""` unassigns |
| `pipelineId` | **No** | Not supported |
| `stageId` | **No** | Use `PATCH /api/leads/:id/stage` |
| `stage`, comments | **No** | Read-only in response |

### 4.3 Partial update rules

- You may send **one or more** fields in a single request.
- You must send **at least one** of: `name`, `mobile`, `date`, `interestedFor`, `assignedToId`.
- Fields **not** sent are **left unchanged** in the database.
- Empty body `{}` → error:

```json
{
  "details": [
    {
      "field": "body",
      "message": "At least one field is required to update (name, mobile, date, interestedFor, assignedToId)"
    }
  ]
}
```

**Recommended for edit forms:** On Save, send **all** editable fields every time (simpler than diffing):

```json
{
  "name": "Aman Kumar",
  "mobile": "9876543210",
  "date": "2026-05-21",
  "interestedFor": "MBA",
  "assignedToId": 12
}
```

### 4.4 Field reference (detailed)

#### `name` (string)

| Rule | Detail |
|------|--------|
| Required in body | Only if you include the key `name` |
| Validation | After trim, must not be empty |
| Error field | `name` → `"name cannot be empty"` |

#### `mobile` (string)

| Rule | Detail |
|------|--------|
| Validation | After trim, must not be empty |
| Error field | `mobile` → `"mobile cannot be empty"` |

#### `date` (string | ISO datetime)

| Rule | Detail |
|------|--------|
| Examples | `"2026-05-21"`, `"2026-05-21T00:00:00.000Z"` |
| Validation | Must parse to valid `Date` |
| Error field | `date` → `"date must be a valid date"` |

**UI tip:** For date-only inputs, send `YYYY-MM-DD` or ISO midnight UTC to match create-lead behavior.

#### `interestedFor` (string | null)

| Rule | Detail |
|------|--------|
| Aliases | `interestedFor` or `interested_for` |
| Clear value | Send `null` or `""` |
| Stored | Trimmed string or `null` |

#### `assignedToId` (number | null)

| Rule | Detail |
|------|--------|
| Aliases | `assignedToId` or `assigned_to` |
| Unassign | `null` or `""` |
| Value | Must be active user id in **pipeline’s branch** |
| Dropdown | `GET /api/leads/branch-users` or `assignableUsers` from pipeline board |

| Error | When |
|-------|------|
| `assignedToId must be a valid user id` | Not a positive integer |
| `Assigned user` not found | `404` |
| `Assigned user is inactive` | `400` |
| Wrong branch | `400` or `403` |

### 4.5 Request examples

**Full edit (typical modal save)**

```http
PUT /api/leads/100
Authorization: Bearer eyJhbG...
Content-Type: application/json
```

```json
{
  "name": "Rahul Singh",
  "mobile": "9123456789",
  "date": "2026-05-21",
  "interestedFor": "MBA Finance",
  "assignedToId": 12
}
```

**Change assignee only**

```json
{ "assignedToId": 7 }
```

**Unassign**

```json
{ "assignedToId": null }
```

**Clear interested for**

```json
{ "interestedFor": null }
```

**Update phone only**

```json
{ "mobile": "9988776655" }
```

### 4.6 Success response `200` (full example)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lead updated successfully",
  "data": {
    "lead": {
      "id": 100,
      "pipelineId": 5,
      "stageId": 2,
      "previousStageId": 1,
      "stageChangedById": 7,
      "stageChangedAt": "2026-05-20T14:30:00.000Z",
      "assignedToId": 12,
      "name": "Rahul Singh",
      "mobile": "9123456789",
      "date": "2026-05-21T00:00:00.000Z",
      "interestedFor": "MBA Finance",
      "isDeleted": false,
      "createdById": 7,
      "updatedById": 10,
      "createdAt": "2026-05-18T09:00:00.000Z",
      "updatedAt": "2026-05-21T12:00:00.000Z",
      "pipeline": {
        "id": 5,
        "name": "Admissions 2026"
      },
      "stage": {
        "id": 2,
        "name": "Counselling",
        "isDefault": false
      },
      "previousStage": {
        "id": 1,
        "name": "Prospect",
        "isDefault": true
      },
      "stageChangedBy": {
        "id": 7,
        "name": "Priya",
        "email": "priya@example.com"
      },
      "assignedTo": {
        "id": 12,
        "name": "Rahul",
        "email": "rahul@example.com"
      }
    }
  },
  "timestamp": "2026-05-21T12:00:00.000Z"
}
```

**After success:** Replace local card data with `data.lead` or refetch the pipeline board.

### 4.7 Update — error matrix

| HTTP | Code | Typical cause | Frontend action |
|------|------|---------------|-----------------|
| 400 | `VALIDATION_ERROR` | Empty body, empty name/mobile, bad date | Show field errors from `details` |
| 400 | `BAD_REQUEST` | Invalid lead id, bad assignee, scope | Toast + message |
| 403 | `PERMISSION_DENIED` | No `LEAD:canCreate` | Hide edit UI / redirect |
| 403 | `FORBIDDEN` | Assignee wrong branch | Show on assignee field |
| 404 | `NOT_FOUND` | Lead deleted or wrong id | Close modal, refresh board |

### 4.8 Frontend implementation (step by step)

```text
1. User opens "Edit lead" on Kanban card (lead.id = 100)
2. Pre-fill form from card data:
     name, mobile, date (format for date input),
     interestedFor, assignedToId
3. Load assignee options (once per modal):
     GET /api/leads/branch-users
     OR reuse pipeline.assignableUsers from board load
4. User clicks Save
5. PUT /api/leads/100 with JSON body
6. If success → update card in state OR refetch GET /api/pipelines/:pipelineId
7. If VALIDATION_ERROR → map details[] to form errors
8. If 403 → show "You don't have permission to edit leads"
```

### 4.9 JavaScript / fetch example

```javascript
/**
 * Update lead details (not stage).
 * Requires LEAD:canCreate.
 */
export async function updateLead(leadId, payload, accessToken) {
  const response = await fetch(`/api/leads/${leadId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  const json = await response.json()

  if (!json.success) {
    const err = new Error(json.message || "Update failed")
    err.status = json.statusCode
    err.code = json.code
    err.details = json.details
    throw err
  }

  return json.data.lead
}

// Usage — full form
await updateLead(100, {
  name: form.name.trim(),
  mobile: form.mobile.trim(),
  date: form.date, // e.g. "2026-05-21"
  interestedFor: form.interestedFor?.trim() || null,
  assignedToId: form.assignedToId ? Number(form.assignedToId) : null
}, token)
```

### 4.10 Axios example

```javascript
const { data } = await axios.put(
  `/api/leads/${leadId}`,
  {
    name: form.name,
    mobile: form.mobile,
    date: form.date,
    interestedFor: form.interestedFor || null,
    assignedToId: form.assignedToId ?? null
  },
  { headers: { Authorization: `Bearer ${token}` } }
)
const lead = data.data.lead
```

### 4.11 TypeScript types (optional)

```typescript
export interface UpdateLeadPayload {
  name?: string
  mobile?: string
  date?: string
  interestedFor?: string | null
  interested_for?: string | null
  assignedToId?: number | null
  assigned_to?: number | null
}

export interface LeadUserRef {
  id: number
  name: string
  email: string
}

export interface LeadStageRef {
  id: number
  name: string
  isDefault: boolean
}

export interface Lead {
  id: number
  pipelineId: number
  stageId: number
  previousStageId: number | null
  stageChangedById: number | null
  stageChangedAt: string | null
  assignedToId: number | null
  name: string
  mobile: string
  date: string
  interestedFor: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  pipeline: { id: number; name: string }
  stage: LeadStageRef
  previousStage: LeadStageRef | null
  stageChangedBy: LeadUserRef | null
  assignedTo: LeadUserRef | null
}
```

---

## 5. DELETE lead — `DELETE /api/leads/:id` (full spec)

### 5.1 Route

```http
DELETE /api/leads/:id
```

| Part | Value |
|------|--------|
| `:id` | Lead `id` (integer) |
| Body | **None** — do not send JSON body |
| Permission | `LEAD:canCreate` (same as create/update) |

### 5.2 What “delete” means (soft delete)

| | Behavior |
|--|----------|
| Database | `isDeleted` set to `true` |
| Row | Lead row **remains** in DB (not hard-deleted) |
| Board / list | Lead **excluded** — queries use `isDeleted: false` |
| Stage / pipeline | Unchanged on delete |
| Comments | Still in DB (not auto-deleted) |
| Restore API | **Not implemented** — treat as permanent in UI |

### 5.3 Request

```http
DELETE /api/leads/100
Authorization: Bearer eyJhbG...
```

No `Content-Type` body required.

### 5.4 Success response `200` (full example)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lead deleted successfully",
  "data": {
    "lead": {
      "id": 100,
      "pipelineId": 5,
      "stageId": 2,
      "previousStageId": 1,
      "stageChangedById": 7,
      "stageChangedAt": "2026-05-20T14:30:00.000Z",
      "assignedToId": 12,
      "name": "Rahul Singh",
      "mobile": "9123456789",
      "date": "2026-05-21T00:00:00.000Z",
      "interestedFor": "MBA Finance",
      "isDeleted": true,
      "createdById": 7,
      "updatedById": 10,
      "createdAt": "2026-05-18T09:00:00.000Z",
      "updatedAt": "2026-05-21T12:05:00.000Z",
      "pipeline": { "id": 5, "name": "Admissions 2026" },
      "stage": { "id": 2, "name": "Counselling", "isDefault": false },
      "previousStage": { "id": 1, "name": "Prospect", "isDefault": true },
      "stageChangedBy": { "id": 7, "name": "Priya", "email": "priya@example.com" },
      "assignedTo": { "id": 12, "name": "Rahul", "email": "rahul@example.com" }
    }
  },
  "timestamp": "2026-05-21T12:05:00.000Z"
}
```

**Check:** `data.lead.isDeleted === true` confirms success.

### 5.5 Delete — error matrix

| HTTP | Code | Typical cause | Frontend action |
|------|------|---------------|-----------------|
| 400 | `BAD_REQUEST` | Invalid lead id (non-integer, &lt; 1) | Fix id from card |
| 403 | `PERMISSION_DENIED` | No `LEAD:canCreate` | Hide delete button |
| 404 | `NOT_FOUND` | Already deleted or wrong id | Remove card from UI, refresh board |

**Note:** Deleting the same lead twice: second call returns **404** (lead treated as not found).

### 5.6 Frontend implementation (step by step)

```text
1. User clicks Delete on card (lead.id = 100)
2. Show confirmation:
     "Delete lead Rahul Singh? This cannot be undone."
3. On Confirm:
     DELETE /api/leads/100
4. On success:
     Option A — Optimistic: remove card from stages[].leads in local state
     Option B — Safe: refetch GET /api/pipelines/:pipelineId?...currentFilters
5. On 404: remove card anyway (already gone) + optional toast
6. On 403: toast "No permission to delete leads"
7. Disable delete button while request in flight (loading)
```

### 5.7 JavaScript / fetch example

```javascript
/**
 * Soft-delete lead. Requires LEAD:canCreate.
 */
export async function deleteLead(leadId, accessToken) {
  const response = await fetch(`/api/leads/${leadId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  const json = await response.json()

  if (!json.success) {
    const err = new Error(json.message || "Delete failed")
    err.status = json.statusCode
    err.code = json.code
    err.details = json.details
    throw err
  }

  return json.data.lead
}

// Usage
try {
  await deleteLead(100, token)
  // remove from UI or refetch board
} catch (e) {
  if (e.status === 403) alert("You cannot delete leads")
  else if (e.status === 404) refreshBoard()
  else alert(e.message)
}
```

### 5.8 React state example (remove card without full refetch)

```javascript
function removeLeadFromBoard(stages, leadId) {
  return stages.map((stage) => ({
    ...stage,
    leads: stage.leads.filter((l) => l.id !== leadId)
  }))
}

// after successful delete
setPipeline((prev) => ({
  ...prev,
  stages: removeLeadFromBoard(prev.stages, 100),
  leads: prev.leads.filter((l) => l.id !== 100)
}))
```

### 5.9 UI copy suggestions

| Element | Suggested text |
|---------|----------------|
| Menu item | Delete lead |
| Confirm title | Delete lead? |
| Confirm body | Lead **{name}** will be removed from the pipeline. |
| Confirm button | Delete |
| Success toast | Lead deleted |
| Error 403 | You don't have permission to delete leads |

---

## 6. Board integration after update/delete

### Where lead data comes from

| Screen | Source |
|--------|--------|
| Kanban board | `GET /api/pipelines/:pipelineId` → `data.pipeline.stages[].leads[]` |
| Lead list table | `GET /api/leads?pipelineId=...` |

There is **no** `GET /api/leads/:id`. For edit modal, use the card object you already have; after `PUT`, use **`data.lead`** from the response.

### After update

```http
PUT /api/leads/100
→ 200 data.lead
→ Update card in column OR
GET /api/pipelines/5?search=...&allDates=...
```

Preserve current board filters in the refetch URL (see `docs/PIPELINE_BOARD_FILTER_SORT_FRONTEND_GUIDE.md`).

### After delete

```http
DELETE /api/leads/100
→ 200 data.lead.isDeleted === true
→ Remove card OR refetch pipeline
```

---

## 7. What these routes do NOT do

| Action | Wrong API | Correct API |
|--------|-----------|-------------|
| Move card to another column | `PUT /api/leads/:id` with `stageId` | `PATCH /api/leads/:id/stage` |
| Change pipeline | `PUT` | Not supported |
| Hard delete from DB | `DELETE` | Only soft delete |
| Delete with `LEAD:canDelete` | Expecting `canDelete` | Uses **`LEAD:canCreate`** |
| Load single lead for edit | `GET /api/leads/:id` | Use card data + `PUT` response |

---

## 8. Other lead routes (short)

| Route | Method | Permission | Doc |
|-------|--------|------------|-----|
| Create | `POST /api/leads` | `canCreate` | `docs/LEAD_ASSIGN_TO_FRONTEND_GUIDE.md` |
| List | `GET /api/leads` | `canView` | Phase 1 doc |
| Move stage | `PATCH /api/leads/:id/stage` | `canEdit` | Phase 1 doc |
| Board + filters | `GET /api/pipelines/:id` | `PIPELINE:canView` | `docs/PIPELINE_BOARD_FILTER_SORT_FRONTEND_GUIDE.md` |

---

## 9. Checklist & common mistakes

### Update checklist

- [ ] Use `PUT`, not `POST` or `PATCH`
- [ ] URL includes numeric lead `id`
- [ ] Body has at least one allowed field
- [ ] `assignedToId` is user **id**, not name string
- [ ] Handle `details[]` for validation errors
- [ ] User has `LEAD:canCreate` before showing Save
- [ ] Date sent in parseable format
- [ ] Do not send `stageId` in update body

### Delete checklist

- [ ] Use `DELETE`, no body
- [ ] Confirm dialog before call
- [ ] Loading state on button
- [ ] Remove card or refetch on success
- [ ] User has `LEAD:canCreate` before showing Delete
- [ ] Handle 404 if lead already deleted

### Common mistakes

| Mistake | Fix |
|---------|-----|
| `PUT` with only `{}` | Send at least one field |
| Sending assignee display name | Send `assignedToId` number |
| Expecting `canDelete` permission | Use **`canCreate`** |
| Edit stage in update modal | Use drag + `PATCH .../stage` |
| Deleted lead still on board | Refetch or filter `isDeleted` client-side until refetch |

---

## Related documentation

- `docs/PIPELINE_BOARD_FILTER_SORT_FRONTEND_GUIDE.md` — board load, search, filters  
- `docs/LEAD_ASSIGN_TO_FRONTEND_GUIDE.md` — assign dropdown on create  
- `docs/PHASE1_PIPELINE_STAGE_LEAD_UPDATE.md` — backend Phase 1 reference  
