# Pipeline Stage Deletion Rule

## Overview

A stage is now soft-deleted globally (`isDeleted = true`) only when it has no associated lead data anywhere in the system.
This means the stage can only be removed from the global stage master if no active leads reference it in any pipeline.

## What changed

- `DELETE /api/stages/:id` now performs a global validation before soft-deleting a stage.
- The backend checks all non-deleted leads for the target `stageId`.
- If any lead exists with that stage, the delete request is rejected.
- Only when the stage is empty across all pipelines will it be soft-deleted.

## Why this change exists

Previously, stages could be soft-deleted even when leads still existed that referenced them.
That could leave leads attached to deleted stages and cause missing or inconsistent stage data across reports and UI.

With this change:
- global stage deletion is safe
- a stage is only soft-deleted when it is truly unused by any lead
- active leads will always continue to have a valid stage value

## Backend behavior

When `DELETE /api/stages/:id` is called:

1. The backend verifies the stage exists and is not already deleted.
2. It rejects requests for default stages like `Prospect`.
3. It counts all non-deleted leads where `stageId = :id`.
4. If any leads exist, the request fails with:
   - `400 Bad Request`
   - message: `Stage cannot be deleted because it contains leads`
5. If no leads exist, the stage is soft-deleted by setting `isDeleted = true`.

## Frontend usage

### Endpoint

`DELETE /api/stages/:id`

### What the frontend should do

- Confirm with the user before deleting a stage.
- Call the delete endpoint with the stage ID.
- If the backend returns `400`, show a clear message:
  - `This stage cannot be deleted because it still has leads.`
- If the delete succeeds, remove the stage from the global stage dropdown and pipeline stage lists.

### Example error handling

If the backend response is a `400` error:
- `error.message = "Stage cannot be deleted because it contains leads"`
- show a friendly message to users like:
  - `Cannot delete this stage because it is still used by leads. Move or delete the leads first.`

## Notes

- This rule is global, not pipeline-specific.
- The stage must be empty across all pipelines.
- Default stages (`Prospect`, `Closure`) are still protected and cannot be deleted.
