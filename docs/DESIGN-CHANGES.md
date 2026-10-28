# SpaceGrid · Design changes log

Add a new section here whenever the design (classes, tables, endpoints, pages) changes.

---

## 2026-10-28 · Public homepage and lease requests

### Why
`static/homepage.html` was a Tailwind prototype for browsing available spaces ("blocks") to rent. It had hard-coded data, a fake user and no route. It is now part of the project and works with the real database.

### Homepage prototype vs. the project

| Prototype | Project before | Now |
|---|---|---|
| 14 hard-coded properties in JavaScript | Properties only visible to their landlord | `GET /api/browse` returns real ACTIVE properties that have AVAILABLE units (public, no login) |
| "Blocks available" count | No such idea | **Block = one AVAILABLE unit.** `availableBlocks` = number of AVAILABLE units |
| Price "₱90 – ₱150 / sq.m daily" | Rent is a monthly `rental_rate` per unit | Card shows `minRate – maxRate` per month across the free units |
| Types: Commercial Lot, Night Market, Building, Open Space | APARTMENT, CONDOMINIUM, TOWNHOUSE, COMMERCIAL | Added `NIGHT_MARKET` and `OPEN_SPACE`. Filter lists all 6 types (Building/Complex is covered by Apartment / Condominium / Townhouse) |
| "Commercial Ready" toggle (permits and power) | Nothing about permits | **"Power included"**: at least one free unit has `includes_electricity`. Permits are not modelled, so that line was dropped |
| "Min. avail blocks" slider fixed at 0–100 | – | Slider max = the biggest block count in the data |
| "Switch to Landowner" fake button | Role comes from the account | Role shortcut: guest → "List your space" (register), landlord → "My workspace", renter → "My leases" |
| Fake user "Maria S." and dead menu links | Real session (`/api/auth/me`) | Real name and initials; menu: dashboard, My Requests, Log out. Guests see Log in / Register |
| "Saved Spaces" menu item (did nothing) | – | Heart on each card and a "Saved" button. Kept **in the browser only** (localStorage), no table |
| "Book Blocks Now" (an alert) | Renters had no browsing page; the landlord typed a username | **Lease requests** (below) |
| Sort: Recommended / price / availability / newest | – | Same. "Recommended" puts saved spaces first |
| Search by name, location, owner | Dashboard search on landlord's own properties | Same fields: name, address, landlord's full name |
| No XSS protection (names put into `innerHTML`) | – | All text is escaped in `homepage.js` / `requests.js` |
| Tailwind CDN + Font Awesome + Google Fonts | Plain HTML/CSS/JS only | **Kept on purpose, homepage only.** Needs internet. All other pages still use `base.css` |

### Routing
`config/WebConfig` (new package `config`) maps: `/`, `/home`, `/browse` → `homepage.html`; `/login` → `login.html`; `/register` → `register.html`; `/requests` → `requests.html`. The `.html` addresses still work. `/index.html` (old welcome page) still exists and links to the homepage. After login, `?next=` returns to the page; the homepage uses `/?space=ID` to reopen a space's details.

### Database (`database/spacegrid_db.sql`: re-run it by hand)
- `properties.property_type` CHECK now also allows `NIGHT_MARKET`, `OPEN_SPACE`.
- New table `lease_requests` (id, rentable_unit_id, renter_id, desired_start, months 1–60, message ≤ 500, status PENDING/APPROVED/DECLINED/CANCELLED, decided_at, created_at). Calculated column `pending_key` + UNIQUE: one PENDING request per renter per unit.
- New view `lease_request_details` (adds unit, property, renter names, rate, landlord id).
- Sample data: properties 4 (Night Market) and 5 (Open Plaza), zones 14–20, 4 sample requests.

### New classes
- model: `RequestStatus` (enum), `LeaseRequest` (entity), `PropertyListing` and `UnitListing` (read-only records for the homepage). Model total 26 → 30.
- dao: `LeaseRequestDao`, `JdbcLeaseRequestDao`. `PropertyDao` gets `findActiveListings()` and `findActiveListingById(id)`.
- service: `LeaseRequestService`. `PropertyService` gets `getListings()` and `getListing(id)`.
- controller: `BrowseController` (public), `LeaseRequestController`.
- config: `WebConfig`.
- Also finished while needed: `JdbcRentableUnitDao` (`findById`, `findByPropertyId`, row mapper, `loadPositions`), `User.isLandlord()` / `isRenter()`, `format.date` / `format.badge`.
- Totals: 64 → 74 Java classes.

### Endpoints

| Method + URL | Who | Purpose |
|---|---|---|
| `GET /api/browse` | public | All listings (with their free units) |
| `GET /api/browse/{id}` | public | One listing; 404 if not ACTIVE or no free unit |
| `GET /api/lease-requests` | any logged in | Renter: own requests. Landlord: requests for own properties |
| `POST /api/lease-requests` (`unitId`, `startDate`, `months`, `message?`) | RENTER | Create. 409 if unit not AVAILABLE or already requested; 400 for past date / bad months |
| `POST /api/lease-requests/{id}/approve` · `/decline` | LANDLORD owner | PENDING only. Approve also needs the unit still AVAILABLE |
| `POST /api/lease-requests/{id}/cancel` | RENTER owner | PENDING only |

### Pages
New: `homepage.html`, `requests.html` (+ `js/pages/homepage.js`, `js/pages/requests.js`). Changed: landlord dashboard (link + 2 type options), property form (2 type options), renter dashboard (links), `index.html` (link), `base.css` (layout classes for the top bar / card grid / badge, which were still TODO), `zones.css` (request badges).

### Decisions made with the owner
1. Block = number of AVAILABLE units.
2. Add the new types to the enum (not replace the old ones).
3. "Book" = a real lease request feature.
4. Keep Tailwind on the homepage.

### Not done yet / follow-ups
- **Approving does not create the lease.** `LeaseService.create` is still a TODO. When it exists, `lease-form.js` should read `?requestId=` (the "Create lease" button on `requests.html` already links there) to prefill renter and dates.
- `SpaceGrid-Phase1-ClassDiagram.drawio` and `SpaceGrid-Phase2-ERD.drawio` are **not updated** yet (new classes, `lease_requests` table).
- The rest of the TODO list in CLAUDE.md is unchanged.

### How it was checked
Compiled with Maven (offline, JDK 25). Loaded the SQL into a scratch database, started the app on port 8099 against it, and called the endpoints with `curl` as guest, renter and landlord (success cases plus 400/401/403/404/409 cases). The pages were **not opened in a browser** by Claude; check them by hand (see the test steps in the reply).

---

## PROPOSED (not built) · Commercial ready, permits, bigger grid with zoom

Status: **decided, not implemented.** Nothing below exists in the code yet. When a part is built, move it into a dated section above and update the docs listed at the end.

### Decisions (all defaults accepted)
1. Grid cap rises from 30×30 to **60×60**.
2. Commercial ready = **two landlord-set flags** on the property (not computed).
3. Permits are **attached to each request** (not a reusable renter profile).
4. Permit types: **Business permit** (always) + **Food / Sanitary permit** (food businesses only).
5. Permit files are stored **in a folder on disk**, outside `static` (not in the database).
6. A permit that expires before the lease ends only **warns** the landlord; it does not block approval.

### A. Zoom and bigger grid (smallest, independent; build first)
- `Property.MAX_GRID_SIZE` 30 → 60; `properties` CHECKs for `grid_rows` / `grid_columns` 1–30 → 1–60 (TINYINT is enough). The renderer redraws every cell on each change, so do not go above 60 without partial redraws.
- `grid-renderer.js`: lower the 30 px minimum cell so "fit to width" can shrink big grids. Add zoom −/+, slider with %, **Fit to screen**, Ctrl+wheel; remember the zoom in `localStorage`.
- Below ~16 px: hide cell labels (show as tooltip) and scale wall thickness (`--edge`) with the cell size.
- Pan by dragging (space bar or middle mouse). Add a **rectangle fill** tool for painting large areas.
- Same zoom on the read-only grid in `lease.html`.
- No endpoint changes; no data changes beyond the size cap.

### B. Commercial ready flags
- `properties` gets `commercial_ready BOOLEAN` and `permits_required BOOLEAN` (both default FALSE; the property form defaults `permits_required` on when the type is COMMERCIAL, NIGHT_MARKET or OPEN_SPACE). Only commercial types may set them.
- `Property` gets both fields with getters and an `updateCommercialSettings(...)` method; the create/update endpoints take them as optional params; `PropertyListing` exposes them.
- Homepage: "Commercial ready" badge on cards; the **Power included** toggle stays and a **Commercial ready** toggle is added next to it.

### C. Business / food permits with manual landlord review
**Flow:** renter picks a block → if the property has `permits_required`, the form asks business name + Food / Non-food → renter uploads the required permits → landlord views each file and marks it Approved / Rejected with a note → a rejected permit is re-uploaded (the request stays PENDING, shown as "Needs documents") → the landlord can approve the request only when every required permit is Approved → creating the lease stays a separate step.

**Rules**
- Required: Business permit always; Food / Sanitary permit when the business is Food.
- Each permit has a number, an expiry date and one file (JPG, PNG or PDF, max 5 MB).
- Expiry must be after the requested start date (400). If it is before the lease end, the landlord sees a warning only.
- Permits can only be added or replaced while the request is PENDING.
- Manual check only: no lookup against any government system.
- Only the renter and the property's landlord can open a file, through a login-checked endpoint. Files are never reachable by a static URL.

**Data**
- New table `request_permits`: id, request_id (FK), permit_type (BUSINESS / FOOD_SANITARY), permit_number, expires_on, original_name, stored_path, content_type, status (PENDING / APPROVED / REJECTED), reviewer_note, reviewed_at, created_at. One current permit per type per request.
- `lease_requests` gets `business_name VARCHAR(100)` and `business_category` (FOOD / NON_FOOD), both nullable.

**Model / code (names are proposals)**
- model: `PermitType`, `PermitStatus` (enums), `RequestPermit` (entity, with `approve()`, `reject(note)`, `replaceFile(...)`). `LeaseRequest.approve()` needs the permit check, so `LeaseRequestService.approve` loads the permits and refuses with `ConflictException` ("Some permits are not approved yet.").
- dao: `RequestPermitDao` + `JdbcRequestPermitDao`. service: `PermitService` (upload, review, open file) or added to `LeaseRequestService`. controller: `PermitController`.
- File storage: a configurable folder (new `application.properties` key, e.g. `spacegrid.permit-dir`), files saved under generated names; multipart limit 5 MB.

**Endpoints (proposed)**

| Method + URL | Who | Purpose |
|---|---|---|
| `POST /api/lease-requests/{id}/permits` (multipart: `type`, `permitNumber`, `expiresOn`, `file`) | RENTER owner | Add or replace a permit while PENDING |
| `GET /api/lease-requests/{id}/permits` | renter owner or landlord owner | List permits with status and notes |
| `GET /api/permits/{permitId}/file` | renter owner or landlord owner | Download / view the file |
| `POST /api/permits/{permitId}/approve` · `/reject` (`note`) | LANDLORD owner | Review one permit |

`POST /api/lease-requests` also gets optional `businessName` and `businessCategory`.

**Pages**: `homepage.html` request form gets the business fields and a note that permits are uploaded next; `requests.html` shows the permit list, upload buttons (renter) and View / Approve / Reject (landlord); the Approve button is disabled until all required permits are approved.

**Design exceptions to record when built:** the first multipart endpoint (the "simple request params" convention does not cover files); the first sensitive data in the project (access limited to the two people above).

### Suggested build order
A (zoom) → B (flags) → C (permits). C also touches `lease-form.js`, which is still a stub, and depends on `LeaseService.create` for the full flow.

### Docs to update when built
`CLAUDE.md` (business rules, size cap, upload exception), `SpaceGrid-Phase1-Spec.md` (new classes, endpoints, `MAX_GRID_SIZE`, counts), `SpaceGrid-Phase3-FileStructure.md` (files and pages), `HOW-TO-CONNECT.md` (multipart example, JSON shapes), `spacegrid_db.sql`, and the `.drawio` class diagram and ERD (already behind).
