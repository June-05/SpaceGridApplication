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

## 2026-10-28 · Plotter sidebar: Eraser for walls & doors (UI only)

No change to classes, tables or endpoints. The stored edge types are still WALL / DOOR / WINDOW / OPEN.

- The Walls & doors tools are now **Eraser, Wall, Door, Window** (Eraser first, same look as the zone Eraser). **No wall** and **Automatic** were removed from the list.
- Eraser rule (`gridRenderer.applyEdgeTool`): on a line with an automatic wall it stores `OPEN`; on any other line it just deletes the manual override. The Wall tool on such a line removes the override, so the automatic wall comes back. Old saved `OPEN` edits still load (dashed grey lines).
- Tools work on click or drag, like the zone brush. No tool is selected at first; click the tool again or press Esc to put it down.
- **Reset all to automatic** now asks for confirmation (with the number of edits) and says "Nothing to reset" when there are none.
- Both tabs: numbered steps ("1. Pick…  2. Click or drag…"), a "Tool: …" note at the top of the sidebar, and the Add-a-unit form starts collapsed.
- Checked with a Node test of `applyEdgeTool` (18 cases) and syntax / element-id checks. Not tried in a real browser.

---

## 2026-10-28 · Plotter redesign: full-screen canvas, floating toolbar & panel, shortcuts, undo (UI only)

No change to classes, tables, endpoints or saved data.

- **Layout:** the grid fills the window on a dotted canvas. Floating on top: back + property name (top-left); Undo, Redo, unsaved dot, Save, ⋯ menu with Keyboard shortcuts / Show-hide panel / Reset walls / Log out (top-right); grid size + numbers (bottom-left); **toolbar** (bottom-center); zoom − 100% + with a menu (bottom-right).
- **Toolbar:** Spots | Walls, then the tools of that mode. Spots: Hand, Brush, Rectangle, Eraser + the current zone. Walls: Hand, Wall, Door, Window, Eraser. Both modes start on the **Hand** (drag pans, nothing is edited); Esc goes back to it. The old Brush/Rectangle switch is now the Brush and Rectangle tools; Shift + drag also makes a rectangle with the Brush or the Eraser.
- **Zones panel** (was the right sidebar): floating, drag by its header, minimize with the button or `\`, double-click the header to dock it back. Position and minimized state are remembered in the browser. Starts minimized on screens under 760 px. Zones show their 1–9 key; a filter box appears with more than 8 zones; + Unit / + Common area open small forms in the panel. In Walls mode it shows a legend and Reset all to automatic.
- **Grid size:** a popover from the size button (or G) with − / + steppers, a dashed outline of the new size on the grid, and a note on what shrinking removes. Same 60 × 60 limit and confirm as before.
- **Zoom:** − / + buttons and a menu (Zoom to fit, 50%, 100%, 200%). The slider was removed. Ctrl + wheel still zooms around the mouse.
- **Undo / redo:** one step per stroke, rectangle, resize or wall reset (max 100). "Unsaved" is measured against the last saved layout, so undoing back to it clears the dot. Adding a unit/common area is saved at once and is not undone. New `gridRenderer.snapshot`, `restore`, `sameSnapshot`.
- **Keyboard shortcuts** (one `SHORTCUTS` list in `property-grid.js`; press `?` for the list): S / W modes · H B R E tools · 1–9 zone (Walls: 1 Wall, 2 Door, 3 Window) · Shift + drag rectangle · Alt + click pick a zone · Space / middle mouse pan · + − zoom · Shift+1 or 0 fit · Shift+0 100% · Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y · Ctrl+S save · G grid size · `\` panel · Esc.
- **Files:** `property-grid.html` and `property-grid.js` rewritten; new `css/plotter.css` and `js/common/floating-panel.js`; plotter-only rules moved out of `grid.css` (`lease.html` keeps what it uses).
- **Checked:** a jsdom run of the real page (46 checks: tools, keys, painting, rectangle, eraser, eyedropper, walls, size popover, undo/redo, save requests, dialog, panel, zoom menu, menu reset, add unit), plus the earlier renderer tests. Not tried in a real browser: drag of the panel, look of the tooltips and popovers, touch.

---

## 2026-10-28 · Plotter fixes + common-area colors (design change)

**Design change (approved): common areas can have their own color.** Units keep their status colors.
- Table `common_areas`: new column `color CHAR(7) NULL` (`#rrggbb`, NULL = the type's default) with a CHECK. **Re-run `spacegrid_db.sql`.**
- `CommonArea`: field `customColor`, a "new" constructor with a color, `getCustomColor()`, `changeColor(color)`; `getColor()` = picked color, else the type default. JSON gains `customColor`.
- `CommonAreaDao.updateColor(zoneId, color)`; `JdbcPropertyDao` reads `c.color`.
- `CommonAreaService.addCommonArea(..., color)` and `changeColor(propertyId, areaId, landlord, color)`. Rule: the color must differ from every other common area's color in the same property and from the 4 unit status colors → 409 ("That color is already used by Patio."). Other properties may reuse it.
- Endpoints: `POST /api/properties/{id}/common-areas` takes an optional `color`; new `PUT /api/properties/{id}/common-areas/{areaId}/color` (form field `color`).
- `Property.getCommonAreas()` (was a TODO) is now implemented, because the color rule needs it.

**Plotter (UI only):**
- Panning works even when the grid is small: the grid sits in a "world" with half a window of room on every side.
- The toolbar is always **Spots | Walls · Hand · Brush/Rectangle · Eraser · Preview**, so it no longer shifts between modes. The tools are shared by both modes: in Walls mode the Brush draws the Wall/Door/Window picked in the panel, the **Rectangle draws it all around an area**, and Eraser + Shift + drag clears every line in an area.
- **Brush/Rectangle** is one button: clicking it again (or B) switches between them, with the icon swapping, a ⇄ badge, a big "Rectangle"/"Brush" label flashing above the toolbar and the hint changing. R goes straight to Rectangle.
- **Preview** (was the current-zone chip): shows what is selected; with the Hand it shows what is under the mouse (zone, status/type, rate, spot count, or the line's wall/door/window). Clicking it opens the panel and scrolls to + flashes the selected item.
- Panel: **+ Unit / + Common area** sit at the top and stay put; the lists scroll under them. Both lists start with the **Eraser**; the Walls list is Eraser, Wall, Door, Window (same look as zones). A common area's swatch opens a color picker.
- **Add dialogs** (popups) with a live preview tile. Common areas get a 16-color palette (status colors left out): colors already used are disabled ("Used by Walkway"), plus a custom color; the type's default is suggested when it is free.
- **Resize**: drag handles on the grid's right edge, bottom edge and corner (live "rows × cols" badge, shrink still asks, one undo step); the bottom-left button is now a tinted "Resize grid · 24 × 30". The handles sit **one tile (at least 14 px) outside** the grid, with a dashed guide line on hover, so they never overlap cells or the outer walls you draw. The new size = the starting size + how far you dragged. There are bars on **all four sides** (plus the bottom-right corner): the top and left bars add or remove rows/columns at the top/left, and the drawing moves with them (`gridRenderer.resizeLayout` shifts the spots and wall edits; what falls outside is dropped after the usual confirm; one undo step).
- Not changed: the words "Zones" and "spots" (the rename was dropped).
- **Bug fix:** holding Space to pan no longer scrolls the canvas down. Holding a key repeats `keydown`, and only the first one was stopped; now every Space keydown is stopped (outside text fields).

**Checked:** Maven build + tests; live API run on a scratch copy of the database (create with/without color, duplicates in the same property → 409, same color in another property → 200, status color → 409, bad hex → 400, other landlord → 403, area of another property / a unit id → 404, the DB CHECK); Node tests of the rectangle line helpers and the earlier renderer tests; a jsdom run of the real page (43 checks). Not tried in a real browser: the look of the dialogs, palette, handles and flash label.

---

## 2026-10-28 · Delete / archive units, delete common areas, unit legend (design change)

**Unit removal rules** (decided with the owner: delete or archive is decided for the landlord, open requests are auto-declined):

| Unit has… | Result |
|---|---|
| an ACTIVE lease (running or upcoming) | Neither delete nor archive (409): "End or terminate it first." |
| past leases only | Archive only: status ARCHIVED, spots cleared, leases and payments kept |
| never been leased | Delete for good |
| open lease requests (PENDING / APPROVED) | Declined in the same transaction (delete and archive) |

**Design changes** (re-run `spacegrid_db.sql`):
- `lease_requests.rentable_unit_id` is now NULL-able with `ON DELETE SET NULL` (was RESTRICT), and two new columns `unit_label`, `property_label` keep the names from when the request was made. The view `lease_request_details` uses LEFT JOINs and falls back to those names. Checked on MariaDB 10.4: the SET NULL works next to the `pending_key` generated column.
- `LeaseRequest.unitId` is an `Integer` (null = unit removed) with `isUnitRemoved()`; JSON gains `unitRemoved`. `requests.html` shows "This unit was removed by the owner." and no "Create lease" for those.
- New value object `UnitRemovalCheck(canDelete, canArchive, openRequests, reason)` and endpoint `GET /api/units/{id}/removal-check`.
- `LeaseRequestDao.countOpenByUnitId`, `declineOpenByUnitId`; `RentableUnitService.removalCheck`.
- Now implemented (were TODO): `DELETE /api/units/{id}`, `POST /api/units/{id}/archive`, `DELETE /api/common-areas/{id}`, `RentableUnitService.archiveUnit/deleteUnit`, `CommonAreaService.deleteCommonArea`, `RentableUnit.archive`, `Property.archiveUnit/removeZone`, `JdbcRentableUnitDao.update/deleteById`, `JdbcCommonAreaDao` row mapper / `findById` / `findByPropertyId` / `deleteById`, `JdbcLeaseContractDao` row mapper / `findActiveByUnitId` / `existsByUnitId`.

**Plotter:**
- A trash button on every zone row (on hover / keyboard focus; always on touch), and the **Delete** key for the selected zone, open a dialog: common area → Delete; unit → the server's check decides Delete (with "N open lease requests will be declined"), Archive (with the reason), or only the reason. Saved at once.
- After a delete/archive the zone's spots are removed from the layout **and from every undo/redo snapshot**, so undo or Save can't bring them back.
- **Unit colors legend** (bottom-left, above Resize grid): Available / Occupied / Under maintenance with counts; collapsible (header or **L**), remembered in the browser.
- The numbers ("4 × 6 · 9/24 spots · 2/2 units placed · 3 wall edits") moved under the property name (top-left); the Resize grid pill no longer hides them.
- Fixed the common-area color icon: it was an invalid CSS `background` (a color before a gradient), so the badge rendered as an empty ring. It is now a square swatch with a small pencil badge.

**Checked:** Maven build + tests; live API on a scratch DB (never-leased unit with requests → deleted, requests declined with unit NULL and names kept; past-lease unit → delete 409, archive 200, spots cleared, lease kept, request declined; active lease → both 409; common area delete; 403/404/401 cases; new requests store the name copies); a jsdom run of the real page (101 checks, incl. undo after delete); the renderer tests. Not tried in a real browser: the look of the dialog, legend and icon.

**Next (TODO, not built):** lease timing markers on the plotter: a dot on occupied units for "Expiring soon" (30 days or fewer) or "Upcoming", plus a legend row. Needs each unit's lease state in the grid page's data, after the lease methods are done.

---

## 2026-10-28 · Edit units and common areas from the plotter (no design change)

Uses the endpoints that were already in the spec (they were TODO): `PUT /api/units/{id}`, `POST /api/units/{id}/maintenance`, `PUT /api/common-areas/{id}`. Implemented: `RentableUnit.updateDetails / changeRate / markAvailable / markUnderMaintenance`, `CommonArea.changeType`, `RentableUnitService.updateUnit / setUnderMaintenance`, `CommonAreaService.updateCommonArea`, `JdbcCommonAreaDao.update`, the three controller methods. (Small change: `setUnderMaintenance` now returns the unit; the endpoint still returns nothing.)

- Rules: archived units can't be edited (409); the rate can't be negative (400); "Under maintenance" can't be switched on for an occupied unit (409); switching it off only moves UNDER_MAINTENANCE → AVAILABLE. **Changing a unit's rate does not change existing leases** (their rent is fixed); it is the rate for new leases. Changing a common area's type keeps its picked color; indoor/outdoor (and so the automatic walls) follows the new type.
- Plotter, Edit state: a **pencil** on every unit and common-area row (next to the trash) and the **Enter** key (when no button or field has the focus) open the add dialog in edit mode, prefilled ("Edit unit" / "Edit common area", "Save changes"). The unit form has a new optional **size description** (used when no area is given) and, when editing, an **Under maintenance** switch (disabled with a note for occupied units; the preview turns amber). Common areas: name, type and color (its own color selectable, the others' disabled). Saved at once, not undoable.
- Plotter, View state: an **Edit unit** button in the details card opens the same dialog; the card refreshes after saving.
- **Number fields** (rate, area, here and on the units / property / lease forms): `step="any"` so the arrows move by 1, any decimals can be typed; in the plotter the value is rounded to 2 decimals when leaving the field (`12.5` → `12.50`).

**Checked:** Maven build; live API on a scratch DB (edit name/rate/size/utilities with spots unchanged; approximate size; 400 for negative rate / blank name / bad type; maintenance on/off and 409 when occupied; 409 for an archived unit; the occupied unit's lease rent stays 12000 after its rate changes; common area rename + type change becomes indoor; a picked color survives a type change; 403 / 404); jsdom: 28 edit checks + the View (41) and Edit (101) suites. Not tried in a real browser.

---

## 2026-10-28 · Plotter View mode: select units, see details (design change)

The plotter now has two states. **View** opens first; **Edit** is the editor as before.

**Design change:** new endpoint `GET /api/units/{id}/details` (landlord owner) → new value object `UnitDetails(unit, currentLease, openRequests)` (`RentableUnitService.getUnitDetails`). `LeaseContract.getCurrentState`, `daysRemaining`, `getDaysRemaining` and `isRenewal` are now implemented (they were TODO and Jackson calls the getters): ENDED / TERMINATED / RENEWED from the status, otherwise UPCOMING, EXPIRED, EXPIRING_SOON (30 days or fewer) or ACTIVE by date.

**View mode:**
- A `View | Edit` switch in the top-right pill (keys **E** from View, **V** from Edit). `?mode=edit` opens Edit directly; the dashboard's "Edit Layout" links use it.
- In View the drawing toolbar, Resize pill, resize handles, wall click lines and Undo/Redo are hidden; Save shows only for unsaved edits (they stay visible in View). A hint pill: "Click a unit to see its details · drag to move around · E to edit".
- Drag pans; a click (less than 4 px of movement) on a unit selects it, outlines it and dims the rest; a click elsewhere clears it. Esc: details → list → legend highlight.
- Panel "Units": a search box (Enter picks the first match) and the list of units; picking one zooms to it (fits its spots in the free area left of the panel). The details card: status, monthly rate, size, power/water, spots; the current lease (renter, period, rent, state badge, days left / start date) or "No current lease"; open lease requests with a link to requests.html; "← All units".
- Legend rows are buttons in View: one keeps the units with that status bright (renderer option `highlightZoneIds`) and filters the list; again clears it.
- Shortcuts carry the modes they work in; the `?` dialog tags the ones that work in View.

**Checked:** Maven build; live API on a scratch DB (Active 215 days left; Expiring soon 18 / 12 days; Upcoming; Expired with 0 days; no lease with 1 open request; 403 / 404 / 401); jsdom: 41 View checks and the 101 Edit checks; renderer tests. Not tried in a real browser.

---

## 2026-10-29 · Merged the `landlord` branch (UI only, no design change)

The teammate's branch `landlord` (`16b44a9`, details in `landlord.txt`) redesigns the landlord pages as Tailwind mock-ups: `dashboard.html`, `units.html`, `leases.html`, `lease-form.html`, `property-form.html`. They have sample data, inline JavaScript (filters, pagination, modals, calculators) and relative links, and they don't call the API yet.

How the merge was resolved:
- **`application.properties`**: kept **port 3306** (the branch had changed it to 3307 for the teammate's XAMPP). Use the `SPRING_DATASOURCE_URL` environment variable for another port (see CLAUDE.md).
- **`dashboard.html`, `units.html`, `lease-form.html`, `property-form.html`** (conflicts): took the teammate's version. Re-applied main's two fixes only:
  - number fields `step="any"` (units `modalRent`, lease-form `monthlyRent` / `securityDeposit`, property-form `defaultRate` / `totalArea`)
  - the units page's "Edit Grid Layout" link → `property-grid.html?id=1&mode=edit` (the plotter needs an id; 1 is a placeholder until the page is wired)
  - Links were left relative, as the teammate wrote them.
- **`leases.html`**: merged cleanly (only the branch changed it).
- **`property-grid.html`** (conflict): kept main's redesigned plotter. The branch's "Edit Property Details" header link became an item in the plotter's ⋯ menu, which opens `/landlord/property-form.html?id=<this property>`.
- Main's old dashboard "Edit Layout" links (`&mode=edit`) are gone with the old dashboard; the plotter is now reached from the units page.

**Next (TODO):** wire the mock-ups to the API and the login check, with real ids in their links (CLAUDE.md, TODO 1).

---

## 2026-10-29 · Landlord pages: login landing, role separation, plotter button (UI only, no design change)

- **Login landing:** `login.js` follows `?next=` only when it fits the role (`fitsRole`): landlords only for `/landlord/...` pages, renters for anything else. A landlord who logs in from the homepage now lands on `/landlord/dashboard.html`, not the homepage. The homepage's guest "Log in" link is plain `/login.html` (the "Log in to request" link still returns renters to the listing).
- **Accounts stay separate:** removed "Switch to Renter View" from `landlord/dashboard.html`. All 5 mock-up pages load `api.js` + `auth.js` and call `auth.requireLogin('LANDLORD')` in `<head>`, so a renter or guest is sent away. The dashboard's Log Out calls `auth.logout()` (it used to just open `../index.html`, leaving the session logged in).
- **Plotter button:** "Edit Grid Layout" → **"View/Edit Grid Layout"**, linking to `property-grid.html?id=1` without `&mode=edit`, so the plotter opens in View (its first state). The id is still a placeholder until the page is wired.

---

## 2026-10-29 · "Block" wording changed to "Unit" (on-screen text only, no design change)

The teammate's landlord mock-ups and the homepage said "Block". The project says **unit** everywhere (class `RentableUnit`, table `rentable_units`, `/api/units`), so the words on screen now match.
- Changed: landlord `dashboard`, `units`, `leases`, `lease-form`, `property-form` (e.g. "Total Units", "Units Leased", "Unit Management", "Default Rate per Unit", sample codes "Unit A-01"), the homepage (slider "Min. Avail Units", "Available units", "Send request for the selected unit") and `homepage.js` (badges "1 Unit Available" / "3 Units Available", filter pill "Units: ≥ n").
- **Not** changed (code, not wording): the JSON field `availableBlocks` from `/api/browse`, the element id `modalBlocks`, the JS variables `minBlocks` / `totalBlocks`, and Tailwind's `block` CSS class.
- `CLAUDE.md` glossary: the "block = one AVAILABLE unit" definition is gone; a free space is an AVAILABLE unit.
- Still to remove from the forms later (decided, not done): the "Total Units" input on the property form (the plotter decides the count) and the security deposit field.

---

## 2026-10-29 · Landlord pages connected to the project (design change)

### Why
The teammate's landlord pages (dashboard, units, leases, lease form, property form) only had sample data, and most of the backend behind them was still TODO. They are now real, and the owner approved these new details from the pages: street / city / region, a map pin (placeholder), a default rate per unit, amenities, property photos + site plans + unit photos, tenant contact details (free text, with the renter account still required), payment terms, a contract file and payment status. Dropped from the pages: security deposit and the "Total Units" input (the plotter decides how many units there are).

### Database (`database/spacegrid_db.sql`: re-run it by hand)
- `properties`: + `city`, `region` (NOT NULL; `address` is now the street), `default_rate` (NULL = none), `has_parking`, `has_power_backup`, `has_security`, `has_water_access`, `is_open_24h`.
- `lease_contracts`: + `payment_terms` (default `MONTHLY_ADVANCE`), `tenant_name` (NOT NULL), `tenant_email`, `tenant_phone`. `renter_id` stays required.
- New table `uploaded_files` (id, file_kind, property_id / unit_id / lease_id, file_name, stored_name, content_type, created_at). One table for every upload instead of a column per thing; a CHECK makes sure the owner column matches the kind. It cascades with its property, unit or lease.
- `lease_details` view: + payment_terms, tenant contact, `renter_username`, `unit_photo_id`.
- **Bug fix:** `zone_cells` only allowed rows/cols 0–29, so spots past row 30 on a 60 × 60 grid could not be saved. Now 0–59.
- Sample data: cities/regions, default rates, amenities, tenant contacts.

### New classes
- `model`: `Amenities` (record), `PaymentTerms` (enum: monthsPerPeriod, inAdvance), `FileKind` (enum), `StoredFile` (entity).
- `dao`: `StoredFileDao` + `JdbcStoredFileDao`. `UserDao.findRenters(search)`.
- `service`: `FileService` (saves files in the `uploads/` folder, `spacegrid.upload-dir`; checks types: JPG/PNG/WebP, PDF for site plans and contracts; 10 MB; 10 files per owner).
- `controller`: `FileController`.

### Changed classes
- `Property`: city, region, defaultRate, amenities, read-only coverPhotoId; `getFullAddress()`, `getCoverPhotoUrl()`. `updateDetails` refuses ARCHIVED properties; `publish` refuses ARCHIVED.
- `LeaseContract`: paymentTerms, tenantName/Email/Phone, read-only propertyId / renterUsername / unitPhotoId (`getImageUrl()`); billing periods: `billingPeriodStarts()`, `monthsInPeriod()`, `amountForPeriod()`; `dueDateFor()` follows the payment terms.
- `RentDue`: + `months`. `PropertyListing`: + `amenities`, `coverPhotoUrl`; its `address` is street, city and region together.
- `PropertyService`: needs `LeaseContractDao` + `LeaseRequestDao` (archive checks active leases and declines open requests); `publish`/`archive` return the property; + `getProperty(id)`.
- `LeaseService`: create/renew take payment terms and contact details; `endLease` only from the end date on (before that: terminate); + `getPropertyOfLease`, `findRenters`.
- `RentableUnitService`: needs `FileService` (deleting a unit removes its photos from disk). `getUnits` leaves archived units out.
- `SessionManager`: + `currentUserOrNull` (public photos).

### Endpoints
- Changed: `POST/PUT /api/properties` (+ city, region, defaultRate, parking, powerBackup, security, waterAccess, open24h), `POST /api/properties/{id}/publish` and `/archive` (return the property), `POST /api/leases` (+ paymentTerms, tenantName, tenantEmail, tenantPhone), `POST /api/leases/{id}/renew` (+ optional paymentTerms).
- New: `GET /api/renters?search=`, `GET /api/leases/{id}/property`, `GET/POST /api/properties/{id}/files`, `GET/POST /api/units/{id}/files`, `GET/POST /api/leases/{id}/files`, `GET/DELETE /api/files/{id}`.
- TODO bodies now written: properties list/create/update/publish/archive, units list, common areas list, every lease and payment endpoint, register.

### Pages
- The 5 landlord pages load `format.js` + their `js/pages/*.js` (the inline sample scripts are gone). Real ids in every link: `units.html?propertyId=`, `property-grid.html?id=`, `property-form.html?id=`, `leases.html?propertyId=`, `lease-form.html?unitId= / ?requestId= / ?renew=`.
- `lease.html`, `renter/pay.html`, `register.html` scripts written. The plotter pre-fills a new unit's rate with the default rate. The homepage shows cover photos and amenities.
- `api.upload(url, formData)` and `format.escape(text)` added.

### How it was checked
- Maven build; a live API run on a scratch database (75 checks: roles, owner checks, validation, the quarterly statement, paying in order, declines, renew/end/terminate, file access rules, a spot at (59, 59)).
- Every page in jsdom against the live server (51 checks: dashboard numbers and modal, inline rate edit, maintenance, property form save/publish, leases payment status, lease form with renter search, renewal, renter lease page, paying, register).
- The plotter suites (101 + 41 + 28) and the role checks still pass.

### Not done yet / follow-ups
- Class diagram and ERD (`.drawio`) still show the old fields: add the columns/classes above when the diagrams are next opened in draw.io.
- Map pin (placeholder only), lease timing markers on the plotter, unit tests.
- The PR #7 renter-dashboard escaping / try-catch items in CLAUDE.md.

---

## 2026-10-29 · Shared top bar and request notifications (UI only, no design change)

Phases 1–2 of the UI plan (see "Decisions" below). No Java, SQL or API change; it uses `GET /api/lease-requests`.

### Why
Every landlord page had its own top bar, and the renter pages had a different one, so the navigation kept changing. A landlord also had no way to notice a new lease request, and `requests.html` was only reachable from the homepage menu.

### What changed
- **`js/common/nav.js` (new):** a page has `<header id="appNav" data-page="units">`; the script builds the bar. Landlord: Dashboard · Units · Leases · Requests. Renter: Browse spaces · My Leases · My Requests. It adds a bell with a number badge and a user menu with Log Out. It remembers the last property (`localStorage.lastPropertyId`) so "Units" reopens the one you were on.
- **Bell:** landlord = number of `PENDING` requests. Renter = requests decided (approved or declined) after the newest `decidedAt` they had seen (`localStorage.requestsSeenAt`, set when `requests.html` opens; per browser only). Refreshes every 60 seconds.
- **Landlord pages** (`dashboard`, `units`, `leases`, `lease-form`, `property-form`): the old header is replaced by the shared bar. Their search boxes and main buttons (Add New Property, Create New Lease, property selector, View/Edit Grid Layout, the property form's Save / Publish / Archive) moved into the page, under the title, with the same element ids, so the page scripts still work. The dashboard also shows an amber "N lease requests are waiting" card.
- **`requests.html` + `requests.js`:** rebuilt in Tailwind with the shared bar. A landlord opens on the *Pending* filter (pending first); after Approve the list switches to *All* so "Create lease" is visible. `css/renter-css/request.css` is no longer used by this page.
- **Homepage and plotter:** the homepage profile menu says "Lease Requests" with a pending count for landlords. The plotter's ⋯ menu gains Units list, Leases and Lease requests.
- Still on the old look until later phases: `renter/dashboard.html`, `renter/pay.html`, `lease.html`.

### How it was checked
`nav-test.js` (23 checks: links per role, active link, badges, escaping, seen/unseen logic, moved elements), `role-test.js`, `landlord-pages-test.js`, and the plotter suites (101 + 41 + 28).

---

## 2026-10-29 · Lease lifecycle: auto-expiry, termination reason, lease page redesign (design change)

Phase 3 of the UI plan. Decided with the owner: expired leases end **automatically** and both sides are told what to do next; terminating asks for a **reason** the renter can see; "Contract Status" is renamed **"Lease Status"**.

### Why
A lease past its end date stayed ACTIVE (shown "Expired (not ended yet)") until the landlord pressed End, so the unit stayed OCCUPIED and off the homepage. A terminated renter didn't know why.

### Database (`database/spacegrid_db.sql`: re-run it by hand, or run these lines on an existing `spacegrid_db`)
```sql
ALTER TABLE lease_contracts
    ADD COLUMN termination_reason VARCHAR(255) NULL AFTER closed_on,
    ADD COLUMN ended_automatically BOOLEAN NOT NULL DEFAULT FALSE AFTER termination_reason,
    ADD CONSTRAINT ck_lease_contracts_reason CHECK (termination_reason IS NULL OR status = 'TERMINATED'),
    ADD CONSTRAINT ck_lease_contracts_auto   CHECK (ended_automatically = FALSE OR status = 'ENDED');
CREATE OR REPLACE VIEW lease_details AS
SELECT  l.id, l.rentable_unit_id, l.renter_id, l.previous_lease_id,
        l.start_date, l.end_date, l.monthly_rent, l.payment_terms,
        l.tenant_name, l.tenant_email, l.tenant_phone,
        l.status, l.closed_on, l.termination_reason, l.ended_automatically, l.created_at,
        z.name AS unit_name, p.id AS property_id, p.name AS property_name, p.landlord_id AS landlord_id,
        u.full_name AS renter_name, u.username AS renter_username,
        (SELECT MIN(f.id) FROM uploaded_files f
         WHERE f.unit_id = l.rentable_unit_id AND f.file_kind = 'UNIT_PHOTO') AS unit_photo_id
FROM lease_contracts l
JOIN grid_zones z ON z.id = l.rentable_unit_id
JOIN properties p ON p.id = z.property_id
JOIN users u ON u.id = l.renter_id;
```

### New classes
- `service/LeaseExpiryJob` (`@Component`): calls `LeaseService.expireLeases(today)` once on startup (`ApplicationReadyEvent`, since the app isn't always running at midnight) and daily at 00:05 (`@Scheduled`). `@EnableScheduling` added to `SpaceGridApplication`.

### Changed classes
- `LeaseContract`: `terminationReason`, `endedAutomatically` (+ getters, so they're in the JSON); `terminate(today, reason)` (reason required, max 255); new `expire()` (ACTIVE → ENDED, `closedOn` = end date so billing stops there, `endedAutomatically` = true).
- `LeaseContractDao` / `JdbcLeaseContractDao`: reads/writes the two columns; new `findActiveEndedBefore(day)`.
- `LeaseService`: `terminateLease(id, landlord, reason)`; new `expireLeases(today)` (ends them and frees each unit).
- `LeaseState.EXPIRED` label is now "Ending today" (only between midnight and the job).

### Endpoints
- `POST /api/leases/{id}/terminate` now needs the form field `reason` (400 if missing or blank).
- `GET /api/leases…` JSON gains `terminationReason`, `endedAutomatically`.
- Payments are unchanged: a renter can still pay unpaid months of an ended or terminated lease.

### Pages
- `lease.html` + `lease.js` rebuilt in Tailwind with the shared bar (`css/renter-css/lease.css` no longer used by it): Lease Status badge with a one-line meaning, a timeline (start → last 30 days → end, today's marker, how it closed), and a "What you can do" card per state and role (landlord: Renew / Terminate with reason / End now when past the end date / Lease again; renter: pay the oldest unpaid month / Request this space again / Browse spaces; renewed → link to the new lease). The contract upload is labelled "Signed copy (PDF)".
- `landlord/leases.html` + `leases.js`: "Lease Status" label; filter "Ended automatically" replaces "Expired (not ended yet)"; terminate opens a reason dialog; the details modal shows the reason or "Ended automatically on …".
- `lease-form.js`: `?again={leaseId}` fills in renter, contact, unit and payment terms of an ended lease (an ordinary new lease; warns if the unit was taken).
- `nav.js` bell: also lists leases closed in the last 14 days (landlord: ended automatically; renter: ended or terminated, with the reason), until that lease's page is opened (`localStorage.seenLeaseNotices`).
- `property-grid.js`: unit details say "closes automatically" for a lease past its end date.

### How it was checked
- Live API on a scratch DB (port 8099): a lease 3 days past its end date was ENDED on startup (`closed_on` = end date, `ended_automatically` = 1) and its unit became AVAILABLE; terminate without / with a blank reason → 400, with a reason → TERMINATED and the reason in the renter's JSON; the renter could still pay an overdue month after termination.
- jsdom: `lease-page-test.js` (35 checks), `again-test.js` (4), `nav-test.js`, `role-test.js`, `landlord-pages-test.js`, plotter suites (101 + 41 + 28).

### Fix: approved requests after their lease is created (UI only)
`requests.html` kept showing "Create lease" on an approved request even after the lease existed. `requests.js` now also loads `GET /api/leases` and links each APPROVED request to a lease with the same renter and unit created after the approval (oldest first, each lease used once). Those show a "Lease created" badge and "View lease" instead, for both roles. No database link was added (owner chose the front-end match). Checked with `requests-lease-test.js` (6 checks).

### Not done yet / follow-ups
- Class diagram and ERD (`.drawio`): add `terminationReason`, `endedAutomatically`, `expire()`, `LeaseExpiryJob`.
- Phase 4 (printable contract page) is built: see the next entry.

---

## 2026-10-29 · Printable lease agreement (UI only, no design change)

Phase 4 of the UI plan. Front-end only: no Java, SQL or API change. Answers "export vs upload" from the owner's list: the system **produces** a generic agreement to print, and the landlord **uploads** the signed scan afterwards.

### What changed
- **`contract.html?id=` + `js/pages/contract.js` (new):** a generic lease agreement (decided with the owner: generic template for now) filled in from `GET /api/leases/{id}` and `GET /api/leases/{id}/property`: parties, premises and address, term, rent and payment terms (amount per period, in advance or arrears, due day), standard clauses (use, repairs, early end with a written reason, changes) and signature lines. Both the lease's landlord and its renter can open it. A closed lease shows a banner (Ended / Terminated early / Renewed on …). "Print / Save as PDF" uses the browser (`window.print()`); print CSS hides the top bar and buttons.
- The landlord's name is not on the page: the API doesn't give it to the renter, so the Landlord signature line is blank (name and date written by hand).
- **`lease.html`:** "Printable agreement" button in Details. "Contract" is now called "Signed copy" (upload label, leases modal "Open Signed Copy (PDF)", lease form section "Signed Copy (optional)").
- Not legal advice; the page says so.

### How it was checked
`contract-test.js` (17 checks: template fields, escaping, quarterly and arrears wording, ordinal due day, renewal reference, closed-lease banner, print button and print CSS, link from lease.html) plus the earlier jsdom suites.

### Not done yet / follow-ups
- Next in the plan: Phase 5 (email and phone on accounts), then 6 (Units map/list) and 7 (renter pages in Tailwind).

---

## 2026-10-29 · Email and phone on accounts (design change)

Phase 5 of the UI plan. Decided with the owner: both are **optional at registration**, but a **renter needs both before sending a lease request**; the lease form fills the tenant's contact from the picked account. Landlords can see the contact details of renters they search for in the lease form (owner approved this).

### Why
The lease form asked the landlord to type each tenant's email and phone by hand, and a request told the landlord nothing about how to reach the renter.

### Database (`database/spacegrid_db.sql`: re-run it by hand, or run these lines on an existing `spacegrid_db`)
```sql
ALTER TABLE users
    ADD COLUMN email VARCHAR(100) NULL AFTER full_name,
    ADD COLUMN phone VARCHAR(30)  NULL AFTER email;
```
The sample data gives the two landlords and Ana and Paolo an email and phone; **Liza has none**, so you can see the "add your contact" step.

### Changed classes
- `User`: `email`, `phone` (+ getters, so they appear in the JSON of `/api/auth/me` and `/api/renters`); `hasContact()`; `updateContact(email, phone)`; static `cleanEmail` / `cleanPhone` (blank = not given; an email like `a@b.co` up to 100 characters; a phone of 10+ digits, spaces, dashes or brackets with an optional +, up to 30 characters; otherwise ValidationException). The constructors take the two new values.
- `JdbcUserDao`: reads and writes both columns (`update` too).
- `AuthService`: `register(..., email, phone, role)`; new `updateContact(user, email, phone)`.
- `LeaseRequestService.createRequest`: refuses with "Add your email and phone number first, so the owner can reach you." when the renter has no `hasContact()`.

### Endpoints
- `POST /api/auth/register` accepts optional `email`, `phone`.
- `PUT /api/auth/me/contact` (new, any logged-in user): form fields `email`, `phone` (blank removes one); 400 on invalid text.
- `GET /api/auth/me` and `GET /api/renters` now include `email`, `phone`.

### Pages
- `register.html` / `register.js`: optional Email and Phone fields.
- `homepage.html` / `homepage.js`: the request form has Email and Phone (filled from the account, required). If they changed, they are saved first with `PUT /api/auth/me/contact`, then the request is sent.
- `lease-form.js`: picking an account (and "Create lease" from an approved request) fills the empty email and phone fields from it; anything the landlord already typed is kept.

### How it was checked
- Live API on a scratch DB (port 8099): register with and without contact; bad email / bad phone → 400; `PUT /me/contact` (bad → 400, no login → 401); a renter without contact → request refused (400), after saving the contact → request created (200); `/api/renters` shows contact to a landlord and is 403 for a renter; no `passwordHash` in the JSON.
- jsdom: `contact-test.js` (14 checks) and all earlier suites.

### Not done yet / follow-ups
- Class diagram and ERD (`.drawio`): add `email`, `phone` to User / users.
- No page yet to edit your contact details outside the request form.
- Next in the plan: Phase 6 (Units map/list), Phase 7 (renter pages in Tailwind).

---

## 2026-10-29 · Units page: Map / List view, compact cards, "Rate for new leases" (UI only, no design change)

Phase 6 of the UI plan. Front-end only: no Java, SQL or API change. Answers "too much text on the units page / a plotter-like visual would help" and "changing a unit's rent needs more clarity".

### What changed
- **Map / List toggle** on `landlord/units.html`. **Map** draws the property's grid read-only with `grid-renderer.js` (from `GET /api/properties/{id}`), units in their status colors with a legend. The status filters and the search dim the other units. Clicking a unit opens Quick Edit; common areas do nothing. Changing the layout still happens in "View/Edit Grid Layout". **List** is the cards.
- Default (agreed with the owner): Map when units are placed on the grid, otherwise List; the last choice is remembered in the browser (`localStorage.unitsView`). An empty map says where to draw units.
- **Compact cards:** name, size, status, rate, tenant and one link (View lease / Create lease). Clicking the card opens Quick Edit. The rate box on each card was removed; the rate is edited in Quick Edit.
- **Quick Edit:** the rent field is now **"Rate for new leases"** with a note: for an occupied unit "Ana Cruz's current lease stays at ₱… / month until …. A new rate only applies to new leases (and renewals you create)"; for a vacant unit "This is the rent filled in when you create the next lease for this unit."

### How it was checked
`units-map-test.js` (23 checks: default view, toggle and remembered choice, map cells and legend, clicks on units vs common areas, filter/search dimming, compact cards and links, escaped names, the rent notes, the empty map) plus all earlier jsdom suites.

### Not done yet / follow-ups
- Next in the plan: Phase 7 (renter dashboard and pay pages rebuilt in Tailwind with the shared bar).

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
> **BUILT 2026-10-28 (branch Plotter-Polish, not committed yet).** Changed: `Property.MAX_GRID_SIZE` = 60; `spacegrid_db.sql` CHECKs (rows/cols 1–60, edge indexes 0–60: **re-run the SQL by hand**); `grid-renderer.js` (new `cell` option, zone index, labels hidden under 16 px, spot borders dropped under 10 px, wall and click-line thickness scale with the cell); `property-grid.js` (zoom −/+/slider/Fit, Ctrl+wheel, keys `+` `-` `0`, zoom remembered in localStorage, pan with space+drag or middle mouse, **Brush / Rectangle** paint style, drawing limited to once per frame); `property-grid.html`; `grid.css` (grid area max 78vh so big grids pan inside it). Zoom range 6–96 px (100% = 48 px). Not done: zoom on `lease.html` (left for the lease pages), real tests (`PropertyTest` is still a disabled stub; `resizeGrid_over60_isRejected` is the placeholder).
> Not checked in a real browser: only a stub-DOM run of the renderer at 60×60 (5.5k elements, 12.8k in the Walls mode) and a Maven build. Please try it by hand.

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
