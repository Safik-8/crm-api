# Prospect & lead sources — API guide for frontend

Reference: `src/modules/prospect/*`, `src/modules/leadsources/*`.

---

## Authentication

- Every route requires a **logged-in user** (`authenticate` middleware).
- Send **`Authorization: Bearer <accessToken>`** (or whatever your app already uses for other `/api/*` calls).
- Permissions live on the JWT / session user as `permissions.PROSPECT` with boolean flags: **`canView`**, **`canCreate`**, **`canEdit`**, **`canDelete`**.
- The backend does **not** check role names like `"ISE"` on these routes — it checks those **PROSPECT** flags. Which **role** gets which flags is decided in your admin/seed (`RolePermission`).

---

## Response shape (success)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human-readable message",
  "data": {},
  "timestamp": "2026-04-14T12:00:00.000Z"
}
```

- **Create prospect** returns **`statusCode: 201`** with the same envelope.
- **`data`** is the payload described per endpoint below.

## Errors (operational)

Failures return JSON with `success: false`, `statusCode`, `code` (e.g. `VALIDATION_ERROR`, `PERMISSION_DENIED`, `NOT_FOUND`), `message`, optional `details`, and `timestamp`. See `API_DOCUMENTATION.md` for full examples.

---

## Permission → which endpoints you can call

| `permissions.PROSPECT` flag | Endpoints (under `/api/prospects`) |
|----------------------------|-----------|
| **`canView`** | `GET /all`, `GET /:id` |
| **`canCreate`** | `POST /` (create) |
| **`canEdit`** | `PUT /:id` (patch fields), `POST /:id/stage` (change stage) |

**Lead sources:** use **`GET /api/lead-sources`** (auth only). See **[Lead sources API](#lead-sources-api)** for the shared `/api/lead-sources` routes.

If the user lacks the `PROSPECT` flag, the API responds with **`403`** and `code: "PERMISSION_DENIED"`, `details.required` like `"PROSPECT:canView"`.

---

## Who sees which prospects? (list & get by id)

List (`GET /all`) and get-by-id (`GET /:id`) apply a **scope filter** from the logged-in user’s **company**, **branch**, and **PROSPECT** flags. Super admin is a special case.

| Situation | Effect on queries |
|-----------|-------------------|
| User has **no `companyId`** (e.g. super admin) | **No scope filter** — can access prospects across all companies (subject to still having `PROSPECT.canView`). |
| User has **`companyId`** but **no `branchId`** | Prospects in that **company** (any branch), unless other filters apply. |
| User has **`canDelete`** on `PROSPECT` | Same **company + branch** as the user. |
| User has **`canCreate`** but **not** `canDelete` | Same company + branch, and only prospects **`assignedToId` = current user id** (typical “owns my leads”). |
| User has **`canView`** (and not the above) | Same company + branch, and **`assignedToId` in “team”** (same-branch users). |
| User has **no** `PROSPECT` permission object | **`403`** — “You do not have access to prospects”. |

**Frontend takeaway:** the same URL returns **different rows** for different users; do not assume “list all prospects in the company” unless the user’s flags match that behavior.

---

## Lead sources API

HTTP base path: **`/api/lead-sources`**. Routes: `src/modules/leadsources/leadSource.routes.js`.

| What | Detail |
|------|--------|
| **Auth** | Every route uses **`authenticate`** — send the same **`Authorization: Bearer <token>`** as for prospects. |
| **Roles** | **`GET /`** and **`GET /:id`**: any authenticated user. **`POST /`**, **`PUT /:id`**: **`authorize("SUPER_ADMIN", "BRANCH_ADMIN")`** — others get **`403 ROLE_NOT_ALLOWED`**. |

### Scope rules (read/update/delete one record)

`assertLeadSourceScope` runs on **get by id** and **update**:

| Lead source | User |
|-------------|------|
| **Global** (`companyId` is `null`) | Only accounts **without** a tenant `companyId` on the user (e.g. **super admin**) may **fetch by id / update**. Tenant users (with `companyId`) are **blocked** from opening global lead source records (they’ll get **`403`**). |
| **Company-scoped** | User’s **`companyId`** must match the lead source’s **`companyId`**, or **`403`** (“You cannot access lead sources from another company”). Super admin (no `companyId`) can access any company’s source for these operations. |

**Note:** **`GET /api/lead-sources`** (list) builds a **filter** so tenant users see **global + their company** sources. Use the list for dropdowns; use **GET `/:id`** only when the user is allowed to open that record’s detail.

---

### `GET /api/lead-sources`

| | |
|--|--|
| **Purpose** | List lead sources for dropdowns (create/edit prospect, settings UI). |
| **Auth** | Required. **No** `PROSPECT` permission. |
| **Query** | `search` — optional, substring on **name** (case-insensitive). `isActive` — optional string **`"true"`** / **`"false"`** to filter by flag. |
| **Filter** | Tenant users: **`OR` [ global (`companyId` null), own `companyId` ]**. Super admin (`user.companyId` null): all companies’ sources. |
| **Success `data`** | **Array** of `{ "id", "name" }` — the controller puts the array directly in **`data`** (not wrapped as `{ "leadSources": [...] }`). |

**Example**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lead sources fetched",
  "data": [
    { "id": 1, "name": "Instagram" },
    { "id": 2, "name": "Referral" }
  ],
  "timestamp": "2026-04-14T12:00:00.000Z"
}
```

---

### `POST /api/lead-sources`

| | |
|--|--|
| **Purpose** | Create a company or global lead source. |
| **Auth + role** | **`SUPER_ADMIN`** or **`BRANCH_ADMIN`**. |
| **Request body** | `{ "name": "WhatsApp", "isGlobal": false }` |
| **Fields** | **`name`** — required, non-empty string. **`isGlobal`** — optional, default **`false`**. Only **super admin** (`user.companyId` absent) may set **`isGlobal: true`** (creates a **global** row, `companyId: null`). If a tenant user sends **`isGlobal: true`** → **403**. |
| **Duplicate** | Same **name** (case-insensitive) in the same scope (**`companyId`** for tenant, **`null`** for global) → **409 CONFLICT**, `details.field` **`"name"`**. |
| **Success** | **201**, `data`: `{ "leadSource": { … } }` (includes `company` when company-scoped). |

---

### `PUT /api/lead-sources/:id`

| | |
|--|--|
| **Purpose** | Rename and/or toggle **`isActive`**. |
| **Auth + role** | **`SUPER_ADMIN`** or **`BRANCH_ADMIN`**. |
| **Request body** | Partial JSON, e.g. `{ "name": "Facebook Ads", "isActive": true }` — both fields optional. |
| **Scope** | Same as **GET `/:id`**. |
| **Duplicate name** | If **`name`** changes, same uniqueness rules as POST → **409** if clash. |
| **Success** | **200**, `data`: `{ "leadSource": { …, "type" } }`. |

---

## Prospects — endpoints

Base path: **`/api/prospects`** (prefix `/api` may already be configured in your environment).

### 1. `POST /api/prospects`

| | |
|--|--|
| **Purpose** | Create a prospect and initial stage history (`NEW`). |
| **Permission** | `PROSPECT.canCreate` |
| **Request** | JSON body, **`Content-Type: application/json`**. |

**Body fields**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | |
| `mobile` | Yes | Duplicate detection is **per company** (resolved company below). |
| `leadSourceId` | Yes | Must be **active**; **global** or allowed for that company (same rules as lead source list endpoints). |
| `assignedToId` | No | Defaults to **current user**. If set, user must belong to **resolved `companyId`**. |
| `email`, `education`, `college`, `city` | No | |
| `expectedRevenue` | No | |
| `duplicate_acknowledged` | No | Default `false`. If mobile duplicates in company, API returns **409** unless user confirms and sends `true`. |

**Where `companyId` / `branchId` on the new row come from (important for UI)**

| Logged-in user | What the frontend must send |
|----------------|------------------------------|
| Has **`companyId` + `branchId`** | Do **not** rely on body for tenant: server uses **`req.user`**. Body `companyId` / `branchId` are **ignored** (anti-spoofing). |
| Has **`companyId`**, **no `branchId`** (company-level account) | Must send **`branchId`** — must belong to that company. |
| **No `companyId`** (e.g. super admin) | Must send **`companyId`** and **`branchId`** — branch must belong to that company. |

**Success** | **`statusCode` 201**, `data` = full prospect object (includes `company`, `branch`, `leadSource`, `assignedTo`, `createdBy` per backend include). |

---

### 2. `GET /api/prospects/all`

| | |
|--|--|
| **Purpose** | Paginated list with filters. |
| **Permission** | `PROSPECT.canView` |
| **Request** | Query string only. No body. |

**Query parameters** (all optional unless your UX requires them)

| Param | Description |
|-------|-------------|
| `page`, `limit` | Pagination |
| `stage` | Filter by `currentStage` |
| `lead_source_id` | Filter by lead source id |
| `branch_id` | Filter to a branch; **blocked** if user is branch-scoped and tries another branch |
| `assigned_to` | Filter by assignee user id |
| `start_date`, `end_date` | Filter `createdAt` range |
| `search` | Search **name** (case-insensitive) and **mobile** |

**Success `data`**

```json
{
  "prospects": [
    {
      "id": 1,
      "prospectCode": "STD-MAIN-0001",
      "name": "…",
      "mobile": "…",
      "leadSourceName": "…",
      "currentStage": "NEW",
      "assignedToName": "…",
      "companyName": "…",
      "branchName": "…",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

Field names match the **formatted** list from the service (not always 1:1 with raw Prisma model names).

---

### 3. `GET /api/prospects/:id`

| | |
|--|--|
| **Purpose** | Single prospect with relations and **full stage history**. |
| **Permission** | `PROSPECT.canView` |
| **Request** | Path param **`id`**. No body. |
| **Success `data`** | `{ "prospect": { …, "stageHistory": [ … ] } }` |

If the id is outside the user’s **scope** (see table above), the API returns **404** (`Prospect not found`) — not 403.

---

### 4. `PUT /api/prospects/:id`

| | |
|--|--|
| **Purpose** | Partial update of editable fields. **Does not** change pipeline stage — use **stage** endpoint. |
| **Permission** | `PROSPECT.canEdit` |
| **Request** | Path **`id`** + JSON body. |

**Ignored / stripped server-side** (even if the client sends them)

- `prospectCode`, `currentStage`, `companyId`, `branchId`, `createdById`

**Typical body fields** (send only what changes)

- `name`, `mobile`, `email`, `education`, `college`, `city`
- `leadSourceId`, `assignedToId`
- `expectedRevenue`, `tokenAmount`, `joiningDate`, `winDate`, `duplicateAcknowledged`, `lastActivityAt`, etc. (whatever your product exposes)

**Business rules**

- **`leadSourceId`** / **`assignedToId`** are validated against the **prospect’s company** (not the actor’s). So **super admin** can assign users in the **same company as that prospect**.
- If the user has **`canCreate`** but **not** `canDelete` on `PROSPECT`, they may only update prospects **assigned to themselves** → otherwise **403**.

**Success `data`** | `{ "prospect": { … } }` with `company`, `branch`, `leadSource`, `assignedTo`. |

---

### 5. `POST /api/prospects/:id/stage`

| | |
|--|--|
| **Purpose** | Change **`currentStage`** and append one **stage history** row. |
| **Permission** | `PROSPECT.canEdit` |
| **Request** | Path **`id`** + JSON body. |

**Body**

| Field | Required | Description |
|-------|----------|-------------|
| `new_stage` | Yes | One of: `NEW`, `ENGAGED`, `STRATEGY_SCHEDULED`, `STRATEGY_COMPLETED`, `TOKEN_DISCUSSION`, `TOKEN_RECEIVED`, `WIN`, `ARCHIVED` |
| `note` | No | Stored on history |
| `manager_approval_id` | When leaving **`ARCHIVED`** | User id of approver in **prospect’s company** with **`PROSPECT.canDelete`** |

**Allowed transitions (high level)** — full rules: `src/modules/prospect/stageMachine.js`

- Linear-ish path toward **`WIN`**, with **`ARCHIVED`** as side exit from most stages.
- **`WIN`** is terminal in the machine (`WIN` → no next in map).
- **`ARCHIVED` → something else** is handled in code with **`manager_approval_id`** (not only the `ALLOWED_TRANSITIONS` map).

**WIN**

- Before calling stage to **`WIN`**, ensure prospect has **`tokenAmount` > 0** and **`joiningDate`** set (usually via **PUT**), or API returns **400** **`BAD_REQUEST`** with message **`Stage transition not allowed.`** (same message as an invalid transition).

**Success `data`** (shape is a summary, not full prospect)

```json
{
  "id": 1,
  "prospectCode": "STD-MAIN-0001",
  "oldStage": "NEW",
  "newStage": "ENGAGED",
  "changedAt": "2026-04-14T12:00:00.000Z",
  "changedBy": { "id": 5, "name": "Agent" }
}
```

---

## Frontend checklist

1. **Lead source dropdown:** use **`GET /api/lead-sources`** (any logged-in user; **`data`** is a plain array of `{ id, name }`). Admin create/edit uses **`POST`/`PUT /api/lead-sources`** with **SUPER_ADMIN** or **BRANCH_ADMIN**.
2. **Naming:** request/response use **camelCase** for Prisma-backed fields (`leadSourceId`, `assignedToId`, …). Create prospect body still uses **`duplicate_acknowledged`** (snake_case) as implemented.
3. **Super admin create prospect:** show **company + branch pickers** and send `companyId` + `branchId` in the create body.
4. **403 `PERMISSION_DENIED`:** user missing `PROSPECT` `canView` / `canCreate` / `canEdit` — hide prospect routes or show upgrade message.
5. **List scope:** same **`GET /api/prospects/all`** returns different data per user; align filters and empty states with that.
6. **Stage vs fields:** stage changes only via **`POST /api/prospects/:id/stage`**; field edits via **`PUT /api/prospects/:id`**.

---

## Related files in this repo

| File | Role |
|------|------|
| `src/modules/prospect/prospect.routes.js` | HTTP paths + `hasPermission` |
| `src/modules/prospect/prospect.controller.js` | Maps `req` → service |
| `src/modules/prospect/prospect.service.js` | Scope, validation, Prisma |
| `src/modules/prospect/stageMachine.js` | Stages + allowed transitions |
| `src/modules/leadsources/leadSource.routes.js` | `GET/POST/PUT/DELETE /api/lead-sources` |
| `src/modules/leadsources/leadSource.service.js` | List scope, create/update |
