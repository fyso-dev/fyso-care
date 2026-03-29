# Schema Changelog

## 2026-03-28 — Field Type Improvements (#16)

### Summary

Convert free-text fields to select type so the UI renders dropdowns with predefined options instead of open text inputs. This improves data consistency and user experience.

### Changes Required

| Entity | Field | Field Key | Old Type | New Type | Options |
|--------|-------|-----------|----------|----------|---------|
| appointments | Estado | `status` | text | select | Pendiente, Presente, Completado, Cancelado, Bloqueado |
| patients | Sexo | `sex` | text | select | M, F, X |

### Platform Limitation

Fyso does not currently support changing a field's type after publication. The `add_field` action rejects duplicate field keys, and `generate` rejects duplicate entity names. There is no `alter_field` or `update_field` action available.

**Feedback submitted**: suggestion `c59f7680-86f1-4bfc-aa91-4cbe9915f9cc` requesting `alter_field` support.

### Workaround Options

1. **Wait for platform support** — Fyso may add field type migration in a future release.
2. **Delete and recreate entities** — Destructive; requires backing up all records, deleting the entity, recreating with correct field types, and re-importing data. Risk of data loss.
3. **Add parallel select fields** — Create new select fields (`status_v2`, `sex_v2`), migrate data, update frontend to use new fields, then deprecate old ones. Safe but adds schema clutter.

### Note on Test Artifact

A test field `status_select_test` was added to the `appointments` entity during investigation. This field should be removed once Fyso supports field deletion or entity recreation.

---

## 2026-03-28 — Fix Field Types: email and phone (#18)

### Summary

Change `doctors.email` from `text` to `email` and `patients.phone` from `text` to `phone` so the frontend renders correct input types (email keyboard, tel keyboard on mobile).

### Changes Required

| Entity | Field | Field Key | Old Type | New Type |
|--------|-------|-----------|----------|----------|
| doctors | Email | `email` | text | email |
| patients | Telefono | `phone` | text | phone |

### Current State

Both fields are custom fields (`isSystem: false`) on published entities. Existing data is plain text strings that are already compatible with the target types (emails and phone numbers).

### Status: BLOCKED

Same platform limitation as #16 — Fyso does not support changing a field's type after publication. No `alter_field` or `update_field` action exists.

See feedback suggestion `c59f7680-86f1-4bfc-aa91-4cbe9915f9cc` (filed in #16) which already requests `alter_field` support.

### Workaround Options

Same as #16:
1. **Wait for platform support** — recommended, lowest risk.
2. **Delete and recreate entities** — destructive, risk of data loss.
3. **Add parallel fields** — create `email_v2` (type email) and `phone_v2` (type phone), migrate data, update frontend, deprecate old fields.
