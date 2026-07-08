# Closure Stage Lock — Frontend Guide

## What Is It

Once a lead reaches the **"Closure"** stage, it is permanently locked.
No one can move it to any other stage — not even an admin.

This is enforced on the **backend** inside `updateLeadStageService`.
The frontend does not need to send any special flag — the API simply rejects the move with a `403`.

---

## Which Endpoint Is Affected

```
PATCH /api/leads/:id/stage
```

This is the only endpoint that moves a lead between stages.
The lock is checked here and only here.

---

## How It Works (Backend Flow)

```
PATCH /api/leads/:id/stage  { stageId: 5 }
         ↓
1. Validate stageId is a number
         ↓
2. Fetch lead from DB
         ↓
3. Fetch current stage name from DB
         ↓
4. Is currentStage.name === "Closure"?
   YES → throw ForbiddenError("This lead is closed. A closed lead cannot be moved to another stage.")
   NO  → continue with normal stage update
         ↓
5. Check new stageId is assigned to this pipeline
         ↓
6. Update lead.stageId, previousStageId, stageChangedById, stageChangedAt
```

The check happens **before** any DB write — nothing is changed if the lead is already closed.

---

## Error Response `403`

When someone tries to move a closed lead:

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "This lead is closed. A closed lead cannot be moved to another stage.",
  "details": null,
  "timestamp": "2026-05-26T10:00:00.000Z"
}
```

---

## All Other Stage Move Errors (for reference)

| Status | Code | When |
|---|---|---|
| `400 VALIDATION_ERROR` | `stageId` missing or not a number | |
| `400 BAD_REQUEST` | Stage not assigned to this pipeline | |
| `403 FORBIDDEN` | Lead is in Closure stage — **locked** | |
| `404 NOT_FOUND` | Lead does not exist or is deleted | |
| `403 FORBIDDEN` | Lead belongs to a different branch/company | |

---

## Frontend Implementation

### Disable the stage drag/drop or move button when lead is in Closure

The API always returns the current stage on every lead object:

```json
{
  "lead": {
    "id": 101,
    "stage": { "id": 6, "name": "Closure", "isDefault": true },
    ...
  }
}
```

Use `lead.stage.name === "Closure"` to lock the UI before even calling the API.

```jsx
// Disable stage change controls when lead is closed
const isClosed = lead.stage.name === "Closure"

// Example: disable a stage select dropdown
<select
  disabled={isClosed}
  title={isClosed ? "This lead is closed and cannot be moved" : ""}
  onChange={e => handleStageChange(lead.id, e.target.value)}
>
  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
</select>

// Example: disable a Kanban drag handle
<div
  draggable={!isClosed}
  style={{ opacity: isClosed ? 0.5 : 1, cursor: isClosed ? "not-allowed" : "grab" }}
>
  {lead.name}
</div>
```

### Handle the 403 from the API gracefully

Even with UI guards, always handle the API error in case it slips through:

```js
const moveLeadStage = async (leadId, stageId) => {
  try {
    const res = await axios.patch(`/api/leads/${leadId}/stage`, { stageId }, { withCredentials: true })
    return res.data.data.lead
  } catch (err) {
    const msg = err.response?.data?.message
    if (err.response?.status === 403 && msg?.includes("closed")) {
      // Show a toast or alert
      alert("This lead is closed and cannot be moved to another stage.")
      return null
    }
    throw err  // re-throw other errors
  }
}
```

### Show a visual "Closed" badge on the lead card

```jsx
{lead.stage.name === "Closure" && (
  <span style={{
    background: "#dcfce7",
    color: "#16a34a",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 99,
    marginLeft: 8
  }}>
    CLOSED
  </span>
)}
```

---

## Key Rules

1. **Lock is name-based** — the backend checks `stage.name === "Closure"` (case-sensitive). The stage must be named exactly `Closure` in the DB.

2. **Lock applies to all roles** — BRANCH_ADMIN, MANAGER, ISE, SALES_TEAM — nobody can move a closed lead back.

3. **Lock is one-way** — a lead can still be moved **into** Closure from any other stage. It just cannot leave once there.

4. **Comments still work** — `POST /api/leads/:id/comments` is not affected. You can still add comments to a closed lead.

5. **Lead details still editable** — `PATCH /api/leads/:id` (name, mobile, date, interestedFor, assignedTo) is not affected by the closure lock. Only stage movement is blocked.

6. **Deletion still works** — `DELETE /api/leads/:id` (soft delete) is not blocked by the closure lock.
