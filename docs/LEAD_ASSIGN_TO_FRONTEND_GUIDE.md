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

---

---

# Lead — Bulk Import from Excel: Frontend Integration Guide

This section covers the **Import Leads from Excel** feature. It lets users upload an `.xlsx` / `.xls` file containing multiple leads and have them all created in one shot, instead of adding them one by one.

---

## Overview

- A single `POST` endpoint accepts a **multipart/form-data** request with the Excel file and a `pipelineId`.
- The backend reads every row, validates it, and creates leads that pass validation.
- Rows that fail validation are **not** inserted — they are returned in the response so the frontend can show the user exactly which rows failed and why.
- All successfully imported leads are placed in the **Prospect** stage of the given pipeline (same as single lead creation).

---

## Endpoint

### POST `/api/leads/import-excel`

Upload an Excel file to bulk-create leads.

#### Request

```http
POST /api/leads/import-excel
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

| Form Field   | Type     | Required | Description |
|--------------|----------|----------|-------------|
| `file`       | File     | ✅ Yes   | The Excel file (`.xlsx` or `.xls`). Max size **5 MB**. |
| `pipelineId` | `number` | ✅ Yes   | ID of the pipeline to import leads into. |

> **Important:** The field name for the file **must** be `file` exactly. Any other name will be ignored and the API will return a 400 error.

---

## Excel File Format

The first row of the sheet must be a **header row**. The backend matches headers case-insensitively, so `Name`, `NAME`, and `name` all work.

| Column Header    | Required | Accepted Variations | Description |
|------------------|----------|---------------------|-------------|
| `Name`           | ✅ Yes   | `Name` | Full name of the lead |
| `Phone Number`   | ✅ Yes   | `Phone Number`, `Phone`, `Mobile`, `PhoneNumber` | Contact number |
| `Date`           | ✅ Yes   | `Date` | Lead date — any standard date format Excel supports |
| `Interested At`  | ❌ No    | `Interested At`, `Interested For`, `InterestedAt`, `Interested_At` | What the lead is interested in |
| `Assign To`      | ❌ No    | `Assign To`, `Assigned To`, `AssignTo`, `AssignedTo` | Name of the branch user to assign the lead to (must exactly match the user's name in the system) |

### Sample Excel Layout

| Name | Phone Number | Date | Interested At | Assign To |
|------|-------------|------|---------------|-----------|
| Rahul Verma | 9876543210 | 15-05-2026 | MBA | Arjun Mehta |
| Priya Nair | 9123456780 | 2026-05-16 | BBA | |
| Amit Shah | 9000000001 | 16/05/2026 | | Riya Shah |

- The **Interested At** and **Assign To** columns are optional — leave them blank if not needed.
- If **Assign To** is filled, the name must **exactly match** (case-insensitive) an active user's name in the same branch. If no match is found, that row is skipped and reported in `failed`.
- Date formats like `DD-MM-YYYY`, `YYYY-MM-DD`, `DD/MM/YYYY`, and native Excel date cells are all handled.

---

## Success Response `200`

```json
{
  "success": true,
  "message": "Import complete. 3 lead(s) created, 1 skipped.",
  "data": {
    "total": 4,
    "created": 3,
    "skipped": 1,
    "succeeded": [
      { "row": 2, "leadId": 101, "name": "Rahul Verma",  "mobile": "9876543210" },
      { "row": 3, "leadId": 102, "name": "Priya Nair",   "mobile": "9123456780" },
      { "row": 4, "leadId": 103, "name": "Amit Shah",    "mobile": "9000000001" }
    ],
    "failed": [
      {
        "row": 5,
        "data": { "name": "", "mobile": "9111111111" },
        "errors": ["name is empty"]
      }
    ]
  }
}
```

### Response Fields Explained

| Field        | Type     | Description |
|--------------|----------|-------------|
| `total`      | `number` | Total rows read from the Excel file (excluding header) |
| `created`    | `number` | Number of leads successfully created |
| `skipped`    | `number` | Number of rows that failed and were not inserted |
| `succeeded`  | `array`  | Details of each successfully created lead — row number, new lead ID, name, mobile |
| `failed`     | `array`  | Details of each failed row — row number, the raw data, and list of error messages |

The `row` number in both arrays corresponds to the **actual Excel row number** (row 2 = first data row, since row 1 is the header). This makes it easy to tell the user exactly which row in their file had a problem.

---

## Error Responses

These are errors for the whole request (not row-level failures):

| Status | Reason |
|--------|--------|
| `400`  | No file uploaded |
| `400`  | File is not a valid Excel file |
| `400`  | Excel file is empty (no data rows) |
| `400`  | Required column missing (e.g. no "Name" column found) |
| `400`  | `pipelineId` missing or invalid |
| `404`  | Pipeline not found or deleted |
| `401`  | Missing or invalid token |
| `403`  | No `LEAD canCreate` permission |

---

## Frontend Integration Flow

### Step 1 — Build the UI

You need:
1. A **pipeline selector** (dropdown) — the user picks which pipeline to import into.
2. A **file input** — accepts `.xlsx` and `.xls` only.
3. An **Import button**.
4. A **results section** — shown after the response, displaying success count and any failed rows.

```jsx
<input
  type="file"
  accept=".xlsx,.xls"
  onChange={(e) => setFile(e.target.files[0])}
/>

<select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}>
  {pipelines.map((p) => (
    <option key={p.id} value={p.id}>{p.name}</option>
  ))}
</select>

<button onClick={handleImport}>Import Leads</button>
```

---

### Step 2 — Send the Request

Use `FormData` — **do not** set `Content-Type` manually. The browser sets it automatically with the correct boundary for multipart uploads.

```js
const handleImport = async () => {
  if (!file) return alert("Please select an Excel file")
  if (!pipelineId) return alert("Please select a pipeline")

  const formData = new FormData()
  formData.append("file", file)           // field name must be "file"
  formData.append("pipelineId", pipelineId)

  try {
    const res = await fetch("/api/leads/import-excel", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
        // ⚠️ Do NOT set Content-Type here — let the browser handle it
      },
      body: formData
    })

    const json = await res.json()

    if (!res.ok) {
      // Whole-request error (bad file, missing pipeline, etc.)
      alert(json.message || "Import failed")
      return
    }

    setImportResult(json.data)  // { total, created, skipped, succeeded, failed }
  } catch (err) {
    console.error("Import error:", err)
    alert("Something went wrong. Please try again.")
  }
}
```

---

### Step 3 — Display the Results

After a successful response, show a summary and the failed rows so the user knows what to fix.

```jsx
{importResult && (
  <div className="import-result">
    <p>
      ✅ <strong>{importResult.created}</strong> leads imported &nbsp;|&nbsp;
      ❌ <strong>{importResult.skipped}</strong> rows skipped
      &nbsp;(out of {importResult.total} total)
    </p>

    {importResult.failed.length > 0 && (
      <>
        <h4>Failed Rows — please fix and re-upload</h4>
        <table>
          <thead>
            <tr>
              <th>Excel Row</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {importResult.failed.map((f) => (
              <tr key={f.row}>
                <td>{f.row}</td>
                <td>{f.data.name || "—"}</td>
                <td>{f.data.mobile || "—"}</td>
                <td>{f.errors.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )}
  </div>
)}
```

---

### Step 4 — Provide a Template Download (Recommended)

Give users a downloadable sample Excel file so they know the exact column format. Host a static file or generate it on the fly:

```jsx
<a href="/templates/leads_import_template.xlsx" download>
  Download Sample Template
</a>
```

The template should have these headers in row 1:

```
Name | Phone Number | Date | Interested At | Assign To
```

With one or two example rows filled in so the user understands the expected format.

---

## Common Mistakes & How to Handle Them

| Mistake | What Happens | How to Guide the User |
|---|---|---|
| Wrong field name for file (e.g. `excel` instead of `file`) | API returns 400 "No file uploaded" | Always use `formData.append("file", ...)` |
| Setting `Content-Type: application/json` manually | Multipart boundary is lost, upload fails | Never set `Content-Type` manually for FormData requests |
| `Assign To` name doesn't match any branch user | That row is skipped, appears in `failed` | Show the failed row with the error message; user should fix the name in the file |
| Date in an unrecognised format | That row is skipped with "invalid date format" | Recommend using `YYYY-MM-DD` or native Excel date cells |
| File larger than 5 MB | API returns 400 | Show a client-side size check before uploading |
| Uploading a CSV instead of Excel | API returns 400 "Only Excel files allowed" | Restrict the file input to `.xlsx,.xls` and show a clear error |

---

## Client-Side File Validation (Before Upload)

Add these checks before calling the API to give instant feedback:

```js
const validateFile = (file) => {
  if (!file) return "Please select a file"

  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel"
  ]
  const ext = file.name.split(".").pop().toLowerCase()

  if (!allowedTypes.includes(file.type) && ext !== "xlsx" && ext !== "xls") {
    return "Only .xlsx or .xls files are allowed"
  }

  if (file.size > 5 * 1024 * 1024) {
    return "File size must be under 5 MB"
  }

  return null // no error
}

// Usage
const error = validateFile(file)
if (error) return alert(error)
```

---

## Permissions Required

| Action | Permission Needed |
|--------|-------------------|
| Import leads from Excel | `LEAD` → `canCreate` |

Same permission as creating a single lead — no extra setup needed.

---

## Full Flow Summary

```
User selects pipeline
       ↓
User picks Excel file (.xlsx / .xls)
       ↓
Frontend validates file size & type (client-side)
       ↓
POST /api/leads/import-excel  (FormData: file + pipelineId)
       ↓
Backend parses Excel → validates each row → inserts valid rows
       ↓
Response: { total, created, skipped, succeeded[], failed[] }
       ↓
Frontend shows summary + table of failed rows (if any)
       ↓
User fixes failed rows in Excel and re-uploads if needed
```

---

---

# Excel Import — Validation Rules (Updated)

This section documents all validation rules enforced by the backend on the uploaded Excel file. Every error is returned to the frontend with a clear message so the user knows exactly what to fix.

---

## File-Level Validation

These checks run before any row is processed. If any of these fail, the **entire upload is rejected** with a `400` response — no rows are inserted.

| Check | Error Message Returned |
|---|---|
| No file sent | `"No file uploaded. Send the Excel file as form-data field named 'file'."` |
| File is not a valid `.xlsx` / `.xls` | `"Failed to parse Excel file. Make sure it is a valid .xlsx / .xls file."` |
| File has no data rows (empty sheet) | `"Excel file is empty or has no data rows"` |
| Sheet contains **unknown / extra columns** | `"Excel contains unknown column(s): \"XYZ\". Allowed columns are: Name, Phone Number, Date, Interested At, Assign To."` |
| Required column `Name` is missing | `"Excel is missing required column \"Name\""` |
| Required column `Phone Number` is missing | `"Excel is missing required column \"Phone Number\""` |
| Required column `Date` is missing | `"Excel is missing required column \"Date\""` |
| `pipelineId` missing or not a valid number | `"pipelineId is required"` |
| Pipeline not found or deleted | `"Pipeline not found"` |

> **No extra columns allowed.** If the sheet has any column that is not one of the 5 allowed ones (`Name`, `Phone Number`, `Date`, `Interested At`, `Assign To`), the whole file is rejected immediately. The user must remove those columns before re-uploading.

---

## Row-Level Validation

These checks run on each individual row. A row that fails is **skipped** (not inserted) and added to the `failed[]` array in the response. All other valid rows are still saved — a bad row does not stop the rest.

### Name

| Rule | Error Message |
|---|---|
| Empty / blank | `"Name is required"` |
| Contains digits | `"Name must not contain numbers"` |
| More than 100 characters | `"Name must be 100 characters or less"` |

### Phone Number

| Rule | Error Message |
|---|---|
| Empty / blank | `"Phone Number is required"` |
| Contains letters or non-numeric characters (after stripping spaces, dashes, `+`, `()`) | `"Phone Number must contain digits only — got \"9876abc\""` |
| Less than 7 digits | `"Phone Number must be 7–15 digits — got 4 digit(s)"` |
| More than 15 digits | `"Phone Number must be 7–15 digits — got 16 digit(s)"` |

> Phone numbers are **cleaned before storing** — spaces, dashes, `+`, and parentheses are stripped. Only the raw digits are saved to the database. So `+91 98765-43210` is stored as `919876543210`.

### Date

| Rule | Error Message |
|---|---|
| Empty / blank | `"Date is required"` |
| Unrecognised format | `"Date \"32/13/2026\" is not a valid date. Use formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, or a native Excel date cell."` |

**Accepted date formats:**

| Format | Example |
|---|---|
| `YYYY-MM-DD` | `2026-05-15` |
| `DD-MM-YYYY` | `15-05-2026` |
| `DD/MM/YYYY` | `15/05/2026` |
| `YYYY/MM/DD` | `2026/05/15` |
| `DD-MMM-YYYY` | `15-May-2026` |
| Native Excel date cell | *(formatted as a date in Excel)* |

> **How dates are stored in the database:** All dates are stored as **UTC midnight** (`2026-05-15T00:00:00.000Z`). This means no matter what timezone the server or client is in, the date value in the DB is always clean and consistent — just the date, no time component.

### Interested At (optional)

| Rule | Error Message |
|---|---|
| More than 200 characters | `"Interested At must be 200 characters or less"` |

If left blank, it is stored as `NULL` in the database — same as leaving it empty on the form.

### Assign To (optional)

| Rule | Error Message |
|---|---|
| Name does not match any active user in the branch | `"Assign To: user \"John\" not found in this branch"` |

- Matching is **case-insensitive** — `"arjun mehta"` matches `"Arjun Mehta"`.
- The user must be **active** (`status = "ACTIVE"`) and belong to the **same branch** as the logged-in user.
- If left blank, the lead is created as **Unassigned** (`assigned_to = NULL`).

---

## What the Failed Row Response Looks Like

When rows fail, the response still returns `200` (the request itself succeeded — some rows just had errors). The `failed[]` array contains one entry per bad row:

```json
{
  "success": true,
  "message": "Import complete. 2 lead(s) created, 3 skipped.",
  "data": {
    "total": 5,
    "created": 2,
    "skipped": 3,
    "succeeded": [
      { "row": 2, "leadId": 101, "name": "Rahul Verma", "mobile": "9876543210", "date": "2026-05-15T00:00:00.000Z" },
      { "row": 3, "leadId": 102, "name": "Priya Nair",  "mobile": "9123456780", "date": "2026-05-16T00:00:00.000Z" }
    ],
    "failed": [
      {
        "row": 4,
        "data": { "name": "John123", "mobile": "abc" },
        "errors": [
          "Name must not contain numbers",
          "Phone Number must contain digits only — got \"abc\""
        ]
      },
      {
        "row": 5,
        "data": { "name": "", "mobile": "9000000001" },
        "errors": ["Name is required"]
      },
      {
        "row": 6,
        "data": { "name": "Amit Shah", "mobile": "9111111111" },
        "errors": ["Date \"32/13/2026\" is not a valid date. Use formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, or a native Excel date cell."]
      }
    ]
  }
}
```

Key points for the frontend:
- `row` is the **actual Excel row number** (row 2 = first data row after the header). Show this to the user so they can find the exact row in their file.
- `errors` is an **array** — a single row can have multiple errors at once (e.g. both name and phone are wrong).
- `data` contains the raw values from that row so the user can see what was in the cell.

---

## How to Display Errors to the User

Show a table of failed rows after the import completes:

```jsx
{importResult?.failed?.length > 0 && (
  <table>
    <thead>
      <tr>
        <th>Excel Row #</th>
        <th>Name</th>
        <th>Mobile</th>
        <th>Error(s)</th>
      </tr>
    </thead>
    <tbody>
      {importResult.failed.map((f) => (
        <tr key={f.row}>
          <td>{f.row}</td>
          <td>{f.data.name || "—"}</td>
          <td>{f.data.mobile || "—"}</td>
          <td>
            <ul>
              {f.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)}
```

---

## Updated Common Mistakes Table

| Mistake | What Happens | Fix |
|---|---|---|
| Sheet has extra columns (e.g. `Email`, `Notes`) | Whole file rejected — `400` with column names listed | Remove extra columns, keep only the 5 allowed ones |
| Phone number has letters (`98abc`) | That row skipped | Use digits only |
| Phone number too short (e.g. `123`) | That row skipped | Must be 7–15 digits |
| Name has numbers (`John2`) | That row skipped | Names must be text only |
| Date in wrong format (`May 15`) | That row skipped | Use `YYYY-MM-DD`, `DD-MM-YYYY`, or a native Excel date cell |
| `Assign To` name has a typo | That row skipped | Name must exactly match an active branch user |
| `Interested At` is very long | That row skipped | Keep it under 200 characters |
| File over 5 MB | Whole file rejected — `400` | Split into smaller files or remove unused rows/columns |
