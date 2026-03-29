# App Distribution Plan — consultorio-site

Research document for making consultorio-site distributable as a Fyso app template.

## 1. Current State

### Hardcoded Tenant References

The string `consultorio` appears as a hardcoded identifier in three categories:

**TENANT_ID constant** (3 files):
- `src/lib/api.ts:2` — `const TENANT_ID = 'consultorio'` (server-side SSR fetch)
- `src/lib/api-client.ts:2` — `const TENANT_ID = 'consultorio'` (client-side CRUD)
- `src/lib/auth.ts:2` — `const TENANT_ID = 'consultorio'` (login endpoint)

All three send `X-Tenant-ID: consultorio` to the Fyso API at `https://app.fyso.dev`.

**localStorage keys** (hardcoded prefix `consultorio_`):
- `consultorio_token` — JWT token (used in `auth.ts`, `api-client.ts`, `AdminLayout.astro`)
- `consultorio_user` — serialized user object (used in `auth.ts`, `AdminLayout.astro`)

**Other references**:
- `src/lib/cart.ts:8` — `const CART_KEY = 'consultorio_cart'`
- `src/pages/contacto.astro:96` — `sessionStorage.getItem('consultorio_site_config')`
- `src/components/react/LoginForm.tsx:50` — placeholder email `admin@consultorio.com`
- Fallback display text in layouts ("Consultorio" in titles, footer, sidebar logos)

### Environment Variables

Only one env var exists:
- `FYSO_API_TOKEN` — a developer publish-key used server-side by `src/lib/api.ts` for SSR data fetching (site_config, services, appointments at build time)

There is **no** `TENANT_ID` env var — it is hardcoded in source.

### Astro Configuration

`astro.config.mjs` uses `output: 'static'` — the site is fully static (SSG). All Fyso API calls happen at **build time** (SSR pages) or **client-side** (React admin components). There is no server runtime.

### How Auth Works

1. User submits email/password to `POST /api/auth/tenant/login` with `X-Tenant-ID` header
2. Response contains a JWT token stored in `localStorage` under `consultorio_token`
3. All subsequent client-side API calls attach `Authorization: Bearer <token>` + `X-Tenant-ID`
4. On 401 response, `handleUnauthorized()` clears localStorage and redirects to `/login`
5. No server-side auth — admin pages are client-rendered React components behind an `AdminGuard`

### How site_config Works

1. At build time, `Layout.astro` calls `fetchSiteConfig()` which hits the Fyso API
2. The config is baked into the HTML as a JavaScript variable via `define:vars`
3. A client-side `applySiteConfig()` function updates DOM elements with `data-sc` attributes
4. Fields: `clinic_name`, `clinic_slogan`, `address`, `phone`, `email`, `hours_weekday`, `hours_saturday`, `whatsapp`

Each Fyso instance tenant has its **own data**, so `site_config` records are already per-instance. The only issue is that `TENANT_ID` must point to the correct tenant at build time.

## 2. What Needs to Change for Multi-Tenant Support

### 2.1 TENANT_ID Resolution

**Current**: hardcoded string `'consultorio'` in 3 source files.

**Recommended approach**: single env var `FYSO_TENANT_ID` read at build time and injected into client code.

```
# .env
FYSO_TENANT_ID=consultorio
FYSO_API_TOKEN=fyso_pkey_...
```

- `src/lib/api.ts` reads `import.meta.env.FYSO_TENANT_ID` (already has access to env via Astro SSR)
- `src/lib/api-client.ts` and `src/lib/auth.ts` read `import.meta.env.PUBLIC_FYSO_TENANT_ID` (Astro requires `PUBLIC_` prefix for client-side env vars)
- Astro replaces these at build time, producing a static bundle with the tenant baked in

**Why not subdomain/path resolution at runtime?**
The site is static (SSG). There is no server to inspect the request hostname. Runtime resolution would require switching to `output: 'server'` or `output: 'hybrid'`, adding hosting complexity. Since each instance gets its own deployment, a build-time env var is the simplest and most robust approach.

**Trade-offs**:

| Approach | Pros | Cons |
|----------|------|------|
| **Env var at build time** (recommended) | Simple, no runtime overhead, works with static hosting (Netlify, Vercel, S3) | One build per tenant, tenant ID not switchable at runtime |
| Subdomain resolution | Single deployment for all tenants | Requires server mode, DNS config, CORS complexity |
| Path-based (`/tenant-slug/...`) | Single deployment | Requires server mode, URL rewriting, breaks relative paths |
| Config file per deployment | No code changes needed | Still one build per deployment, extra file to manage |

### 2.2 Environment Variables Per Instance

Each instance deployment needs:

| Variable | Purpose | Instance-specific? |
|----------|---------|-------------------|
| `FYSO_TENANT_ID` (new) | Tenant slug for API calls | Yes |
| `FYSO_API_TOKEN` | Developer token for SSR builds | Yes (each org has its own) |
| `PUBLIC_FYSO_TENANT_ID` (new) | Tenant slug for client-side JS | Yes (mirrors FYSO_TENANT_ID) |
| `PUBLIC_FYSO_API_URL` (new, optional) | API base URL | No (defaults to `https://app.fyso.dev`) |

### 2.3 localStorage Key Namespacing

Currently all localStorage keys are prefixed with `consultorio_`. For multi-tenant support, keys should be namespaced by tenant:

```
`${TENANT_ID}_token`
`${TENANT_ID}_user`
`${TENANT_ID}_cart`
```

This prevents collisions if a user accesses multiple instance sites on the same browser (unlikely but correct).

### 2.4 site_config Per Instance

**Already works.** Each Fyso instance tenant has its own `site_config` entity records with its own data. The `fetchSiteConfig()` call uses `X-Tenant-ID`, so as long as `TENANT_ID` is correctly set, each instance gets its own clinic name, address, phone, etc.

The fallback text in HTML ("Consultorio", "info@consultorio.com") is overridden at runtime by `applySiteConfig()`, so it only shows for a flash before hydration. This is acceptable but could be improved by using the build-time config to set initial values.

### 2.5 Auth Per Instance

**Already works.** The `POST /api/auth/tenant/login` endpoint uses `X-Tenant-ID` to scope authentication. Each instance tenant has its own user accounts. No changes needed beyond making `TENANT_ID` configurable.

### 2.6 BASE_URL

Hardcoded to `https://app.fyso.dev` in 3 files. Should be extracted to an env var with a default:

```ts
const BASE_URL = import.meta.env.PUBLIC_FYSO_API_URL || 'https://app.fyso.dev';
```

This allows self-hosted Fyso deployments in the future.

## 3. Seed Data for Source Tenant

The source tenant (the template) should include the following **schema** (entities + fields) that all instances inherit:

### Entities (already exist)
- `patients` — patient records
- `doctors` — professionals/providers
- `networks` — insurance providers (obras sociales)
- `services` — available services
- `specialties` — medical specialties
- `appointments` — scheduled appointments
- `site_config` — site configuration (clinic name, contact info, hours)

### Seed Data (pre-populated records)
The source tenant should include **minimal seed data** that instances can customize:

- **site_config**: 1 record with placeholder values (`clinic_name: "Mi Consultorio"`, generic address, etc.)
- **appointment statuses**: the status options are defined in `entity-config.ts` as a frontend enum, not in the database, so no seed data needed here
- **No sample doctors/patients/services** — each instance starts empty and adds their own

### Business Rules
Any scheduling rules, validation rules, or computed fields defined on the source tenant will be inherited by instances (schema is shared). The `instanceGuard` middleware ensures instances cannot modify these rules.

## 4. Future Code-Change Issues

### Issue A: Extract TENANT_ID to environment variable
**Priority: High — blocking for distribution**
- Replace hardcoded `'consultorio'` with `import.meta.env.FYSO_TENANT_ID` / `import.meta.env.PUBLIC_FYSO_TENANT_ID`
- Replace hardcoded `'https://app.fyso.dev'` with env var + default
- Update `.env.example` with new variables
- Estimated: 1-2 hours

### Issue B: Namespace localStorage keys by tenant
**Priority: High — blocking for distribution**
- Replace `consultorio_token`, `consultorio_user`, `consultorio_cart` with `${TENANT_ID}_token`, etc.
- Create a shared `storageKey(name)` helper
- Estimated: 1 hour

### Issue C: Remove hardcoded fallback text
**Priority: Medium**
- Replace "Consultorio" fallbacks in `Layout.astro`, `AdminLayout.astro`, `LoginForm.tsx` with build-time site_config values
- The `<title>` tag, sidebar logo text, and placeholder email should come from config
- Estimated: 1-2 hours

### Issue D: Create deployment documentation
**Priority: Medium**
- Document how to deploy an instance: create instance tenant, set env vars, build, deploy
- CI/CD template (GitHub Actions) that builds with tenant-specific env vars
- Estimated: 2 hours

### Issue E: Evaluate SSR/hybrid mode for multi-tenant single-deployment
**Priority: Low — future optimization**
- If many instances are created, building separate static sites for each becomes expensive
- Evaluate switching to `output: 'hybrid'` with dynamic tenant resolution
- This is a significant architectural change; defer until there is demand
- Estimated: 1-2 days

### Issue F: Instance provisioning automation
**Priority: Low — future**
- Script or API call to create an instance tenant, seed site_config, and trigger a build
- Integration with Fyso's instance creation API
- Estimated: 1 day

## 5. Recommended Approach

### Phase 1 — Make it distributable (Issues A + B + C + D)
1. Extract all hardcoded values to env vars
2. Namespace localStorage keys
3. Clean up hardcoded fallback text
4. Write deployment docs

**Result**: any developer can clone the repo, set `FYSO_TENANT_ID` and `FYSO_API_TOKEN`, and deploy their own instance.

### Phase 2 — Automate instance creation (Issue F)
1. Create a provisioning script that uses Fyso API to create an instance tenant
2. Auto-populate `site_config` seed record
3. Trigger build + deploy pipeline

### Phase 3 — Single-deployment multi-tenant (Issue E)
1. Switch to hybrid/server rendering
2. Resolve tenant from subdomain or path
3. Single deployment serves all instances

**Recommendation**: Start with Phase 1. It requires minimal changes (roughly 5 hours of work across 4 issues), keeps the static architecture, and unblocks distribution. Phase 2 and 3 are optimizations that depend on adoption volume.
