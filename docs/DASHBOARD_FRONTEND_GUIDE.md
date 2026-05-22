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

This endpoint **automatically** computes 5 dashboard metrics by reading the `leads` table.  
No ISE form submission is needed — data comes directly from lead stage movements.

Each metric counts leads whose **current stage name** matches a known stage AND whose `stageChangedAt` falls within the requested date range.

| Card Key | Label | Stage Name Matched |
|---|---|---|
| `totalCallDone` | Total Call Done | `Call Done` |
| `totalCounsellingDone` | Total Counselling Done | `Counselling Done` |
| `totalFollowUpTaken` | Total Follow Up Taken | `Follow Up` |
| `totalQualifiedLeads` | Total Qualified Leads (Hot Lead) | `Hot Lead` |
| `totalClosureDone` | Total Closure Done | `Closure` |

> **Dynamic:** If a stage doesn't exist in the DB yet, its count is `0` and `stageExists: false` — no crash, no error.

---

## Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `startDate` | `YYYY-MM-DD` | No | Start of date range. Defaults to **today** |
| `endDate` | `YYYY-MM-DD` | No | End of date range. Defaults to **today** |

- If neither is sent → today's data only.
- If only `startDate` is sent → `endDate` defaults to today.
- If only `endDate` is sent → `startDate` defaults to today.
- `startDate` cannot be after `endDate` → `400 BAD_REQUEST`.

---

## Example Requests

### Today's dashboard (default)
```
GET /api/daily-branch-reports/dashboard
Authorization: Bearer <token>
```

### Custom date range
```
GET /api/daily-branch-reports/dashboard?startDate=2026-05-01&endDate=2026-05-22
Authorization: Bearer <token>
```

### Single specific day
```
GET /api/daily-branch-reports/dashboard?startDate=2026-05-20&endDate=2026-05-20
Authorization: Bearer <token>
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
    "totalLeadsInRange": 12,
    "cards": [
      {
        "key": "totalCallDone",
        "label": "Total Call Done",
        "stageName": "Call Done",
        "stageExists": true,
        "count": 5
      },
      {
        "key": "totalCounsellingDone",
        "label": "Total Counselling Done",
        "stageName": "Counselling Done",
        "stageExists": true,
        "count": 3
      },
      {
        "key": "totalFollowUpTaken",
        "label": "Total Follow Up Taken",
        "stageName": "Follow Up",
        "stageExists": true,
        "count": 2
      },
      {
        "key": "totalQualifiedLeads",
        "label": "Total Qualified Leads (Hot Lead)",
        "stageName": "Hot Lead",
        "stageExists": true,
        "count": 1
      },
      {
        "key": "totalClosureDone",
        "label": "Total Closure Done",
        "stageName": "Closure",
        "stageExists": true,
        "count": 1
      }
    ]
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```

### When no data exists (all zeros)

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
    "totalLeadsInRange": 0,
    "cards": [
      { "key": "totalCallDone",        "label": "Total Call Done",                    "stageName": "Call Done",        "stageExists": false, "count": 0 },
      { "key": "totalCounsellingDone", "label": "Total Counselling Done",             "stageName": "Counselling Done", "stageExists": false, "count": 0 },
      { "key": "totalFollowUpTaken",   "label": "Total Follow Up Taken",              "stageName": "Follow Up",        "stageExists": false, "count": 0 },
      { "key": "totalQualifiedLeads",  "label": "Total Qualified Leads (Hot Lead)",   "stageName": "Hot Lead",         "stageExists": false, "count": 0 },
      { "key": "totalClosureDone",     "label": "Total Closure Done",                 "stageName": "Closure",          "stageExists": true,  "count": 0 }
    ]
  },
  "timestamp": "2026-05-22T10:30:00.000Z"
}
```

> `stageExists: false` means that stage hasn't been created in the system yet. Count is always `0` in that case. `stageExists: true` with `count: 0` means the stage exists but no leads moved into it in the selected range.

---

## Error Responses

### 400 — Invalid date
```json
{
  "success": false,
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "Invalid startDate. Use YYYY-MM-DD format.",
  "details": null
}
```

### 400 — startDate after endDate
```json
{
  "success": false,
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "startDate cannot be after endDate",
  "details": null
}
```

### 403 — Wrong role
```json
{
  "success": false,
  "statusCode": 403,
  "code": "ROLE_NOT_ALLOWED",
  "message": "Access denied. Required role: BRANCH_ADMIN or MANAGER",
  "details": { "required": ["BRANCH_ADMIN", "MANAGER"] }
}
```

### 401 — Not authenticated
```json
{
  "success": false,
  "statusCode": 401,
  "code": "TOKEN_EXPIRED",
  "message": "Token expired. Please login again."
}
```

---

## Frontend Implementation Guide

### React — Dynamic Dashboard Cards

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
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // Optional date range state
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate]     = useState("")

  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (startDate) params.startDate = startDate
      if (endDate)   params.endDate   = endDate

      const res = await axios.get("/api/daily-branch-reports/dashboard", {
        params,
        withCredentials: true   // if using cookie auth
      })
      setData(res.data.data)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDashboard() }, [])

  if (loading) return <p>Loading...</p>
  if (error)   return <p style={{ color: "red" }}>{error}</p>

  return (
    <div>
      {/* Date range filter */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          placeholder="Start Date"
        />
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          placeholder="End Date"
          style={{ marginLeft: 8 }}
        />
        <button onClick={fetchDashboard} style={{ marginLeft: 8 }}>
          Apply
        </button>
        <button
          onClick={() => { setStartDate(""); setEndDate(""); fetchDashboard() }}
          style={{ marginLeft: 8 }}
        >
          Reset (Today)
        </button>
      </div>

      {/* Range info */}
      <p style={{ color: "#888", fontSize: 13 }}>
        {data.range.isDefault
          ? "Showing: Today"
          : `Showing: ${data.range.startDate.slice(0, 10)} → ${data.range.endDate.slice(0, 10)}`
        }
        {" · "}Total leads in range: <strong>{data.totalLeadsInRange}</strong>
      </p>

      {/* Cards — rendered dynamically from API response */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {data.cards.map(card => (
          <div
            key={card.key}
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "20px 24px",
              minWidth: 180,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
            }}
          >
            <div style={{ fontSize: 28 }}>{CARD_ICONS[card.key]}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, marginTop: 4 }}>
              {card.count}
            </div>
            {!card.stageExists && (
              <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
                Stage not set up yet
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### Key Points for Frontend

1. **Always iterate `data.cards` array** — don't hardcode card positions. The API always returns all 5 cards in the same order.

2. **`count` is always a number** — never `null` or `undefined`. Safe to render directly.

3. **`stageExists: false`** — show a subtle warning like "Stage not configured" so admins know to create that stage in the pipeline.

4. **`isDefault: true`** in the range object means no date params were sent — you can show "Today" label instead of a date range.

5. **Date format for params** — always send `YYYY-MM-DD` (e.g. `2026-05-22`). Do not send ISO strings with time.

6. **Auto-refresh** — call this endpoint on page load and after any date filter change. No polling needed.

---

## Data Flow Summary

```
Lead created → assigned to "Prospect" stage
     ↓
ISE/Sales moves lead to "Call Done" stage  (stageChangedAt = now)
     ↓
Dashboard counts leads where stageId = "Call Done" AND stageChangedAt in range
     ↓
totalCallDone += 1
```

The dashboard reflects **where leads currently are** (their current stage) filtered by **when they moved there** (stageChangedAt). This means:
- If a lead moves from "Call Done" → "Counselling Done", it leaves the Call Done count and enters Counselling Done count.
- Counts represent the current pipeline state within the date window, not cumulative history.
