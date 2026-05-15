# Lead — Assign To Feature: Frontend Integration Guide

This document covers the two API endpoints added for the **Assign To** feature on the lead creation form, including request/response shapes, validation rules, and a step-by-step integration flow.

---

## Overview

When creating a lead, the form now includes an **Assign To** field — a dropdown populated with all active users in the logged-in user's branch. The selected user's `id` is sent along with the lead creation payload and stored as `assigned_to` in the database.

---

## Base URL

```
http://localhost:5000/api
```

All requests require a valid JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Endpoints

---

### 1. GET `/api/leads/branch-users`

Fetch all active users in the current user's branch to populate the **Assign To** dropdown.

**Call this before opening / rendering the create lead form.**

#### Request

```http
GET /api/leads/branch-users
Authorization: Bearer <token>
```

No query params or body required.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Branch users fetched",
  "data": {
    "users": [
      {
        "id": 3,
        "name": "Riya Shah",
        "email": "riya@example.com",
        "role": "MANAGER"
      },
      {
        "id": 7,
        "name": "Arjun Mehta",
        "email": "arjun@example.com",
        "role": "ISE"
      },
      {
        "id": 12,
        "name": "Priya Nair",
        "email": "priya@example.com",
        "role": "SALES_TEAM"
      }
    ]
  }
}
```

#### Error Responses

| Status | Reason |
|--------|--------|
| `400`  | Logged-in user has no branch associated with their account |
| `401`  | Missing or invalid token |
| `403`  | User does not have `LEAD canCreate` permission |

#### Notes

- The list is **sorted alphabetically by name**.
- Only users with `status = "ACTIVE"` are returned.
- The `role` field is the user's primary role name — useful for displaying alongside the name in the dropdown (e.g. `"Arjun Mehta (ISE)"`).
- `role` can be `null` if the user has no primary role assigned.

---

### 2. POST `/api/leads`

Create a new lead. Now accepts an optional `assignedToId` field.

#### Request

```http
POST /api/leads
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "pipelineId": 1,
  "name": "Rahul Verma",
  "mobile": "9876543210",
  "date": "2026-05-15",
  "interestedFor": "MBA",
  "assignedToId": 7
}
```

#### Fields

| Field          | Type     | Required | Description |
|----------------|----------|----------|-------------|
| `pipelineId`   | `number` | ✅ Yes   | ID of the pipeline this lead belongs to |
| `name`         | `string` | ✅ Yes   | Full name of the lead |
| `mobile`       | `string` | ✅ Yes   | Mobile number of the lead |
| `date`         | `string` | ✅ Yes   | Lead date — ISO 8601 format (`YYYY-MM-DD` or full datetime) |
| `interestedFor`| `string` | ❌ No    | What the lead is interested in (e.g. course name) |
| `assignedToId` | `number` | ❌ No    | ID of the user to assign this lead to (from the dropdown) |

#### Success Response `201`

```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": {
    "lead": {
      "id": 42,
      "pipelineId": 1,
      "stageId": 2,
      "assignedToId": 7,
      "name": "Rahul Verma",
      "mobile": "9876543210",
      "date": "2026-05-15T00:00:00.000Z",
      "interestedFor": "MBA",
      "isDeleted": false,
      "createdById": 3,
      "updatedById": null,
      "createdAt": "2026-05-15T08:30:00.000Z",
      "updatedAt": "2026-05-15T08:30:00.000Z",
      "pipeline": {
        "id": 1,
        "name": "Main Pipeline"
      },
      "stage": {
        "id": 2,
        "name": "Prospect",
        "isDefault": true
      },
      "assignedTo": {
        "id": 7,
        "name": "Arjun Mehta",
        "email": "arjun@example.com"
      }
    }
  }
}
```

> When `assignedToId` is not sent (or sent as `null`), the `assignedTo` field in the response will be `null`.

#### Validation Error Response `422`

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "name", "message": "name is required" },
    { "field": "mobile", "message": "mobile is required" }
  ]
}
```

#### Other Error Responses

| Status | Reason |
|--------|--------|
| `400`  | Invalid date format |
| `400`  | Assigned user is inactive |
| `403`  | Assigned user does not belong to your branch |
| `404`  | Pipeline not found or deleted |
| `404`  | Assigned user not found |
| `401`  | Missing or invalid token |
| `403`  | No `LEAD canCreate` permission |

---

## Frontend Integration Flow

### Step 1 — Load dropdown data

When the user navigates to the **Create Lead** page (or opens the modal), fetch branch users immediately:

```js
// React example
useEffect(() => {
  async function loadBranchUsers() {
    const res = await fetch('/api/leads/branch-users', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const json = await res.json()
    setBranchUsers(json.data.users) // [{ id, name, email, role }]
  }
  loadBranchUsers()
}, [])
```

### Step 2 — Render the dropdown

```jsx
<select
  name="assignedToId"
  value={formData.assignedToId}
  onChange={handleChange}
>
  <option value="">-- Unassigned --</option>
  {branchUsers.map((user) => (
    <option key={user.id} value={user.id}>
      {user.name} {user.role ? `(${user.role})` : ''}
    </option>
  ))}
</select>
```

### Step 3 — Submit the form

Include `assignedToId` in the POST body. If the user left it unselected, send `null` or omit the field entirely — both are valid.

```js
const payload = {
  pipelineId: formData.pipelineId,
  name: formData.name,
  mobile: formData.mobile,
  date: formData.date,
  interestedFor: formData.interestedFor || undefined,
  assignedToId: formData.assignedToId ? Number(formData.assignedToId) : null
}

const res = await fetch('/api/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify(payload)
})
```

### Step 4 — Display assigned user in lead list / detail

The `GET /api/leads` response now includes `assignedTo` on each lead object:

```json
"assignedTo": {
  "id": 7,
  "name": "Arjun Mehta",
  "email": "arjun@example.com"
}
```

Render it as a badge or avatar in the lead card/table. When `assignedTo` is `null`, show "Unassigned".

---

## Database Column Reference

| Column        | DB Name       | Type      | Nullable |
|---------------|---------------|-----------|----------|
| `assignedToId`| `assigned_to` | `INTEGER` | Yes      |

Foreign key references `users(id)`. Set to `NULL` on user delete (`ON DELETE SET NULL`).

---

## Permissions Required

| Action              | Permission Needed     |
|---------------------|-----------------------|
| Fetch branch users  | `LEAD` → `canCreate`  |
| Create lead         | `LEAD` → `canCreate`  |
| List leads          | `LEAD` → `canView`    |
