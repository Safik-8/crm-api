# Dashboard API — Frontend Integration Guide

## Endpoint

```
GET /api/daily-branch-reports/dashboard
```

---

## Authentication & Authorization

| Requirement | Value |
|---|---|
| Auth header | `Authorization: Bearer <accessToken>` (or cookie) |
| Allowed roles | `BRANCH_ADMIN`, `MANAGER` |

Any other role gets `403 ROLE_NOT_ALLOWED`.

---

## How It Works

Automatically computes 5 dashboard metrics from the `leads` table — no ISE form needed.

Each card counts leads whose **current stage** matches a known stage name AND whose `stageChangedAt`
falls within the requested date range.

| Card Key | Label | Stage Name |
|---|---|---|
| `totalCallDone` | Total Call Done | `Call Done` |
| `totalCounsellingDone` | Total Counselling Done | `Counselling Done` |
| `totalFollowUpTaken` | Total Follow Up Taken | `Follow Up` |
| `totalQualifiedLeads` | Total Qualified Leads (Hot Lead) | `Hot Lead` |
| `totalClosureDone` | Total Closure Done | `Closure` |

Each card also returns a `userBreakdown` array — every user who moved leads into that stage,
their individual count, and full details of every lead they moved (from stage, to stage, when moved, assigned to, etc.).

> If a stage doesn't exist in DB yet: `count = 0`, `stageExists = false`, `userBreakdown = []`.

---

## Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `startDate` | `YYYY-MM-DD` | No | Defaults to today |
| `endDate` | `YYYY-MM-DD` | No | Defaults to today |

`startDate` cannot be after `endDate` → `400 BAD_REQUEST`.

---

## Example Requests

```
GET /api/daily-branch-reports/dashboard
GET /api/daily-branch-reports/dashboard?startDate=2026-05-01&endDate=2026-05-22
GET /api/daily-branch-reports/dashboard?startDate=2026-05-20&endDate=2026-05-20
```

---

## Success Response `200`

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dashboard data fetched successfully",
  "data": {
    "range": {
      "startDate": "2026-05-22T00:00:00.000Z",
      "endDate": "2026-05-22T23:59:59.999Z",
      "isDefault": true
    },
    "branchId": 3,
    "totalLeadsInRange": 3,
    "cards": [
      {
        "key": "totalCallDone",
        "label": "Total Call Done",
        "stageName": "Call Done",
        "stageExists": true,
        "count": 2,
        "userBreakdown": [
          {
            "user": { "id": 5, "name": "Ravi Kumar", "email": "ravi@example.com" },
            "count": 2,
            "leads": [
              {
                "id": 101,
                "name": "Amit Shah",
                "mobile": "9876543210",
                "interestedFor": "MBA",
                "date": "2026-05-20T00:00:00.000Z",
                "movedAt": "2026-05-22T09:15:00.000Z",
                "fromStage": { "id": 1, "name": "Prospect" },
                "toStage":   { "id": 3, "name": "Call Done" },
                "pipeline":  { "id": 2, "name": "Main Pipeline" },
                "assignedTo": { "id": 5, "name": "Ravi Kumar", "email": "ravi@example.com" }
              },
              {
                "id": 102,
                "name": "Priya Mehta",
                "mobile": "9123456780",
                "interestedFor": "BBA",
                "date": "2026-05-21T00:00:00.000Z",
                "movedAt": "2026-05-22T10:30:00.000Z",
                "fromStage": { "id": 1, "name": "Prospect" },
                "toStage":   { "id": 3, "name": "Call Done" },
                "pipeline":  { "id": 2, "name": "Main Pipeline" },
                "assignedTo": null
              }
            ]
          }
        ]
      },
      {
        "key": "totalCounsellingDone",
        "label": "Total Counselling Done",
        "stageName": "Counselling Done",
        "stageExists": true,
        "count": 1,
        "userBreakdown": [
          {
            "user": { "id": 6, "name": "Sneha Patel", "email": "sneha@example.com" },
            "count": 1,
            "leads": [
              {
                "id": 98,
                "name": "Karan Joshi",
                "mobile": "9988776655",
                "interestedFor": "Engineering",
                "date": "2026-05-18T00:00:00.000Z",
                "movedAt": "2026-05-22T11:00:00.000Z",
                "fromStage": { "id": 3, "name": "Call Done" },
                "toStage":   { "id": 4, "name": "Counselling Done" },
                "pipeline":  { "id": 2, "name": "Main Pipeline" },
                "assignedTo": { "id": 6, "name": "Sneha Patel", "email": "sneha@example.com" }
              }
            ]
          }
        ]
      },
      {
        "key": "totalFollowUpTaken",
        "label": "Total Follow Up Taken",
        "stageName": "Follow Up",
        "stageExists": true,
        "count": 0,
        "userBreakdown": []
      },
      {
        "key": "totalQualifiedLeads",
        "label": "Total Qualified Leads (Hot Lead)",
        "stageName": "Hot Lead",
        "stageExists": false,
        "count": 0,
        "userBreakdown": []
      },
      {
        "key": "totalClosureDone",
        "label": "Total Closure Done",
        "stageName": "Closure",
        "stageExists": true,
        "count": 0,
        "userBreakdown": []
      }
    ]
  },
  "timestamp": "2026-05-22T11:30:00.000Z"
}
```

---

## Response Field Reference

### Top-level `data`

| Field | Type | Description |
|---|---|---|
| `range.startDate` | ISO string | Start of queried range |
| `range.endDate` | ISO string | End of queried range |
| `range.isDefault` | boolean | `true` when no date params sent (today) |
| `branchId` | number | Branch this dashboard is scoped to |
| `totalLeadsInRange` | number | Sum of all card counts |
| `cards` | array | Always 5 items, always same order |

### Each `card`

| Field | Type | Description |
|---|---|---|
| `key` | string | e.g. `totalCallDone` |
| `label` | string | Human-readable display label |
| `stageName` | string | Stage name this card tracks |
| `stageExists` | boolean | `false` if stage not yet created in DB |
| `count` | number | Total leads in this stage for the range. Never null |
| `userBreakdown` | array | Per-user breakdown sorted by count DESC |

### Each `userBreakdown` entry

| Field | Type | Description |
|---|---|---|
| `user` | `{ id, name, email }` \| `null` | Who moved the leads. `null` if no mover recorded |
| `count` | number | How many leads this user moved into this stage |
| `leads` | array | Full details of each lead, sorted by `movedAt` DESC |

### Each `lead` inside `userBreakdown`

| Field | Type | Description |
|---|---|---|
| `id` | number | Lead ID |
| `name` | string | Lead name |
| `mobile` | string | Lead phone number |
| `interestedFor` | string \| null | What the lead is interested in |
| `date` | ISO string | Lead enquiry date |
| `movedAt` | ISO string | When lead was moved into this stage |
| `fromStage` | `{ id, name }` \| null | Previous stage. `null` if created directly here |
| `toStage` | `{ id, name }` | Current stage |
| `pipeline` | `{ id, name }` | Pipeline this lead belongs to |
| `assignedTo` | `{ id, name, email }` \| null | Who the lead is assigned to (may differ from mover) |

---

## Error Responses

### 400 — Invalid date
```json
{ "success": false, "statusCode": 400, "code": "BAD_REQUEST", "message": "Invalid startDate. Use YYYY-MM-DD format.", "details": null }
```

### 400 — startDate after endDate
```json
{ "success": false, "statusCode": 400, "code": "BAD_REQUEST", "message": "startDate cannot be after endDate", "details": null }
```

### 403 — Wrong role
```json
{ "success": false, "statusCode": 403, "code": "ROLE_NOT_ALLOWED", "message": "Access denied. Required role: BRANCH_ADMIN or MANAGER", "details": { "required": ["BRANCH_ADMIN", "MANAGER"] } }
```

### 401 — Not authenticated
```json
{ "success": false, "statusCode": 401, "code": "TOKEN_EXPIRED", "message": "Token expired. Please login again." }
```

---

## React Implementation

```jsx
import { useEffect, useState } from "react"
import axios from "axios"

const CARD_ICONS = {
  totalCallDone:        "📞",
  totalCounsellingDone: "🗣️",
  totalFollowUpTaken:   "🔁",
  totalQualifiedLeads:  "🔥",
  totalClosureDone:     "✅",
}

export default function Dashboard() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate]     = useState("")
  const [expanded, setExpanded]   = useState({})

  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (startDate) params.startDate = startDate
      if (endDate)   params.endDate   = endDate
      const res = await axios.get("/api/daily-branch-reports/dashboard", { params, withCredentials: true })
      setData(res.data.data)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDashboard() }, [])

  const toggle = (key) => setExpanded(p => ({ ...p, [key]: !p[key] }))

  if (loading) return <p>Loading...</p>
  if (error)   return <p style={{ color: "red" }}>{error}</p>

  return (
    <div>
      {/* Date filter */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <span>to</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <button onClick={fetchDashboard}>Apply</button>
        <button onClick={() => { setStartDate(""); setEndDate(""); fetchDashboard() }}>Today</button>
      </div>

      <p style={{ color: "#6b7280", fontSize: 13 }}>
        {data.range.isDefault ? "Today" : `${data.range.startDate.slice(0,10)} → ${data.range.endDate.slice(0,10)}`}
        {" · "}<strong>{data.totalLeadsInRange}</strong> total leads
      </p>

      {/* Cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {data.cards.map(card => (
          <div key={card.key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, minWidth: 260, background: "#fff" }}>

            <div style={{ fontSize: 28 }}>{CARD_ICONS[card.key]}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>{card.label}</div>
            <div style={{ fontSize: 36, fontWeight: 700 }}>{card.count}</div>

            {!card.stageExists && (
              <div style={{ fontSize: 11, color: "#f59e0b" }}>Stage not set up yet</div>
            )}

            {card.count > 0 && (
              <button onClick={() => toggle(card.key)} style={{ marginTop: 10, fontSize: 12, cursor: "pointer" }}>
                {expanded[card.key] ? "Hide details ▲" : "View by user ▼"}
              </button>
            )}

            {/* Per-user breakdown */}
            {expanded[card.key] && card.userBreakdown.map((entry, i) => (
              <div key={i} style={{ marginTop: 14, borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {entry.user ? entry.user.name : "Unknown"}
                  <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 6 }}>
                    — {entry.count} lead{entry.count !== 1 ? "s" : ""}
                  </span>
                </div>
                {entry.user && <div style={{ fontSize: 12, color: "#9ca3af" }}>{entry.user.email}</div>}

                <table style={{ width: "100%", marginTop: 8, fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                      <th style={{ padding: "4px 8px" }}>Lead</th>
                      <th style={{ padding: "4px 8px" }}>Mobile</th>
                      <th style={{ padding: "4px 8px" }}>From Stage</th>
                      <th style={{ padding: "4px 8px" }}>Moved At</th>
                      <th style={{ padding: "4px 8px" }}>Assigned To</th>
                      <th style={{ padding: "4px 8px" }}>Interested For</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.leads.map(lead => (
                      <tr key={lead.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "4px 8px" }}>{lead.name}</td>
                        <td style={{ padding: "4px 8px" }}>{lead.mobile}</td>
                        <td style={{ padding: "4px 8px" }}>{lead.fromStage?.name ?? "—"}</td>
                        <td style={{ padding: "4px 8px" }}>{new Date(lead.movedAt).toLocaleString()}</td>
                        <td style={{ padding: "4px 8px" }}>{lead.assignedTo?.name ?? "—"}</td>
                        <td style={{ padding: "4px 8px" }}>{lead.interestedFor ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Key Points

1. **Always iterate `data.cards`** — 5 cards, always same order, never hardcode positions.
2. **`count` is always a number** — never null, safe to render directly.
3. **`userBreakdown` sorted by count DESC** — top performer is always first.
4. **`user` can be `null`** — lead was created directly into this stage with no mover. Show "Unknown".
5. **`fromStage` can be `null`** — lead was created directly into this stage. Show "—".
6. **`user` (mover) ≠ `assignedTo`** — mover is who clicked the stage change; assignedTo is who owns the lead.
7. **`stageExists: false`** — stage not created yet, count always 0.
8. **`isDefault: true`** — no date params sent, show "Today" label.
9. **Date params** — always `YYYY-MM-DD`, never ISO strings with time.

---

## Data Flow

```
ISE/Sales moves lead → "Call Done"
  lead.stageChangedAt   = now
  lead.stageChangedById = mover's user id
  lead.previousStageId  = old stage id

Dashboard query:
  leads WHERE stageId = "Call Done"
         AND stageChangedAt BETWEEN start AND end
         AND pipeline.branchId = user's branch

Group by stageChangedById → userBreakdown (sorted DESC by count)
```
