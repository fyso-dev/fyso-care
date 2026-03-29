# Agent Architecture Decision

> Research and recommendation for issue #19. Consolidate or scope the two agents.

## Current State

### Agents

| Agent | Slug | Fallback | Rules | Prompt Versions | tools_scope |
|---|---|---|---|---|---|
| Appointment Agent | `appointment-agent` | llm | 0 | 3 | not configured |
| Agente Recepcion Clinica | `agente-recepcion-clinica` | message | 0 | 0 | not configured |

### Observations

1. **Overlapping scope**: Neither agent has `tools_scope` configured, meaning both have implicit access to all 10 entities. There is no separation of responsibilities.
2. **No rules attached**: The tenant has 3 appointment rules (`default_appointment_duration`, `default_appointment_status`, `validate_appointment_date_future`), but neither agent references them.
3. **Appointment Agent** has a meaningful prompt (v3) focused on scheduling, modifying, and canceling appointments. It uses `llm` fallback, which allows it to respond conversationally when no rule matches.
4. **Agente Recepcion Clinica** has no version history and no prompt customization. It uses `message` fallback, which returns a canned message when no rule matches -- effectively a dead end without rules.

### Entities in the tenant

| Entity | Relevant to appointments | Relevant to reception |
|---|---|---|
| appointments | Yes | Yes |
| patients | Yes | Yes |
| doctors | Yes | Yes |
| services | Yes | Maybe |
| networks | Maybe | Yes |
| specialties | Maybe | Maybe |
| exceptions | Yes (availability) | No |
| special_schedules | Yes (availability) | No |
| treatments | No | Yes |
| site_config | No | No |

---

## Recommendation: Merge into one agent

**Decision**: Merge both agents into a single **Appointment Agent** (`appointment-agent`).

### Rationale

1. **The reception agent adds no value today.** It has no prompt, no rules, no version history, and its `message` fallback makes it non-functional without rules. Keeping it creates confusion about which agent handles what.
2. **A single agent with LLM fallback is more flexible.** The `llm` fallback on the Appointment Agent allows it to handle edge cases conversationally, which is the right default for a small clinic with one primary workflow (booking appointments).
3. **The domain is not large enough to justify two agents.** With 10 entities all centered around one workflow (patient visits a doctor), splitting into two agents creates artificial boundaries without clear benefit.
4. **Easier to maintain.** One prompt to iterate on, one set of rules, one place to check.

### What to keep

- **Keep**: `appointment-agent` (has prompt, llm fallback, version history)
- **Delete**: `agente-recepcion-clinica` (no prompt, no rules, no history)

### Scope for the merged agent

Configure `tools_scope` on `appointment-agent` to grant access to the entities it needs:

```
tools_scope:
  appointments: [create, read, update]
  patients: [create, read, update]
  doctors: [read]
  services: [read]
  networks: [read]
  specialties: [read]
  exceptions: [read]
  special_schedules: [read]
```

Excluded from scope:
- `treatments` -- clinical data, not part of booking flow. Add later if needed.
- `site_config` -- admin-only configuration, no agent access needed.

### Rules to attach

Attach the existing appointment rules to the agent:

| Rule | ID | Trigger | Status |
|---|---|---|---|
| `default_appointment_duration` | `f1010101-...` | before_save | published |
| `default_appointment_status` | `f2020202-...` | before_save | published |
| `validate_appointment_date_future` | `cb988600-...` | before_save | draft (publish first) |

---

## Action Items

1. Delete `agente-recepcion-clinica`
2. Update `appointment-agent` with `tools_scope` as defined above
3. Publish the draft rule `validate_appointment_date_future`
4. Attach all 3 appointment rules to `appointment-agent`
5. Test the agent with a booking conversation to verify it enforces rules

These changes will be implemented in follow-up commits within this PR or as separate issues.
