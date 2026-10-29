# SpaceGrid

Property rental manager for Davao (OOP final project). Landlords plot their properties on a grid of
rentable units and common areas, then manage leases. Renters view their leases and pay rent through a
simulated payment step. The project was converted from a Java Swing app to an HTML frontend.

## Stack and setup
- Spring Boot 4.1.1, Java 17 (JDK 22 installed), Maven, NetBeans.
- `spring-boot-starter-webmvc` + `spring-boot-starter-jdbc` with **JdbcTemplate**. No JPA/Hibernate.
- MySQL driver against **XAMPP MariaDB** on `localhost:3306`, database `spacegrid_db`, user `root`, no password. Keep 3306 in `application.properties`; if your XAMPP uses another port (e.g. 3307), override it locally instead of editing the file: set the environment variable `SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3307/spacegrid_db?serverTimezone=Asia/Manila&characterEncoding=UTF-8` (NetBeans: Project Properties → Run → Environment Variables).
- jBCrypt for passwords. devtools is on.
- Frontend: plain HTML/CSS/JS in `src/main/resources/static`, served at `http://localhost:8080/`. No framework, no build step.
- `database/spacegrid_db.sql` is run **by hand** in MySQL Workbench (`spring.sql.init.mode=never`). It drops and recreates the database with sample data.
- Sample logins (password `password123`): landlords `maria.santos`, `jose.reyes`; renters `ana.cruz`, `paolo.garcia`, `liza.mendoza`.
- pom.xml must keep `<start-class>` and `<exec.mainClass>` = `com.techhub.spacegridapplication.SpaceGridApplication`.

## Package
**Base package: `com.techhub.spacegridapplication`.** Use it in all code and docs.

## Architecture
controller → service → DAO interface → `dao.jdbc` implementation → MySQL. `model` holds entities, enums and
value objects, with no SQL or web code.

| Package | Annotation | Notes |
|---|---|---|
| model | none | 36 classes. Value objects are Java records (accessors are `row()`, not `getRow()`). |
| config | `@Configuration` | `WebConfig`: page routes (`/`, `/home`, `/browse` → `homepage.html`; `/login`, `/register`, `/requests`). |
| dao / dao.jdbc | `@Repository` on Jdbc classes | `CrudDao<T>` + one interface per entity. The constructor takes `JdbcTemplate`. `JdbcLeaseContractDao` reads the `lease_details` view. |
| service | `@Service` | `@Transactional` on multi-table writes (grid save, create/renew/end lease, pay rent). |
| controller | `@RestController` under `/api/...` | Every method takes `HttpSession` and uses `SessionManager`, **except `BrowseController`** (`/api/browse`, public: the homepage works without login). `FileController` uses `SessionManager.currentUserOrNull` so public photos load without login. |
| security | `@Component` | `PasswordHasher` / `BCryptPasswordHasher`, `SessionManager` (session key `userId`). |
| payment | `@Component` | `PaymentGateway` / `FakePaymentGateway`. |
| exception | `@RestControllerAdvice` | `SpaceGridException` subclasses: Validation 400, Unauthenticated 401, AccessDenied 403, NotFound 404, Conflict 409. Errors are returned as `{"error": "..."}`. A method still marked TODO answers 501. |

## Conventions
- **No DTOs.** `User.passwordHash` has `@JsonIgnore`. Controllers take simple request params, or `Map` bodies for the grid (`spotsByZone`, `edgesByType`). The owner/renter id **always comes from the session**, never from the browser.
- All fields are private and have getters. No public setters: data changes only through methods that check their input.
- Each entity has a "new" constructor (checks input, no id) and a "from database" constructor (`id`, `createdAt`, all fields) used by the RowMappers.
- Grid methods on `GridZone` are package-private, so only `Property` changes spots.
- Methods not written yet contain `// TODO` + `throw new UnsupportedOperationException("TODO")`.
- Frontend: each page loads `/css/base.css` (+ `zones.css`, `grid.css` on grid pages), then `/js/common/api.js`, `auth.js`, `format.js` (+ `grid-renderer.js`), then `/js/pages/<page>.js`. Links start with `/`. `auth.js` `requireLogin(role)` redirects to the right page by role.
- **Plotter page** (`landlord/property-grid.html`) also loads `/css/plotter.css` and `/js/common/floating-panel.js`. The grid fills the window and the toolbar/panel float on top. All its keyboard shortcuts live in the `SHORTCUTS` list in `property-grid.js` (the `?` dialog is built from it). Undo/redo uses `gridRenderer.snapshot/restore` (size, spots, edge overrides; adding a zone is not undoable).
  - It has two states: **View** (opens first: click a unit or pick it in the list → details card from `GET /api/units/{id}/details` = unit + current ACTIVE lease + open requests; legend rows highlight units by status; search zooms to a unit) and **Edit** (the editor). `?mode=edit` opens Edit; keys E (View → Edit) and V (Edit → View). Each `SHORTCUTS` entry lists the `modes` it works in (default: Edit only).
- **Exception:** `homepage.html` uses the Tailwind CDN + Font Awesome (not `base.css`) and loads only `api.js` + `js/pages/homepage.js`. It checks login with a plain `fetch('/api/auth/me')` (a 401 means guest), not `auth.requireLogin`.
- **Exception (landlord pages, designed in the `landlord` branch):** `landlord/dashboard.html`, `units.html`, `leases.html`, `lease-form.html`, `property-form.html` also use Tailwind + Font Awesome and keep their **relative links** (`dashboard.html`, `units.html?propertyId=…`). They load `api.js` + `auth.js` (with `auth.requireLogin('LANDLORD')` in `<head>`), `format.js` and their `js/pages/*.js` script (`landlord-dashboard.js`, `units.js`, `leases.js`, `lease-form.js`, `property-form.js`), like the other pages. No link between landlord and renter pages: the accounts stay separate. `property-grid.html` (the plotter) is not one of them.
- **Uploads:** `api.upload(url, formData)` sends a file. Text typed by users goes into `innerHTML` only through `format.escape(...)`.
- Colors come from enum `cssClass` + `defaultColor`. Spots get classes like `zone zone-unit status-occupied` and `--zone-color`. `css/zones.css` is the file to edit for custom looks.

## Business rules (summary)
- **Accounts:** usernames are unique. Passwords are at least 8 characters, hashed with BCrypt. Login failures give one generic message.
- **Properties:** only the owner can see or change one. A new property is DRAFT with a 1×1 grid. The grid is at most 60×60 (`Property.MAX_GRID_SIZE`, the CHECKs in `spacegrid_db.sql` (`grid_rows`/`grid_columns` ≤ 60, `zone_cells` rows/cols 0–59) and `MAX` in `property-grid.js` must match). Status is DRAFT / ACTIVE / ARCHIVED. Types: APARTMENT, CONDOMINIUM, TOWNHOUSE, COMMERCIAL, NIGHT_MARKET, OPEN_SPACE.
  - Address = street (`address`) + `city` + `region`, all required; `getFullAddress()` joins them (the homepage shows that).
  - `defaultRate` (optional) only pre-fills a new unit's rate in the plotter; every unit keeps its own `rentalRate`.
  - `Amenities` (record): parking, powerBackup, security, waterAccess, open24h.
  - Publish: DRAFT → ACTIVE (not when ARCHIVED). Archive: not while a unit has an ACTIVE lease (409); open lease requests for its units are declined. An archived property can't be edited.
  - The number of units is never typed: it is what the plotter has.
- **Files** (`uploaded_files` + `StoredFile`, `FileService`, `FileController`): PROPERTY_PHOTO and SITE_PLAN belong to a property, UNIT_PHOTO to a unit, CONTRACT (PDF, one per lease, a new upload replaces it) to a lease. Photos are JPG/PNG/WebP, site plans may also be PDF, max 10 MB, max 10 per owner. Bytes are saved in the `uploads/` folder (`spacegrid.upload-dir`, not in git) under a random name. Only the owning landlord uploads or deletes. Viewing (`GET /api/files/{id}`): the landlord always; property/unit photos by anyone once the property is ACTIVE; a contract also by the lease's renter; site plans only by the landlord.
- **Grid:**
  - abstract `GridZone` → `RentableUnit`, `CommonArea`.
  - Common area types: WALKWAY, GRASS, BATHROOM, KITCHEN, LAUNDRY, LOBBY, PARKING, STAIRS. Indoor ones are bathroom, kitchen, laundry, lobby, stairs.
  - **Common-area colors:** `common_areas.color` (`#rrggbb`, NULL = type default). Set on create (`color` field) or `PUT /api/properties/{id}/common-areas/{areaId}/color`. Must differ from every other common area's color in the same property and from the 4 unit status colors (409). Units are always colored by status.
  - One zone per spot. Shrinking the grid drops spots and edges outside it. In the plotter the grid can be resized from all four sides; the top/left bars move the drawing with them (`gridRenderer.resizeLayout`), and the saved layout is still just rows, cols and absolute spots.
  - **Walls are automatic** on a line between different zones when at least one side is enclosed (a unit or indoor area), and on the border next to an enclosed spot.
  - Manual overrides are WALL / DOOR / WINDOW / OPEN. Each line is stored once, as the line above (HORIZONTAL) or left of (VERTICAL) a spot.
  - The plotter's toolbar is always Spots | Walls · Hand · Brush/Rectangle · Eraser · Preview. In Walls mode the Brush draws the Wall/Door/Window picked in the panel and the Rectangle draws it around an area (`gridRenderer.rectOutlineEdges`). Eraser over an automatic wall stores OPEN; Wall over an automatic wall removes the override (`gridRenderer.applyEdgeTool`).
  - Save layout = `PUT /grid`, then `PUT /edges`.
- **Units:**
  - Status is AVAILABLE / OCCUPIED / UNDER_MAINTENANCE / ARCHIVED.
  - OCCUPIED only from AVAILABLE. No maintenance while occupied.
  - **Taking a unit off the grid** (`GET /api/units/{id}/removal-check` → `UnitRemovalCheck` tells the page which applies):
    - ACTIVE lease (running or upcoming) → neither delete nor archive (409): end or terminate the lease first.
    - Leased before, not now → **archive only** (`POST /api/units/{id}/archive`): status ARCHIVED, its spots cleared, leases and payments kept.
    - Never leased → **delete** (`DELETE /api/units/{id}`): the zone, unit row and spots go.
    - Either way, its PENDING / APPROVED lease requests are **declined** in the same transaction.
  - Common areas can always be deleted (`DELETE /api/common-areas/{id}`); their spots go with them.
  - Zone names don't need to be unique.
- **Leases:**
  - **Terms can't be edited.** A unit can have one ACTIVE lease, and the renter must have the RENTER role.
  - Every lease is linked to a renter **account** (`renterUsername`, picked in the lease form from `GET /api/renters?search=`) and also stores the contact details typed in the form: `tenantName` (required; defaults to the account's name), `tenantEmail`, `tenantPhone`.
  - `PaymentTerms`: MONTHLY_ADVANCE (default), MONTHLY_ARREARS, QUARTERLY_ADVANCE, SEMI_ANNUAL_ADVANCE, ANNUAL_ADVANCE. No security deposit.
  - Create: unit → OCCUPIED (also for a lease that starts later). End: only from the end date on (before that: terminate). End / Terminate: sets `closedOn`, unit → AVAILABLE.
  - **Terminate needs a reason** (`termination_reason`, max 255, shown to the renter).
  - **Auto-expiry:** `LeaseExpiryJob` (on startup and daily at 00:05) ends every ACTIVE lease whose end date has passed: ENDED, `closedOn` = end date, `ended_automatically` = TRUE, unit → AVAILABLE. Unpaid months stay payable.
  - **Renew:** the old lease becomes RENEWED (`closedOn` = the day before the new start). The new lease gets `previousLeaseId`. Done in one transaction. "Lease again" (`lease-form.html?again=`) after a lease ended is an ordinary new lease.
  - **Lease Status** (on screen; was "Contract status") is calculated: UPCOMING, ACTIVE, EXPIRING_SOON (30 days or fewer), EXPIRED (shown "Ending today", until the job runs), ENDED, TERMINATED, RENEWED.
  - No amendments. Notifications are only the top bar's bell (`nav.js`): pending / decided requests and recently closed leases.
- **Payments:**
  - Billing months run from the start month to `closedOn`/`endDate`. They are grouped into **billing periods** by the payment terms (1, 3, 6 or 12 months; the last one can be shorter). A period is named after its first month (`RentDue.billingMonth`, `payments.billing_month`) and costs rent × its months (`RentDue.months`).
  - The due day is the lease's start day, or the month's last day if shorter: in the period's first month (in advance) or in the month after it (in arrears).
  - Each period is paid once, oldest unpaid first. **Paying ahead is allowed.**
  - Due status per period: PAID / OVERDUE / DUE (within 7 days) / UPCOMING. The landlord's leases list shows Overdue / Pending (something DUE) / Paid from the statement.
  - Methods are GCASH / MAYA / CARD. The fake gateway declines account numbers ending in `0000`, saving the payment as FAILED so it can be retried.
- **Browsing (public homepage):** `homepage.html` lists every ACTIVE property that has at least one AVAILABLE unit. A free space is an AVAILABLE unit (the pages never say "block": the word is "unit" everywhere). `GET /api/browse` (and `/{id}`) needs no login. Search, filter, sort and pagination run in the browser. "Power included" = at least one free unit includes electricity. "Saved" spaces live only in the browser (localStorage).
- **Lease requests:** a logged-in renter asks for an AVAILABLE unit (start date, 1–60 months, optional message). One PENDING request per renter per unit. The landlord of that property approves or declines; the renter can cancel while PENDING. Only PENDING changes; the rest are final. **Approving does not create the lease**: the landlord still creates it with the lease form (the unit stays AVAILABLE until then). Approve fails if the unit is no longer AVAILABLE. Each request keeps a copy of the unit and property names (`unit_label`, `property_label`); if the landlord deletes the unit, `rentable_unit_id` becomes NULL (`ON DELETE SET NULL`), the request stays (declined) and `LeaseRequest.isUnitRemoved()` is true.
- The landlord can also create a lease directly by picking the renter's account. `lease-form.html?requestId=` fills it in from an approved request; `?unitId=` preselects a unit; `?renew=` renews a lease.

## Status
**Done:**
- the model grid rules
- property load and save (grid + edges)
- add unit, add common area
- login / logout / me (`SessionManager`, `AuthService.login`)
- exception handler
- `landlord/property-grid.html` + `grid-renderer.js`
- `login.html`
- public homepage (`homepage.html` + `js/pages/homepage.js`, routes in `WebConfig`) with `GET /api/browse`
- lease requests: `LeaseRequest` model, DAO, service, controller, `requests.html` (both roles)
- `RentableUnitDao` `findById` / `findByPropertyId`, `User.isLandlord()` / `isRenter()`, `format.date` / `format.badge`
- delete / archive units and delete common areas (service, controller, DAO, plotter dialog); `JdbcLeaseContractDao` row mapper, `findActiveByUnitId`, `existsByUnitId`; `JdbcCommonAreaDao` reads; `RentableUnitDao.update`
- edit units (`PUT /api/units/{id}`, `POST /api/units/{id}/maintenance`) and common areas (`PUT /api/common-areas/{id}`) from the plotter (pencil on each zone, Enter, View's "Edit unit"); `LeaseContract` state / days remaining; plotter View mode (`GET /api/units/{id}/details`)
- register (`AuthService.register`, `register.js`: logs in right after)
- properties: list/search, create, update, publish, archive; street/city/region, default rate, amenities (`landlord/dashboard.html`, `property-form.html`)
- units page (`units.html`: list, rate on each card, quick edit, unit photos); common areas list
- leases: `LeaseContract` logic, DAO, service, controller (+ `GET /api/renters`, `GET /api/leases/{id}/property`), `leases.html`, `lease-form.html` (new / `?unitId=` / `?requestId=` / `?renew=`), tenant contact, payment terms
- payments: statement by billing period, pay rent, history, `FakePaymentGateway`; `lease.html` (both roles), `renter/pay.html`
- uploads: property photos, site plans, unit photos, contract PDFs (`StoredFile`, `FileService`, `FileController`); cover photos on the dashboard and homepage, the unit photo on the renter's lease card (`lease.imageUrl`)

Everything except the tests works end to end against the real database. After pulling these changes, **re-run `database/spacegrid_db.sql`** (new property columns, lease contact + payment terms, `uploaded_files`, `lease_details` view, `zone_cells` 0–59 fix, sample data).

**TODO, in this order:**
1. **lease timing markers on the plotter**: a small dot on occupied units, "Expiring soon" (30 days or fewer) or "Upcoming", plus a matching legend row. Needs each unit's current lease state in the grid page's data.
2. map pin on the property form (a placeholder today: nothing is saved)
3. tests: `PropertyTest`, `LeaseContractTest`, `SpaceGridApplicationTests` (written last)

**TODO: problems found in the teammate's renter redesign (PR #7, `457066d`). Not fixed yet, ask the owner first because they are the teammate's files:**
- `css/base.css`: `.btn` background changed to `--btnbg: #e6e6e6` for **every** page, so the plotter's buttons turned gray too. Move that rule into `css/renter-css/*.css`.
- `js/pages/renter-dashboard.js`: `propertyName` / `unitName` go into `innerHTML` unescaped. Landlords type those names, so HTML in a name would run on the renter's page. Escape them or build the cards with `textContent`.
- `js/pages/renter-dashboard.js`: `auth.requireLogin('RENTER')` is inside a `try/catch` that ignores the error, so the page still loads when the check fails. Remove the `try/catch` like the other pages.
- (done) `lease.imageUrl` (renter lease card) is now sent by the API: the unit's first photo, or null (the card then shows its placeholder).

## Reference docs (in `docs/`)
- `SpaceGrid-Phase1-Spec.md` + `SpaceGrid-Phase1-ClassDiagram.drawio`: every class, field, method and endpoint.
- `SpaceGrid-Phase2-ERD.drawio` (schema in `database/spacegrid_db.sql`).
- `SpaceGrid-Phase3-FileStructure.md`: the page list with each page's endpoints.
- `HOW-TO-CONNECT.md`: matching pages to controllers (`@RequestParam` vs `@RequestBody`, date/enum formats).
- `DESIGN-CHANGES.md`: log of design changes (add an entry whenever the design changes). Latest: landlord pages connected (property address/rate/amenities, tenant contact, payment terms, uploads).

## Working with me
- I'm a student. Explain changes simply, and keep code readable rather than clever.
- Don't change the design (classes, tables, endpoints) without asking first. If a change is needed, say which docs must be updated.
- I build and run in NetBeans with XAMPP. Tell me what to click or run to test each step.
