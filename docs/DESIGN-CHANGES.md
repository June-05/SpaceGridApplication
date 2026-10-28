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
