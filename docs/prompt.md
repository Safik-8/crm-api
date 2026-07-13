# Frontend Coding Standards & Architecture Guidelines

All client-side code under `cms-web-org/src` must adhere to these structural, styling, and architectural rules to maintain consistency, performance, and code cleanliness.

---

## 1. Feature-Based Folder Structure (The Feature Module Standard)
Features are self-contained business modules located under `src/features/[feature_name]/`. Each feature module must strictly follow this folder structure:

```
src/features/[feature_name]/
├── services/   <- API wrapper calls (e.g., userService.js calling apiClient)
├── hooks/      <- Custom React Hooks & TanStack Query integrations
├── components/ <- Domain-specific presentational UI components
└── pages/      <- Route-level page orchestrators binding everything together
```

---

## 2. Layout, Structure & Styling: Tailwind CSS vs. Material UI (MUI)

* **Tailwind CSS**: Always use Tailwind utility classes for all structural layouts, spacing, alignment, grid systems, margins, padding, text typography, colors, and raw HTML markup tags (`div`, `p`, `span`, `h1`, `h2`, `h3`, `section`, etc.).
* **Material UI (MUI)**: Restrict the use of `@mui/material` strictly to form inputs, complex interactive controls, or overlay transitions.
* **Forbidden MUI Layout Containers**: Never import or use the following MUI components for spacing, columns, or layout structure:
  * `❌ Box` (Use Tailwind `div` with `flex`, `grid`, etc.)
  * `❌ Typography` (Use Tailwind `h1`, `p`, `span` with text classes)
  * `❌ Container` (Use Tailwind `container mx-auto`)
  * `❌ Grid` (Use Tailwind CSS Grid layouts: `grid grid-cols-1 md:grid-cols-2 gap-4`)
  * `❌ Paper` / `Card` (Use Tailwind `bg-white rounded-3xl border border-slate-200/80 shadow-sm`)

---

## 3. Shared Components Library (`src/shared/components/elements`)
To maintain design system consistency, **never direct-import raw MUI elements** in feature views when custom wrappers exist under `src/shared/components/elements`. Always import and consume the following:

* **[TextField](file:///d:/.work/StackDot/CRM/cms/cms-web-org/src/shared/components/elements/TextField.jsx)**: A pre-styled text input with a soft grey background (`#F8FAFC`) and orange focus border (`#F86F03`).
* **[SelectField](file:///d:/.work/StackDot/CRM/cms/cms-web-org/src/shared/components/elements/SelectField.jsx)**: A select input that **automatically upgrades** to a searchable autocomplete selector (`SearchableSelect`) if the options array has 10 or more options.
* **[Button](file:///d:/.work/StackDot/CRM/cms/cms-web-org/src/shared/components/elements/Button.jsx)**: A pre-styled premium action button supporting loading states and variants.
* **[DynamicFormSlideover](file:///d:/.work/StackDot/CRM/cms/cms-web-org/src/shared/components/elements/DynamicFormSlideover.jsx)**: A sliding drawer panel for edit/create forms with a fixed, sticky footer pinning "Cancel" and "Save" actions.
* **[ConfirmModal](file:///d:/.work/StackDot/CRM/cms/cms-web-org/src/shared/components/elements/ConfirmModal.jsx)**: Standardized confirmation overlay for actions like deactivation, deletion, or resetting.
* **[Table](file:///d:/.work/StackDot/CRM/cms/cms-web-org/src/shared/components/elements/Table.jsx)**: Reusable data table.

---

## 4. Separation of Concerns (Logic vs. View)

* **Presentational Components**: Keep components under `components/` and `pages/` purely visual. They should only map properties, handle renders, and trigger visual events.
* **React Custom Hooks**: Form state, validation checks, error management, and asynchronous API calls (axios clients, TanStack queries, mutations) **must reside in custom hooks** under `hooks/` (e.g., `useLoginForm.js`, `useUserForm.js`).
* **Query Caching & Key Invalidation**: When performing mutations (creates, edits, deactivations), always invalidate the parent Query Cache keys (e.g. calling `queryClient.invalidateQueries(['users'])` inside mutation `onSuccess` handlers) to automatically refresh active user lists.
* **Auto-Scroll validation**: When validating forms, if validation fails, ensure the page executes a smooth scroll centering on the first input with a `.Mui-error` class (using `.scrollIntoView({ behavior: 'smooth', block: 'center' })` and `.focus()`).

---


# Backend API Architecture Guidelines (4-Layer Standard)

Any new feature or API module created under `src/modules` must strictly conform to our **4-Layer Architecture** structure:

```
src/modules/[module_name]/
├── [module_name].validation.js   <- Schema Validation (Zod)
├── [module_name].routes.js       <- Endpoints & Middleware maps
├── [module_name].controllers.js  <- Express Request/Response orchestration
├── [module_name].services.js     <- Core Domain Business Rules & Security Guards
└── [module_name].repository.js   <- Direct Database Queries (Prisma Client)
```

---

## 1. Schema Validation Layer (`*.validation.js`)
* Use **Zod** to validate incoming client request payloads (`body`, `params`, `query`).
* Export schemas (e.g., `createUserSchema`, `updateUserSchema`).
* Expose standard middleware utilizing `validateBody(schema)` to parse, trim, and sanitise data before route execution.

---

## 2. Routing Layer (`*.routes.js`)
* Map URLs to controllers using Express `Router()`.
* Keep routes protected. Always register the `authenticate` middleware first.
* Always enforce RBAC constraints using `hasPermission("MODULE", "canAction")` middleware before forwarding to controllers.
* Bind the validator middleware directly to mutating endpoints (e.g., `validateBody(createUserSchema)`).

---

## 3. Controller Layer (`*.controllers.js`)
* Controllers should focus strictly on request orchestration:
  1. Extract parameters from `req.body`, `req.params`, or `req.query`.
  2. Pass variables (along with the authenticated `req.user` context) to the service layer.
  3. Format API responses using the standard `sendSuccess(res, data, message, statusCode)` utility.
* **Never write business rules or direct Prisma queries inside controllers**.
* **Do not use `try-catch` blocks to swallow or serialize errors locally**. Always delegate errors using `catch (err) { next(err) }` so the centralized error middleware can process them.

---

## 4. Service Layer (`*.services.js`)
* The core brain of the CRM application. All business rules and authorization policies live here.
* **Data Scoping Guards**: Verify multitenancy constraints by checking the caller's rank and company scope. Use `assertCompanyScope(actor, companyId)` to prevent cross-company access.
* **Role Rank Guards**: When mutating a user or role, verify that the caller's role rank is strictly higher than the target user's role rank.
* Throw descriptive, operational errors from `utils/AppError.js` (e.g., `ValidationError`, `ConflictError`, `NotFoundError`, `ForbiddenError`).
* Generate temporary credentials, audit records, and manage lifecycle events (e.g., deactivating tokens when deactivating accounts).

---

## 5. Repository Layer (`*.repository.js`)
* Standardized access layer for direct database interaction using the **Prisma Client**.
* Expose queries mapping JavaScript camelCase variables to database-specific fields.
* **Database Transactions**: Any operation writing to multiple tables (e.g., creating a user, assigning their role, creating a user settings record, and generating a profile) must execute atomically inside `prisma.$transaction(async (tx) => { ... })`.
* Handle data-aggregation and filter constraints.

---

## 🛠️ Database & Operations Rule (CRITICAL)
* **No `db push`**: Never use `prisma db push` to synchronize changes to the database. All database schema changes must be processed using **Prisma Migrations** (`npx prisma migrate dev`).
* **Audit Trails**: Ensure any write operations (creates, updates, status shifts) generate audit entries inside the `AuditLog` table using `createAuditLog`.

