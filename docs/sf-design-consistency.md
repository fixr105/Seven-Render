# Seven Fincorp design consistency

Checked after the `sf-*` rollout. This is a list of leftovers. It does not change them.

Icons in the shell, dashboards, calculator, and payouts are Lucide. No Heroicons, Font Awesome, Tabler, or react-icons imports are in `src`.

## 390px

Logged in as a client on localhost:3000.

- Dashboard, calculator, payouts, and applications: `scrollWidth` is 390. The sidebar is off-canvas (`translateX(-256px)`). Body is Lato 14px. Calculator fields and buttons are at least 44px tall. The applications table is the stacked card list.
- `/clients` and `/admin/user-accounts` render Access Restricted for this client. Both stay within 390px.
- The new-application top bar does not show the page name. The journey rail and the step heading do.

At 1280 the sidebar is a white panel, the active item is the navy text row, and the top bar is the short welcome line.

## Tests

- `JourneyRail.test.tsx`: 8 passed. `dealer-*` class names were not renamed.
- `LoginPage.test.tsx`: the navy-button assertion passed. `shows the English tagline` fails because the screen renders `t('common.tagline')` and that English string is not in the locale files. Login was not edited.
- `Ledger.test.tsx`: empty, loading, and payout-request tests passed. `M1-FE-001` still fails on `₹12,500`.

## Leftover colours

`tailwind.config.js` and `src/index.css` are the token source and are not listed again.

- `src/pages/Ledger.tsx:206` `bg-brand-primary/20 text-brand-primary`
- `src/pages/Ledger.tsx:572` spinner `border-brand-primary`
- `src/pages/Ledger.tsx:947`, `:1009`, `:1053` `focus:ring-brand-primary`
- `src/pages/dashboards/ClientDashboard.tsx:75` chart gradient `#080B53` (on palette, hardcoded)
- `src/components/ui/DataTable.tsx:52` spinner `border-brand-primary`
- `src/components/ui/Input.tsx`, `Select.tsx`, `TextArea.tsx` still use `brand-primary` on the default tone
- `src/pages/NBFCTools.tsx` keeps `#332f78` and `#1a1a2e` on the tools chrome (27 colour hits)
- `src/pages/NewApplication.tsx` still uses `brand-primary` on the product picker
- `src/components/login/CursorWaveCanvas.tsx:130` canvas white `#FFFFFF`
- `src/auth/login-dealer.css` repeats the dealer hex values for the login field override

## Fonts

- `src/components/ui/TextArea.tsx:32` still has `font-inter` on the dealer label.
- Michroma is loaded in `src/index.css:2` and applied only by `.sf-page-title` (`src/index.css:91`) and `src/pages/NotFoundPage.tsx:13`.

## Radii outside `rounded-lg` and `rounded-[12px]`

`rounded-xl` remains on the client dashboard cards:

- `src/pages/dashboards/ClientDashboard.tsx:246`, `:261`, `:276`, `:304`, `:321`, `:383`, `:402`

Other `rounded-xl` / `rounded-2xl` hits are in the wizard and review components (`NewApplication.tsx`, `B2cEvDocumentsSection.tsx`, `CibilProbabilityBar.tsx`, `B2cEvComplianceReview.tsx`, `AddToHomeScreenModal.tsx`).

## Shadows outside `sf-shadow-*`

- `src/components/layout/TopBar.tsx:185` and `:261` `shadow-level-2` on the notification and profile menus
- `src/pages/dashboards/ClientDashboard.tsx:246`, `:261`, `:276`, `:304`, `:321`, `:383`, `:402` `shadow-sm`
- `src/pages/dashboards/CreditDashboard.tsx:88` `hover:shadow-level-2`
- `src/components/ui/DataTable.tsx:51`, `:60`, `:67` `shadow-level-1`
- `src/components/ErrorBoundary.tsx:52` `shadow-lg`
- `src/pages/AdminNBFCPartners.tsx:229` `shadow-lg` on the inline confirm dialog
- `src/pages/Applications.tsx:562` and `:574` `shadow-sm` on the filter chips
