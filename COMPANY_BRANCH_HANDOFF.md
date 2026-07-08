# CRM Backend — Company & Branch Module Handoff Guide
# For any developer or agent extending company/branch functionality

---

## 1. Architecture Pattern (Follow This for All Modules)

Every module follows a strict 4-layer pattern. Do NOT mix layers:

```
routes.js         ← Express routes: authentication + permission guards + validation
controllers.js    ← Thin: parse req body/params → call service → send res
services.js       ← ALL business logic, role checks, scoping rules
repository.js     ← ALL Prisma queries — no logic here, just DB calls
validation.js     ← Zod schemas for request body validation
```

---

## 2. Company Module

### API Endpoints

| Method | URL | Permission | Description |
|---|---|---|---|
| `POST` | `/api/companies` | `COMPANY.canCreate` | Onboard new company + create its admin |
| `GET` | `/api/companies` | `COMPANY.canView` | All companies (dropdown list) |
| `GET` | `/api/companies/paginated` | `COMPANY.canView` | Paginated + filtered table |
| `GET` | `/api/companies/:id` | `COMPANY.canView` | Single company details |
| `PUT` | `/api/companies/:id` | `COMPANY.canEdit` | Update company name/status |

### Role Scope Rules (enforced in `company.services.js`)

| Role | What they can see/do |
|---|---|
| `SUPER_ADMIN` | All companies — no company scope restriction |
| `COMPANY_ADMIN` | Only their own company (`actor.companyId`) |
| `BRANCH_MANAGER`, `BDE`, `ISE` | No company access (`canView = false` in permissions) |

```javascript
// Pattern used in every company service function:
if (actor?.primaryRole !== "SUPER_ADMIN") {
  throw new ForbiddenError("Access denied: Only Super Admins can onboard new companies")
}
```

### Create Company Flow

Creating a company also creates its first `COMPANY_ADMIN` user in a single DB transaction:

```
POST /api/companies
Body: {
  name, code, logo?, industry?, website?, address?, status?,
  adminName, adminEmail, adminPassword    ← Company Admin user created automatically
}
```

**What happens internally:**
1. Check actor is `SUPER_ADMIN`
2. Validate `code` is unique → `ConflictError` if duplicate
3. Validate `adminEmail` is unique → `ConflictError` if duplicate
4. `prisma.$transaction([])` — atomic: create company + create admin user + assign `COMPANY_ADMIN` role
5. Returns created company details

> **Note:** Company code is auto-uppercased and trimmed.
> Status options: `"ACTIVE"` | `"INACTIVE"` (default: `"ACTIVE"`)

### Pagination Query Params (GET /paginated)

```
?page=1&limit=10&search=Acme&status=ACTIVE
```

---

## 3. Branch Module

### API Endpoints

| Method | URL | Permission | Description |
|---|---|---|---|
| `POST` | `/api/branches` | `BRANCH.canCreate` | Create a new branch inside a company |
| `GET` | `/api/branches` | `BRANCH.canView` | All branches (dropdown) |
| `GET` | `/api/branches/paginated` | `BRANCH.canView` | Paginated + filtered table |
| `GET` | `/api/branches/:id` | `BRANCH.canView` | Single branch details |
| `PUT` | `/api/branches/:id` | `BRANCH.canEdit` | Update branch name/status |
| `POST` | `/api/branches/:id/assign-user` | `BRANCH.canEdit` | Create + assign user to branch |

### Role Scope Rules (enforced in `branch.services.js`)

| Role | What they can see/do |
|---|---|
| `SUPER_ADMIN` | All branches across all companies |
| `COMPANY_ADMIN` | All branches within their company only |
| `BRANCH_MANAGER` | Only their own branch |
| `BDE`, `ISE` | No branch management access |

```javascript
// assertCompanyScope — used at the top of EVERY branch service function
const assertCompanyScope = (actor, targetCompanyId) => {
  if (actor.primaryRole === "SUPER_ADMIN") return   // global access
  if (actor.companyId !== targetCompanyId) {
    throw new ForbiddenError("You cannot access data from another company")
  }
}
```

### Create Branch Flow

```
POST /api/branches
Body: { companyId, name, code, address?, location?, status? }
```

**What happens internally:**
1. `assertCompanyScope` — verify actor belongs to same company
2. Auto-uppercase + trim `code`
3. Check `@@unique([companyId, code])` — same code allowed in different companies
4. Create branch record

> **Key constraint:** `code` is unique **within a company** — not globally.
> The same branch code `"HQ"` can exist in Company A and Company B.

### Assign User to Branch Flow (Most Complex Endpoint)

```
POST /api/branches/:id/assign-user
Body: { name, email, password, roleName }
```

**What happens internally:**
1. `assertCompanyScope`
2. Look up the role by `name + companyId:null` (system roles)
3. **Rank guard** — actor can only assign roles with lower rank:
   ```javascript
   // ROLE_CREATION_RULES in branch.services.js
   SUPER_ADMIN:    can create → [SUPER_ADMIN, COMPANY_ADMIN, BRANCH_MANAGER, BDE, ISE]
   COMPANY_ADMIN:  can create → [BRANCH_MANAGER, BDE, ISE]
   BRANCH_MANAGER: can create → [BDE, ISE]
   ```
4. If role requires branch (`BRANCH_MANAGER`, `BDE`, `ISE`) → branch is mandatory
5. Check email uniqueness → `ConflictError` if duplicate
6. Hash password, create user, assign role via `user_roles` table

> **Important:** `ROLE_CREATION_RULES` in `branch.services.js` is **hardcoded** as a local constant.
> When the Role Module is complete, update this to use `role.rank` comparison instead:
> ```javascript
> // Future: replace hardcoded rules with rank comparison
> if (targetRole.rank >= actor.primaryRoleRank) {
>   throw new ForbiddenError("Cannot assign role with equal or higher rank than your own")
> }
> ```

### Branch Pagination Query Params (GET /paginated)

```
?page=1&limit=10&search=Main&status=ACTIVE&company_id=3
```

---

## 4. Validation Schemas (Zod)

Both modules use `validateBody(schema)` middleware:

```javascript
// Usage in routes:
router.post("/", hasPermission("COMPANY", "canCreate"), validateBody(createCompanySchema), createCompany)
```

**Company validation fields:**
- `name` — required string
- `code` — required, min 2 chars (auto-uppercased in service)
- `logo`, `industry`, `website`, `address` — optional strings
- `status` — optional, `"ACTIVE"` | `"INACTIVE"`
- `adminName`, `adminEmail`, `adminPassword` — required for create

**Branch validation fields:**
- `companyId` — required number
- `name` — required string
- `code` — required, min 2 chars (auto-uppercased in service)
- `address`, `location` — optional strings
- `status` — optional, `"ACTIVE"` | `"INACTIVE"`

---

## 5. Error Handling Pattern

All modules throw typed errors from `src/utils/AppError.js`. The global error handler converts them to HTTP responses:

| Error Class | HTTP | When to use |
|---|---|---|
| `ValidationError` | 422 | Invalid request body (Zod failures auto-throw this) |
| `NotFoundError` | 404 | Resource doesn't exist |
| `ConflictError` | 409 | Duplicate code or email |
| `ForbiddenError` | 403 | Role/scope violation |
| `UnauthorizedError` | 401 | No token / invalid token |

```javascript
import { NotFoundError, ConflictError, ForbiddenError } from "../../utils/AppError.js"

throw new ConflictError("Company code already exists", "code")  // 2nd arg = field name
throw new ForbiddenError("Access denied: Only Super Admins can do this")
throw new NotFoundError("Company not found")
```

---

## 6. Repository Pattern

All Prisma queries live in `repository.js`. Services never call `prisma` directly except for transactions.

```javascript
// company.repository.js pattern:
export const findCompanyByCode = (code) =>
  prisma.company.findUnique({ where: { code } })

export const findCompanies = ({ where, skip, take, orderBy }) =>
  prisma.company.findMany({ where, skip, take, orderBy, include: { ... } })

// In service — only use prisma directly for $transaction:
await prisma.$transaction([
  prisma.company.create({ ... }),
  prisma.user.create({ ... }),
  prisma.userRole.create({ ... }),
])
```

---

## 7. Frontend API Hooks Pattern

Located in `src/features/company/hooks/` and `src/features/branch/hooks/`.
All use TanStack Query (`useQuery` + `useMutation`).

```javascript
// Pattern from useCompanies.js — replicate for any new module
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getCompanies, createCompany } from "../api/companyApi"

export const useCompanies = (params) => useQuery({
  queryKey: ["companies", params],
  queryFn: () => getCompanies(params),
})

export const useCreateCompany = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCompany,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companies"] }),
  })
}
```

---

## 8. Frontend API Client

All API calls go through the Axios instance at `src/lib/api/api.js`:
- Automatically attaches `Authorization: Bearer <token>`
- Intercepts 401 → redirects to login
- Intercepts 403 → shows toast error
- Base URL: `/api`

```javascript
// src/features/company/api/companyApi.js pattern:
import api from "../../../lib/api/api"

export const getCompanies       = (params) => api.get("/companies", { params })
export const createCompany      = (data)   => api.post("/companies", data)
export const updateCompany      = (id, data) => api.put(`/companies/${id}`, data)
export const getCompaniesPaged  = (params) => api.get("/companies/paginated", { params })
```

---

## 9. Files You Should NOT Touch

| File | Reason |
|---|---|
| `src/modules/company/company.services.js` | Company business logic complete |
| `src/modules/company/company.repository.js` | All company DB queries complete |
| `src/modules/branch/branch.services.js` | Branch business logic complete |
| `src/modules/branch/branch.repository.js` | All branch DB queries complete |
| `src/middleware/Authenticate.js` | Core session — do not modify |
| `src/middleware/hasPermission.js` | Core permission guard — do not modify |
| `src/config/roleConstants.js` | Shared constants — import, don't duplicate |

---

## 10. What You CAN Add On Top

| Task | Where to add |
|---|---|
| New company endpoint | Add route to `company.routes.js`, controller to `company.controllers.js`, service to `company.services.js` |
| User management within a branch | Extend `branch.services.js` → `assignUserToBranch` |
| Role-based branch filtering | Update `assertCompanyScope` in `branch.services.js` |
| Custom company settings | New table + new module following the same 4-layer pattern |
