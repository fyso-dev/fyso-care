# Seed Data

Seed data that ships with the source tenant so new instances have a working starting point.

## site_config

A single record with sensible defaults. New tenants should update these values.

| Field            | Default Value                        |
| ---------------- | ------------------------------------ |
| clinic_name      | My Clinic                            |
| clinic_slogan    | Your trusted healthcare provider     |
| address          | (configure your address)             |
| phone            | (configure your phone)               |
| email            | clinic@example.com                   |
| hours_weekday    | 8:00 - 20:00                         |
| hours_saturday   | 9:00 - 14:00                         |

## services

Example services so the booking flow works out of the box.

| Name                   |
| ---------------------- |
| Consulta               |
| General Consultation   |
| Follow-up Visit        |
| Online Appointment     |

## Notes

- The `email` field on `site_config` is validated as a proper email address; free-text placeholders are rejected.
- "Consulta" was a pre-existing service; the other three were added as part of issue #22.
