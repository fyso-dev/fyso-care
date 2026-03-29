# Clinica Preset vs Consultorio Schema Comparison

> Research document for issue #5. No schema changes -- analysis only.

## Overview

| | Clinica Preset | Consultorio (current) |
|---|---|---|
| Entities | 4 | 10 |
| Business Rules | 2 | 2 (from preset prebuild) |
| Agents | 1 | 2 |
| Status | Built-in template | Manually built tenant |

The `clinica` preset provides a minimal starting point (patients, doctors, appointments, treatments) with 2 business rules and 1 agent. Our consultorio tenant extends this significantly with 6 additional entities for scheduling, configuration, and catalog management.

---

## 1. Entity Comparison

### Side-by-side: Preset Entities vs Consultorio Entities

| Entity | In Preset | In Consultorio | Notes |
|---|---|---|---|
| patients | Yes | Yes | Consultorio adds 14 custom fields (DNI, sex, address, obra social, medical record, etc.) |
| doctors | Yes | Yes | Consultorio adds 55 custom fields (weekly schedule grid, online booking, specialization, etc.) |
| appointments | Yes | Yes | Consultorio adds 10 custom fields (date/time split, status, service, obra social, notes, etc.) |
| treatments | Yes | Yes | Identical -- only system fields, no custom additions |
| exceptions | No | Yes | Doctor day-off management (vacations, leaves) |
| special_schedules | No | Yes | Override weekly schedule for specific dates |
| networks | No | Yes | Obras sociales / insurance providers |
| services | No | Yes | Service types (Consulta, Turno Online, etc.) |
| specialties | No | Yes | Medical specialties catalog |
| site_config | No | Yes | Website configuration (hero, CTA, contact info, hours) |

### Verdict

The preset covers the 4 core entities. Consultorio has added 6 domain-specific entities that are not part of the preset but are essential for the booking site use case. No entities from the preset are missing in consultorio.

---

## 2. Field Comparison for Overlapping Entities

### patients

| Field | Preset (system) | Consultorio (custom) | Type |
|---|---|---|---|
| name | Yes (system) | Yes (system) | text |
| date_of_birth | Yes (system) | Yes (system) | date |
| notes | Yes (system) | Yes (system) | textarea |
| first_name | -- | Yes | text, required |
| last_name | -- | Yes | text |
| dni | -- | Yes | text |
| email | -- | Yes | text |
| phone | -- | Yes | text |
| birthdate | -- | Yes | date (duplicate of date_of_birth) |
| sex | -- | Yes | text |
| address | -- | Yes | text |
| city | -- | Yes | text |
| network_id | -- | Yes | relation -> networks |
| medical_record | -- | Yes | longText |
| prof_cabecera | -- | Yes | text |
| warnings | -- | Yes | longText |
| contact_details | -- | Yes | longText |

**Issue found**: `birthdate` (custom) duplicates `date_of_birth` (system). Should consolidate.

### doctors

| Field | Preset (system) | Consultorio (custom) | Type |
|---|---|---|---|
| specialty | Yes (system) | Yes (system) | text, required |
| license_number | Yes (system) | Yes (system) | text |
| phone | Yes (system) | Yes (system) | phone |
| name | -- | Yes | text, required |
| email | -- | Yes | text |
| specialization | -- | Yes | text (duplicate of specialty) |
| nota_publica | -- | Yes | longText |
| enabled | -- | Yes | boolean |
| online | -- | Yes | boolean |
| dias_turnos | -- | Yes | number |
| Schedule fields (42) | -- | Yes | 7 days x 2 shifts x 3 fields (enabled, from, to, period) |

**Issue found**: `specialization` (custom) duplicates `specialty` (system). Should consolidate.

**Design note**: The 42 schedule fields (mon_morn_enabled, mon_morn_from, etc.) are a flat denormalized design. This works but makes the entity very wide (58 fields). An alternative would be a separate `schedules` entity with day/shift/from/to/period fields.

### appointments

| Field | Preset (system) | Consultorio (custom) | Type |
|---|---|---|---|
| appointment_date | Yes (system) | Yes (system) | datetime, required |
| duration_minutes | Yes (system) | Yes (system) | number |
| reason | Yes (system) | Yes (system) | textarea |
| date | -- | Yes | date, required |
| time | -- | Yes | text, required |
| status | -- | Yes | text, required |
| doctor_id | -- | Yes | relation -> doctors |
| patient_id | -- | Yes | relation -> patients |
| service_id | -- | Yes | relation -> services |
| network_id | -- | Yes | relation -> networks |
| overtime | -- | Yes | boolean |
| consultation_notes | -- | Yes | longText |
| appointment_notes | -- | Yes | longText |

**Issue found**: `date` + `time` (custom) partially duplicate `appointment_date` (system datetime). The system field stores both date and time; the custom fields split them. Should decide on one approach.

### treatments

| Field | Preset (system) | Consultorio (custom) | Type |
|---|---|---|---|
| name | Yes (system) | Yes (system) | text, required |
| treatment_date | Yes (system) | Yes (system) | date, required |
| cost | Yes (system) | Yes (system) | number |
| notes | Yes (system) | Yes (system) | textarea |
| doctor_id | Yes (system) | Yes (system) | relation -> doctors |
| patient_id | Yes (system) | Yes (system) | relation -> patients |

No custom fields added. Matches preset exactly.

---

## 3. Business Rules

### Current Rules (from preset prebuild)

| Rule | Entity | Trigger | DSL | Status |
|---|---|---|---|---|
| default_appointment_duration | appointments | before_save | `duration_minutes \|\| 30` | published |
| default_appointment_status | appointments | before_save | `status \|\| 'scheduled'` | published |

Both rules were installed during initial tenant setup (generatedBy: `prebuild`). They are the 2 rules included in the clinica preset.

### Rules the Preset Includes That We Already Have

All 2 preset rules are already active. No gap here.

### Rules We Should Consider Adding

| Proposed Rule | Entity | Type | Description |
|---|---|---|---|
| validate_appointment_date_future | appointments | validate | Reject appointments with date in the past |
| validate_patient_required_fields | patients | validate | Require at least one contact method (phone or email) |
| compute_patient_full_name | patients | compute | Auto-set `name` from `first_name + last_name` |
| validate_exception_date_range | exceptions | validate | Ensure `to_date >= since_date` |
| default_doctor_enabled | doctors | compute | New doctors default to `enabled = true` |

---

## 4. Agent Configuration

### Preset Agent

The clinica preset includes 1 agent. Based on the preset description, it is an appointment/reception agent with access to all 4 core entities.

### Current Consultorio Agents

| Agent | Slug | Fallback | Rules | Notes |
|---|---|---|---|---|
| Appointment Agent | appointment-agent | llm | 0 | 3 prompt versions, specialized in scheduling |
| Agente Recepcion Clinica | agente-recepcion-clinica | message | 0 | No version history, message fallback |

**Observations**:
- Neither agent has business rules attached (rules_count: 0 for both).
- The Appointment Agent uses LLM fallback (more flexible), while the Reception Agent uses message fallback (safer but limited).
- Having 2 agents with overlapping scope (both deal with appointments) may cause confusion. Consider consolidating or clearly separating responsibilities.

---

## 5. Recommendations

### High Priority

1. **Remove duplicate fields** -- Three pairs of duplicated fields exist:
   - `patients.birthdate` vs `patients.date_of_birth` (system)
   - `doctors.specialization` vs `doctors.specialty` (system)
   - `appointments.date` + `appointments.time` vs `appointments.appointment_date` (system)

   Migrate data to the system fields and drop the custom duplicates. This reduces confusion and aligns with preset conventions.

2. **Add validation rules** -- The tenant has zero validation rules. At minimum:
   - Appointment date must be in the future
   - Exception date range must be valid (to >= from)
   - Patient needs at least phone or email

3. **Compute `patients.name` from first_name + last_name** -- The system `name` field exists but must be manually filled. A before_save rule can auto-compute it.

### Medium Priority

4. **Convert `appointments.status` from free text to select** -- Currently a text field with documented values (Pendiente, Presente, Completado, Cancelado, Bloqueado). A `select` field type would enforce valid values.

5. **Convert `patients.sex` from text to select** -- Same rationale. Known values: M, F, X.

6. **Consolidate or differentiate agents** -- Either merge into one agent with clear scope, or give each agent distinct entity access via `tools_scope`.

7. **Add rules to agents** -- Both agents have 0 rules. Attach the appointment rules to the Appointment Agent so it can enforce defaults during conversational booking.

### Low Priority

8. **Consider normalizing doctor schedules** -- The 42 flat fields in `doctors` work but could be a separate `doctor_schedules` entity for cleaner data management. Evaluate if the current site code depends on the flat structure before changing.

9. **Use proper field types** -- `doctors.email` and `patients.phone` use `text` instead of `email` and `phone` types respectively. The correct types enable validation and rendering hints.

---

## 6. Follow-up Issues to Create

| # | Title | Priority | Type |
|---|---|---|---|
| 1 | Remove duplicate fields (birthdate, specialization, date+time) | High | Schema change |
| 2 | Add validation rules for appointments, patients, exceptions | High | Rules |
| 3 | Add computed rule: patients.name = first_name + last_name | High | Rules |
| 4 | Convert status and sex fields from text to select | Medium | Schema change |
| 5 | Consolidate or scope the two agents | Medium | Agent config |
| 6 | Attach business rules to agents | Medium | Agent config |
| 7 | Fix field types (email, phone) on patients and doctors | Low | Schema change |
| 8 | Evaluate normalizing doctor schedule fields | Low | Architecture |
