# Coach Loop v120 Update Notes

Published: November 2026  
Governing rule: prescription ≠ result; nothing invented or silently dropped; FITLOG v3 remains the AI-facing format; phone behavior remains the deciding test.

---

## 1. Overview

Release `v120` fixes the iOS Safari / Home Screen PWA date-field overflow that remained after the v119 grid-width changes. The underlying issue is WebKit's native temporal-input appearance applying a locale-dependent intrinsic minimum width and changing the effective box sizing after the author stylesheet.

## 2. Changes

- **Disable the problematic native CSS appearance for date fields:** Add both `-webkit-appearance: none` and `appearance: none` to `input[type="date"]`, allowing the declared width, minimum width and border-box sizing to take effect.
- **Keep the native date input and picker:** The control remains `type="date"`; no custom JavaScript date picker or text-field conversion is introduced.
- **Stabilize the date value and field height:** Left-align the WebKit date value, reserve a line of height for empty controls, and reset internal datetime-edit padding.
- **Keep the existing schedule grid constraints:** The PT event and training-period grids remain single-column on narrow screens and retain their desktop layout.
- **Add regression coverage:** Tests assert the iOS appearance override, width constraints, date-value minimum height and WebKit internal padding reset. The release stamp is updated to v120.

## 3. Scope and compatibility

- No workout data, backup schema, FITLOG format, training calculations, or local-storage behavior changes.
- Date inputs remain browser-native. The appearance override changes field rendering, not the input type or its native picker behavior.
- This CSS workaround addresses the reported iOS WebKit sizing behavior. Automated desktop WebKit checks are not equivalent to testing on a physical iPhone or an installed Home Screen PWA.

## 4. Verification

The GitHub Pages release workflow is the publication gate. It runs TypeScript, ESLint, the complete test suite, production build, PWA generation, PWA behavior checks, and Playwright WebKit smoke tests before deploying. Results will be recorded here after the workflow completes.

A physical iPhone check is still required to confirm the exact Home Screen PWA rendering on the target iOS version.
