# Pipeline Board — Filters, Search & Sort (Frontend Guide)

This document explains how to load the **Kanban pipeline board** and how every **filter** and **sort** option works on the backend.

**Endpoint (single source for the board):**

```http
GET /api/pipelines/:pipelineId
Authorization: Bearer <accessToken>
```

**Base URL:** `/api` (e.g. `GET /api/pipelines/5`)

---

## 1. What this endpoint does

1. Loads the pipeline and **all stage columns** (always every stage, in order: Prospect → middle → Closure).
2. Loads **leads** for that pipeline with filters from the **query string**.
3. Sorts leads, then puts each lead under `stages[n].leads` by its current `stageId`.
4. Returns helper data: `assignableUsers`, `filters` (what was applied), `sort`.

You do **not** need separate APIs for “filter by name”, “filter by mobile”, or “filter by interested for”. Use **one search box** → query param **`search`**.

---

## 2. Response shape (what to use in UI)

| Field | Use for |
|--------|---------|
| `data.pipeline.stages[]` | Kanban **columns** |
| `data.pipeline.stages[i].leads[]` | **Cards** in that column (already filtered) |
| `data.pipeline.leads[]` | Same leads as a **flat list** (optional) |
| `data.pipeline.assignableUsers[]` | **Assign to** dropdown (`id`, `name`, `email`, `role`) |
| `data.pipeline.filters` | Show “active filters” / debug |
| `data.pipeline.sort` | Show current sort |

**Important:** All stages are always returned. If no lead matches a filter in a column, that stage still appears with `leads: []`.

---

## 3. Unified search (`search`) — main text filter

### 3.1 Purpose

One input on the board (placeholder e.g. *“Search by name, phone, or interested in…”*) maps to **one** query parameter. The backend searches **three lead fields at once**:

| Lead field (DB) | Example value | User types | Match? |
|-----------------|---------------|------------|--------|
| `name` | `Rahul Sharma` | `rahul` | Yes (partial, any case) |
| `name` | `Anil Kumar` | `kumar` | Yes |
| `mobile` | `9876543210` | `98765` | Yes |
| `mobile` | `9876543210` | `rahul` | No (unless name also contains it) |
| `interestedFor` | `MBA` | `mba` | Yes |
| `interestedFor` | `B.Tech CSE` | `cse` | Yes |

**Rule:** A lead is included if **at least one** of the three fields contains the search text (**OR** logic).

**Match type:**

- **Partial** — substring anywhere in the field (not “starts with” only).
- **Case-insensitive** — `rahul`, `RAHUL`, `RaHuL` are the same.
- **Trimmed** — leading/trailing spaces on the param are removed; empty string = no search filter.

**Not searched:** pipeline name, stage name, assignee name, comments, email. Only **lead** `name`, `mobile`, `interestedFor`.

### 3.2 Query parameter name (use `search`)

| Param | Recommended | Notes |
|--------|---------------|--------|
| **`search`** | Yes | Preferred for new frontend code |
| `leadName` | Legacy alias | Same behavior as `search` |
| `name` | Legacy alias | Same behavior (do not confuse with `sortBy=name`) |
| `q` | Legacy alias | Same behavior |

If multiple are sent, backend uses the first available in this order:  
`search` → `leadName` → `name` → `q`.

**Do not use (removed):**

- `mobile` as its own filter param  
- `interestedFor` as its own filter param  

Always use **`search`** for the single search box.

### 3.3 How name search works (step by step)

1. User types in the search box, e.g. `anil`.
2. Frontend calls:  
   `GET /api/pipelines/5?search=anil`  
   (plus any other filters: date, assignee, etc.)
3. Backend builds a condition equivalent to:

   ```text
   lead.name contains "anil" (ignore case)
   OR lead.mobile contains "anil"
   OR lead.interestedFor contains "anil"
   ```

4. Only leads in **this pipeline** (`pipelineId = 5`) and **not deleted** are considered.
5. Other active filters (date, `stageId`, `assignedToId`) are combined with **AND** — the lead must pass search **and** those filters.
6. Matching leads appear under their **current** stage column in `stages[].leads`.

**Examples — name only:**

| Search text | Lead in DB | Result |
|-------------|------------|--------|
| `anil` | name: `Anil Kumar` | Shown |
| `ANIL` | name: `anil kumar` | Shown |
| `Kumar` | name: `Anil Kumar` | Shown |
| `xyz` | name: `Anil Kumar` | Hidden (unless mobile/interestedFor contains `xyz`) |
| `` (empty) | any | No search filter; all leads allowed by other filters |

**Examples — same box, other fields:**

| Search text | Lead | Why shown |
|-------------|------|-----------|
| `99999` | mobile: `9999912345` | Mobile match |
| `MBA` | interestedFor: `MBA Finance` | Interested-for match |
| `rahul` | name: `Priya`, mobile: `9876543210` | Hidden unless name/mobile/interested contains `rahul` |

### 3.4 `search` vs `sortBy=name` (do not mix up)

| | `search` | `sortBy=name` |
|--|----------|----------------|
| **Purpose** | **Filter** — which leads appear | **Sort** — order of leads in each column |
| **Param** | `?search=rahul` | `?sortBy=name&sortOrder=asc` |
| **Effect** | Hides non-matching leads | Does not hide leads; only changes order |
| **Name** | Finds leads whose **name field** contains text (also mobile + interestedFor) | Orders by lead **name** A→Z or Z→A |

You can use both together:

```http
GET /api/pipelines/5?search=rahul&sortBy=name&sortOrder=asc
```

→ Only leads matching `rahul` in name/mobile/interestedFor, ordered by name ascending.

### 3.5 Combining search with other filters (AND)

All filters work together. A lead must satisfy **every** active filter.

```http
GET /api/pipelines/5?search=anil&assignedToId=12&stageId=3&dateFrom=2026-05-01&dateTo=2026-05-31
```

Meaning:

- Text matches name **or** mobile **or** interestedFor (`anil`)
- **and** assigned to user `12`
- **and** currently in stage `3`
- **and** lead `date` in May 2026 range

### 3.6 Frontend implementation (search box)

**Recommended flow:**

1. Keep `search` in React state / URL query (e.g. `?search=...`).
2. On **Apply** or debounced input (300–500 ms), refetch pipeline:

   ```javascript
   const params = new URLSearchParams()
   const q = searchInput.trim()
   if (q) params.set("search", q)
   if (assignedToId) params.set("assignedToId", String(assignedToId))
   if (allDates) params.set("allDates", "1")
   else {
     if (dateFrom) params.set("dateFrom", dateFrom)
     if (dateTo) params.set("dateTo", dateTo)
   }
   if (stageId) params.set("stageId", String(stageId))
   params.set("sortBy", sortBy)
   params.set("sortOrder", sortOrder)

   const res = await fetch(`/api/pipelines/${pipelineId}?${params}`, {
     headers: { Authorization: `Bearer ${token}` }
   })
   ```

3. Read `data.pipeline.stages` and render cards from `stage.leads`.
4. Show active search from `data.pipeline.filters.search` (echo from server).

**URL encoding:** Use `encodeURIComponent` or `URLSearchParams` so spaces and special chars are safe (`search=anil%20kumar`).

**Clear search:** Remove `search` from query (or send empty) and refetch — board shows all leads allowed by date/other filters.

### 3.7 Search + default “today” date

If the user only types a name and does **not** pick dates:

```http
GET /api/pipelines/5?search=rahul
```

Backend still applies **today’s lead `date`** (UTC) unless `allDates=1` is set. So you only see **today’s** leads whose name/mobile/interestedFor matches `rahul`.

To search **all dates** with a name:

```http
GET /api/pipelines/5?search=rahul&allDates=1
```

### 3.8 What the API echoes back

```json
"filters": {
  "search": "rahul",
  "stageId": null,
  "assignedToId": null,
  "dateFrom": "2026-05-20T00:00:00.000Z",
  "dateTo": "2026-05-20T23:59:59.999Z",
  "dateDefaultedToToday": true,
  "allDates": false
}
```

- `filters.search` — exact string used after trim; `null` if no search.
- Use this to pre-fill the search input after reload.

---

## 4. Other filters (summary)

### 4.1 `stageId` (number)

Only leads **currently in** that stage. All columns still render; only that column has cards.

```http
GET /api/pipelines/5?stageId=3
```

### 4.2 `assignedToId` (number)

Only leads assigned to that user. Use `id` from `assignableUsers`, not the display name.

```http
GET /api/pipelines/5?assignedToId=14
```

**Dropdown flow:**

1. Load board once → `pipeline.assignableUsers`.
2. Show `user.name` in dropdown; value = `user.id`.
3. On select → refetch with `assignedToId=<id>`.

### 4.3 Date filters (`dateFrom`, `dateTo`, `allDates`)

Filters on the lead’s **`date`** field (appointment/lead date), not `createdAt`.

| Situation | Behavior |
|-----------|----------|
| No `dateFrom`, no `dateTo`, no `allDates` | **Today only** (UTC day) |
| `dateFrom` + `dateTo` | Range inclusive |
| Only `dateFrom` | From that date onward |
| Only `dateTo` | Up to that date |
| `allDates=1` (or `true` / `yes`) | **No** date filter |

---

## 5. Sort (`sortBy`, `sortOrder`)

Applied **after** filters, to the list of matching leads (order within each column follows this sort).

| `sortBy` | Default? | Sorts by |
|----------|----------|----------|
| `createdAt` | Yes (default) | When lead was created |
| `updatedAt` | | Last update |
| `name` | | Lead name A→Z / Z→A |
| `date` | | Lead `date` field |
| `mobile` | | Mobile string |

| `sortOrder` | Default? |
|-------------|----------|
| `desc` | Yes (default) |
| `asc` | |

```http
GET /api/pipelines/5?sortBy=name&sortOrder=asc
```

Invalid `sortBy` / `sortOrder` → `400` validation error.

---

## 6. Default request (no query params)

```http
GET /api/pipelines/5
```

| Setting | Value |
|---------|--------|
| Search | Off |
| Date | Today (UTC) |
| Stage / assignee | All |
| Sort | `createdAt` desc |
| Users list | `assignableUsers` included |

---

## 7. Full examples (copy-paste)

| Goal | Request |
|------|---------|
| Open board (today, all leads) | `GET /api/pipelines/5` |
| Search by name | `GET /api/pipelines/5?search=rahul` |
| Search by name, all dates | `GET /api/pipelines/5?search=rahul&allDates=1` |
| Search by phone fragment | `GET /api/pipelines/5?search=987654` |
| Search interested field | `GET /api/pipelines/5?search=MBA` |
| One assignee + search | `GET /api/pipelines/5?assignedToId=12&search=anil` |
| One stage + search | `GET /api/pipelines/5?stageId=2&search=priya` |
| Custom date range + search | `GET /api/pipelines/5?dateFrom=2026-05-01&dateTo=2026-05-31&search=kumar` |
| Search + sort by name A→Z | `GET /api/pipelines/5?search=rahul&sortBy=name&sortOrder=asc` |

---

## 8. Errors

| Issue | HTTP | Code |
|-------|------|------|
| Invalid `stageId` / `assignedToId` | 400 | `VALIDATION_ERROR` |
| Invalid `sortBy` / `sortOrder` | 400 | `VALIDATION_ERROR` |
| `dateFrom` after `dateTo` | 400 | `VALIDATION_ERROR` |
| Bad date string | 400 | `VALIDATION_ERROR` |
| Pipeline not found | 404 | `NOT_FOUND` |
| No permission | 403 | `PERMISSION_DENIED` |

Search text is **not** validated beyond trim; very long strings still work but keep UI reasonable.

---

## 9. Checklist for frontend

- [ ] One search input → only `search` query param (not separate mobile/interested inputs).
- [ ] Debounce or Apply before refetch.
- [ ] Use `URLSearchParams` for encoding.
- [ ] Render board from `stages[].leads`, not manual grouping.
- [ ] Assignee filter uses `assignedToId` from `assignableUsers[].id`.
- [ ] If user expects historical leads by name, add `allDates=1` or a date range.
- [ ] Distinguish UI “sort by name” (`sortBy=name`) from “find by name” (`search=...`).
- [ ] Read `filters.search` from response to sync input after navigation.

---

## 10. Related docs

- Phase 1 API overview (permissions, lead stage move logging): `docs/PHASE1_PIPELINE_STAGE_LEAD_UPDATE.md`
- Assign-to dropdown on create lead: `docs/LEAD_ASSIGN_TO_FRONTEND_GUIDE.md`
- Lead create, update, delete, stage move: `docs/LEAD_UPDATE_DELETE_FRONTEND_GUIDE.md`
