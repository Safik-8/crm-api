# CRM Backend — Role & Permission Module Handoff Guide
# For the other developer's agent implementing Task 5 + Task 6

---

## 1. What Already Exists (DO NOT rebuild these)

### ✅ Auth & Session (`src/modules/auth/`)
- Login, logout, refresh token — all complete
- JWT generation with role/permissions embedded
- Password hash, token utils — all ready

### ✅ RBAC Middleware (`src/middleware/`)
- `Authenticate.js` — verifies JWT, loads user+roles+permissions from DB on every request
- `hasPermission.js` — route-level permission guard

**How to protect a route:**
```javascript
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"

router.use(authenticate)
router.get("/", hasPermission("ROLE_PERMISSION", "canView"), listRoles)
router.post("/", hasPermission("ROLE_PERMISSION", "canCreate"), createRole)
```

### ✅ 5 System Roles Seeded (`src/config/initSystem.js`)
The following roles are created in DB on every server startup:

| code | name | rank | isSystem |
|---|---|---|---|
| SUPER_ADMIN | Super Admin | 100 | true |
| COMPANY_ADMIN | Company Admin | 80 | true |
| BRANCH_MANAGER | Branch Manager | 60 | true |
| BDE | BDE | 40 | true |
| ISE | ISE | 40 | true |

`isSystem = true` means: **cannot delete, cannot change code/rank**.

### ✅ Permission Matrix Seeded
All 5 roles have module-level permissions pre-seeded in the `permissions` table.
See `initSystem.js` → `ROLE_PERMISSIONS` for the full matrix.

### ✅ Constants File (`src/config/roleConstants.js`)
**Import from here — do not hardcode role strings anywhere:**
```javascript
import { ROLE_CODES, ROLE_RANKS, ROLE_NAMES, MODULES, SYSTEM_ROLE_CODES, ROLE_CREATION_RULES } from "../../config/roleConstants.js"
```

---

## 2. The `req.user` Shape (Set by Authenticate.js)

Every authenticated request has `req.user` with:
```javascript
req.user = {
  id              : 1,
  name            : "Pratik",
  email           : "pratik@company.com",
  companyId       : 3,
  branchId        : 2,
  company         : { id, name, code, logo, industry, website, address, status },
  primaryRole     : "COMPANY_ADMIN",        // ← USE THIS for logic checks
  primaryRoleName : "Company Admin",         // ← USE THIS for display only
  primaryRoleRank : 80,                      // ← USE THIS for rank comparisons
  allRoles        : [{ code, name, rank, companyId, branchId, isPrimary }],
  permissions     : {
    "COMPANY"     : { canView: true, canCreate: false, canEdit: true, canDelete: false },
    "BRANCH"      : { canView: true, canCreate: true, canEdit: true, canDelete: false },
    "ROLE_PERMISSION": { canView: true, ... },
    // ...all 19 modules
  }
}
```

---

## 3. Database Schema — Role Model

```prisma
model Role {
  id          Int      @id @default(autoincrement())
  companyId   Int?     // null = global system role
  code        String   @unique      // "SUPER_ADMIN" — machine key, use in code
  name        String                // "Super Admin"  — display label, safe to change
  description String?
  rank        Int      @default(0)  // 100/80/60/40 — higher = more authority
  isSystem    Boolean  @default(false)  // true = seeded, cannot delete
  status      String   @default("ACTIVE")
  createdBy   Int?
  createdAt   DateTime
  updatedAt   DateTime
}
```

**Key rules to enforce in your Role module:**
- `isSystem = true` → block delete and block changing `code` or `rank`
- Custom roles: `isSystem = false`, `companyId = actor.companyId`
- Global custom roles (SUPER_ADMIN only): `companyId = null`
- `@@unique([companyId, name])` → same role name is allowed across different companies

---

## 4. Database Schema — Permission Model

```prisma
model Permission {
  id        Int     @id
  roleId    Int
  module    String  // e.g. "LEAD", "COMPANY", "BRANCH"
  canView   Boolean
  canCreate Boolean
  canEdit   Boolean
  canDelete Boolean
  canArchive Boolean
  @@unique([roleId, module])
}
```

**Full module list** is in `roleConstants.js` → `MODULES` array (19 modules).

**For bulk permission upsert** (Task 6.4):
```javascript
await prisma.permission.upsert({
  where: { roleId_module: { roleId, module } },
  update: { canView, canCreate, canEdit, canDelete },
  create: { roleId, module, canView, canCreate, canEdit, canDelete }
})
```

---

## 5. Rank-Based Guard Pattern

Use `req.user.primaryRoleRank` to enforce that actors can only manage roles below their own rank:

```javascript
// In your role creation service:
export const createRoleService = async (data, actor) => {
  // Rank guard: cannot create role with rank >= own rank
  if (data.rank >= actor.primaryRoleRank) {
    throw new ForbiddenError("Cannot create a role with equal or higher rank than your own")
  }
  // isSystem check: cannot set isSystem = true from API
  // ...
}
```

---

## 6. Folder Structure to Follow

Match the existing pattern used in company and branch modules:

```
src/modules/role/
  role.routes.js        ← Express routes with authenticate + hasPermission guards
  role.controllers.js   ← Thin: parse req, call service, send res
  role.services.js      ← Business logic, rank guards, isSystem checks
  role.repository.js    ← All Prisma queries
  role.validation.js    ← Zod schemas for create/update
```

---

## 7. Shared UI Components (Frontend)

The frontend already has these reusable components — **do not rebuild them**:

| Component | Path | Purpose |
|---|---|---|
| `DynamicFormSlideover` | `src/shared/components/elements/DynamicFormSlideover.jsx` | Slide-over form panel |
| `ConfirmModal` | `src/shared/components/elements/ConfirmModal.jsx` | Confirmation dialog |
| `TextField` | `src/shared/components/elements/TextField.jsx` | MUI text input |
| `SelectField` | `src/shared/components/elements/SelectField.jsx` | MUI select dropdown |
| `Skeleton` | `src/shared/components/elements/Skeleton.jsx` | Loading placeholder |

**Usage example (Role form slide-over):**
```jsx
<DynamicFormSlideover
  isOpen={isOpen}
  onClose={onClose}
  title="Create Role"
  icon={Shield}
  fields={roleFields}
  initialValues={initialValues}
  onSubmit={handleSubmit}
  submitText="Create Role"
/>
```

---

## 8. Frontend API Pattern

All API calls go through the Axios client in `src/lib/api/api.js`.
It handles 401 redirect and 403 toast automatically.

```javascript
// src/features/role/api/roleApi.js
import api from '../../../lib/api/api'

export const getRoles    = (params) => api.get('/roles', { params })
export const createRole  = (data)   => api.post('/roles', data)
export const updateRole  = (id, data) => api.put(`/roles/${id}`, data)
export const toggleStatus = (id)    => api.patch(`/roles/${id}/status`)
```

TanStack Query hooks pattern (see `src/features/company/hooks/useCompanies.js` for reference).

---

## 9. Files You Should NOT Touch

| File | Reason |
|---|---|
| `src/middleware/Authenticate.js` | Core session — changes break all modules |
| `src/middleware/hasPermission.js` | Core auth guard — just use it |
| `src/config/initSystem.js` | Seeding — add to it, don't rewrite it |
| `src/config/roleConstants.js` | Shared constants — import, don't duplicate |
| `prisma/schema.prisma` | Coordinate any changes with the team |
| `src/modules/auth/*` | Auth is complete — do not touch |
| `src/modules/company/*` | Company module is complete |
| `src/modules/branch/*` | Branch module is complete |

---

## 10. Quick Start Checklist for the Role Module

```
[ ] Create src/modules/role/ folder with 5 files (routes/controllers/services/repository/validation)
[ ] Import ROLE_CODES, MODULES from roleConstants.js
[ ] Use hasPermission("ROLE_PERMISSION", "canView/canCreate/canEdit/canDelete") on routes
[ ] In services: block delete/code-change if role.isSystem = true
[ ] In services: enforce rank guard (actor.primaryRoleRank > target.rank)
[ ] For custom roles: set isSystem = false, companyId = actor.companyId
[ ] Permission matrix: use prisma.permission.upsert with roleId_module unique key
[ ] Frontend: use DynamicFormSlideover for create/edit forms
[ ] Frontend: use ConfirmModal for status toggle confirmation
[ ] Frontend: follow TanStack Query pattern from useCompanies.js
```
