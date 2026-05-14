# Pipeline Stage Deletion Rule

## Overview

A new pipeline-stage assignment validation has been added to the backend.
It ensures that a stage can only be removed from a pipeline when that stage contains no active leads in that pipeline.

This is not a global stage deletion rule — it applies only to removing stage assignments from a specific pipeline.

## What changed

- The endpoint `POST /api/pipelines/:id/stages` now checks stage removal before updating pipeline stage assignments.
- If the frontend removes a stage from a pipeline, the backend will verify whether any non-deleted leads still belong to that stage in the same pipeline.
- If any leads exist in the removed stage, the request fails with a `400 Bad Request`.
- This prevents accidental removal of stages that still contain lead data.

## Why this change exists

Previously, a pipeline could be updated to remove assigned stages without checking if the stage still contained leads.
That could break lead workflow, produce orphaned stage references, or hide leads in the wrong pipeline state.

With this change, pipeline stage topology remains safe:
- stages can be reordered freely
- new stages can be created and added
- existing stages can only be removed when empty

## Backend behavior

When `POST /api/pipelines/:id/stages` is called:

1. The backend builds the final pipeline stage set from:
   - existing stage IDs
   - newly created stage names
   - ordered stage IDs
2. It determines which stages are being removed from the current pipeline assignment.
3. For each removed stage, it checks whether any leads exist in that stage for the target pipeline.
4. If any leads exist, the update is rejected with:
   - `400 Bad Request`
   - message: `Cannot remove stage(s) from pipeline while they contain leads`
5. If removed stages are empty, the pipeline stage assignment updates succeed.

## Frontend usage

### Endpoint

`POST /api/pipelines/:id/stages`

### Request body example

```json
{
  "stageIds": [1, 2, 3],
  "newStages": [
    { "name": "Negotiation" }
  ],
  "orderedStageIds": [1, 4, 2, 3]
}
```

### What the frontend should do

- Fetch the current pipeline stage list and display it.
- Allow the user to add new stages, remove stages, and reorder stages.
- Build the final stage list using the selected stage IDs and the ordered result.
- If the user removes a stage, the frontend must be ready to handle a validation error.

### Recommended UI behavior

- When a user deletes a stage from the pipeline and submits the update:
  - send the new stage configuration to `POST /api/pipelines/:id/stages`
- If the backend returns a `400` with the delete-stage error:
  - show a message like: `Cannot remove stage because it still contains leads.`
  - keep the removed stage visible or highlight it so the user can re-add or move leads first.

### Error handling

If stage removal is blocked, the frontend should:
- read the returned error message
- explain to the user that the stage still contains leads
- guide the user to move or clear those leads before removing the stage

## Notes

- `Prospect` and `Closure` are default stages and are still required for pipelines.
- This rule applies only to stage removal inside a specific pipeline.
- It does not allow deleting a global stage from the entire system.
