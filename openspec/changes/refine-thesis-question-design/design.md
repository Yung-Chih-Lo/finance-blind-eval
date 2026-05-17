## Context

The app already has a participant entry page, a profile form, and config-driven study copy. The missing work is not a visual redesign; it is research instrumentation. The page should make the research task legible before a participant starts, and the profile should collect enough non-identifying variables for later segmentation.

## Decisions

### D1: Keep demographics non-identifying

Use age ranges instead of exact age, and collect broad field/work-domain text instead of school, company, or name. This keeps the study more defensible and avoids storing unnecessary personal data.

### D2: Required profile fields include explicit opt-out choices

Age range includes `prefer_not_to_say`; subdomain familiarity includes `not_sure`. This preserves completion while distinguishing missing data from deliberate non-disclosure or low familiarity.

### D3: Shared profile validation

Put profile options and validation in `web/lib/evaluation/profile.ts`, then use it from both client and API code. This prevents the client and server from drifting as fields are added.

### D4: Incomplete existing profiles return to the profile form

Some local sessions or early pilot participants may have the old profile shape. The client should treat those profiles as incomplete and show the expanded form prefilled where possible.

## Risks / Trade-offs

- **More fields can increase dropout.** Mitigation: use select/checkbox inputs, no exact age, no free-form mandatory personal identifiers.
- **Old records will lack new columns.** Mitigation: CSV exports empty strings for missing legacy values rather than failing.
- **Runtime study copy may override repository defaults.** If `.data/platform-settings.json` exists in production, admins may need to reset or resave study copy after deployment for homepage text changes to appear.
