# SpaceGrid

Property rental manager for Davao (OOP final project). Landlords plot their properties on a grid of
rentable units and common areas, then manage leases. Renters view their leases and pay rent through a
simulated payment step. The project was converted from a Java Swing app to an HTML frontend.

## Stack and setup
- Spring Boot 4.1.1, Java 17 (JDK 22 installed), Maven, NetBeans.
- `spring-boot-starter-webmvc` + `spring-boot-starter-jdbc` with **JdbcTemplate**. No JPA/Hibernate.
- MySQL driver against **XAMPP MariaDB** on `localhost:3306`, database `spacegrid_db`, user `root`, no password.
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
| model | none | 30 classes. Value objects are Java records (accessors are `row()`, not `getRow()`). |
| config | `@Configuration` | `WebConfig`: page routes (`/`, `/home`, `/browse` → `homepage.html`; `/login`, `/register`, `/requests`). |
| dao / dao.jdbc | `@Repository` on Jdbc classes | `CrudDao<T>` + one interface per entity. The constructor takes `JdbcTemplate`. `JdbcLeaseContractDao` reads the `lease_details` view. |
| service | `@Service` | `@Transactional` on multi-table writes (grid save, create/renew/end lease, pay rent). |
| controller | `@RestController` under `/api/...` | Every method takes `HttpSession` and uses `SessionManager`, **except `BrowseController`** (`/api/browse`, public: the homepage works without login). |
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
- **Exception:** `homepage.html` uses the Tailwind CDN + Font Awesome (not `base.css`) and loads only `api.js` + `js/pages/homepage.js`. It checks login with a plain `fetch('/api/auth/me')` (a 401 means guest), not `auth.requireLogin`.
- Colors come from enum `cssClass` + `defaultColor`. Spots get classes like `zone zone-unit status-occupied` and `--zone-color`. `css/zones.css` is the file to edit for custom looks.

## Business rules (summary)
- **Accounts:** usernames are unique. Passwords are at least 8 characters, hashed with BCrypt. Login failures give one generic message.
- **Properties:** only the owner can see or change one. A new property is DRAFT with a 1×1 grid. The grid is at most 60×60 (`Property.MAX_GRID_SIZE`, the CHECKs in `spacegrid_db.sql` and `MAX` in `property-grid.js` must match). Status is DRAFT / ACTIVE / ARCHIVED. Types: APARTMENT, CONDOMINIUM, TOWNHOUSE, COMMERCIAL, NIGHT_MARKET, OPEN_SPACE.
- **Grid:**
  - abstract `GridZone` → `RentableUnit`, `CommonArea`.
  - Common area types: WALKWAY, GRASS, BATHROOM, KITCHEN, LAUNDRY, LOBBY, PARKING, STAIRS. Indoor ones are bathroom, kitchen, laundry, lobby, stairs.
  - One zone per spot. Shrinking the grid drops spots and edges outside it.
  - **Walls are automatic** on a line between different zones when at least one side is enclosed (a unit or indoor area), and on the border next to an enclosed spot.
  - Manual overrides are WALL / DOOR / WINDOW / OPEN. Each line is stored once, as the line above (HORIZONTAL) or left of (VERTICAL) a spot.
  - The plotter offers Eraser / Wall / Door / Window (`gridRenderer.applyEdgeTool`). Eraser over an automatic wall stores OPEN; Wall over an automatic wall removes the override.
  - Save layout = `PUT /grid`, then `PUT /edges`.
- **Units:**
  - Status is AVAILABLE / OCCUPIED / UNDER_MAINTENANCE / ARCHIVED.
  - OCCUPIED only from AVAILABLE. No maintenance while occupied.
  - **Archive instead of delete:** only allowed with no ACTIVE lease. Archiving clears the unit's spots and keeps its history.
  - Delete only if the unit was never leased.
  - Zone names don't need to be unique.
- **Leases:**
  - **Terms can't be edited.** A unit can have one ACTIVE lease, and the renter must have the RENTER role.
  - Create: unit → OCCUPIED. End / Terminate: sets `closedOn`, unit → AVAILABLE.
  - **Renew:** the old lease becomes RENEWED (`closedOn` = the day before the new start). The new lease gets `previousLeaseId`. Done in one transaction.
  - Displayed state is calculated: UPCOMING, ACTIVE, EXPIRING_SOON (30 days or fewer), EXPIRED, ENDED, TERMINATED, RENEWED.
  - No amendments, no notifications.
- **Payments:**
  - Billing months run from the start month to `closedOn`/`endDate`. The due day is the lease's start day, or the month's last day if shorter.
  - Each month is paid once, oldest unpaid first. **Paying ahead is allowed.**
  - Due status per month: PAID / OVERDUE / DUE (within 7 days) / UPCOMING.
  - Methods are GCASH / MAYA / CARD. The fake gateway declines account numbers ending in `0000`, saving the payment as FAILED so it can be retried.
- **Browsing (public homepage):** `homepage.html` lists every ACTIVE property that has at least one AVAILABLE unit. A **block = one AVAILABLE unit**. `GET /api/browse` (and `/{id}`) needs no login. Search, filter, sort and pagination run in the browser. "Power included" = at least one free unit includes electricity. "Saved" spaces live only in the browser (localStorage).
- **Lease requests:** a logged-in renter asks for an AVAILABLE unit (start date, 1–60 months, optional message). One PENDING request per renter per unit. The landlord of that property approves or declines; the renter can cancel while PENDING. Only PENDING changes; the rest are final. **Approving does not create the lease**: the landlord still creates it with the lease form (the unit stays AVAILABLE until then). Approve fails if the unit is no longer AVAILABLE.
- The landlord can also create a lease directly by typing the renter's username.

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

The plotter works end to end against the real database. After pulling these changes, **re-run `database/spacegrid_db.sql`** (new types, `lease_requests` table and view, sample data).

**TODO (about 79 method bodies + pages), in this order:**
1. register + `index.html`, landlord dashboard, property form (list/search, create, update, publish, archive)
2. units page (list, update, maintenance, archive, delete) and common area update/delete
3. leases: `LeaseContract` logic, DAO, service, controller, `leases.html`, `lease-form.html` (make it read `?requestId=` to prefill renter and dates from an approved request)
4. `lease.html` (details, read-only grid, statement, history), renter dashboard, `renter/pay.html` + payments
5. tests: `PropertyTest`, `LeaseContractTest`, `SpaceGridApplicationTests` (written last)

## Reference docs (in `docs/`)
- `SpaceGrid-Phase1-Spec.md` + `SpaceGrid-Phase1-ClassDiagram.drawio`: every class, field, method and endpoint.
- `SpaceGrid-Phase2-ERD.drawio` (schema in `database/spacegrid_db.sql`).
- `SpaceGrid-Phase3-FileStructure.md`: the page list with each page's endpoints.
- `HOW-TO-CONNECT.md`: matching pages to controllers (`@RequestParam` vs `@RequestBody`, date/enum formats).
- `DESIGN-CHANGES.md`: log of design changes (add an entry whenever the design changes). Latest: homepage + lease requests.

## Working with me
- I'm a student. Explain changes simply, and keep code readable rather than clever.
- Don't change the design (classes, tables, endpoints) without asking first. If a change is needed, say which docs must be updated.
- I build and run in NetBeans with XAMPP. Tell me what to click or run to test each step.
