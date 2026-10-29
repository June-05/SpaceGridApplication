# SpaceGrid · Phase 3: Final File Structure (Spring Boot, Maven)

Spring Boot **4.1.1** · Java **17** · Maven project in NetBeans · Base package `com.techhub.spacegridapplication`.
Related documents: Phase 1 (`SpaceGrid-Phase1-Spec.md`, class diagram), Phase 2 (`spacegrid_db.sql`, ERD).

> **Updated 2026-10-28:** the tree and page list below now include the public homepage and lease requests
> (`homepage.html`, `requests.html`, `config/WebConfig`, `BrowseController`, `LeaseRequest*`, ...). See `DESIGN-CHANGES.md`.
> The test folder is `src/test/java/com/techhub/spacegridapplication/` (same package as the main code).
> The list below was the original plan: where it differs from the code, the code and `CLAUDE.md` win.

---

## 1. Decisions

| Topic | Decision |
|---|---|
| Framework | Spring Boot 4.1.1 (`spring-boot-starter-webmvc`, `spring-boot-starter-jdbc`), JdbcTemplate, no JPA |
| Database | XAMPP (MariaDB) on `localhost:3306`, database `spacegrid_db`, user `root`, **no password** |
| Frontend | Plain HTML/CSS/JS in `src/main/resources/static`, served by Spring Boot at `http://localhost:8080/` |
| Page folders | Shared pages at the root, plus `landlord/` and `renter/` folders |
| SQL script | Kept in `database/`, outside `resources`, so Spring never runs it automatically. Run it yourself in MySQL Workbench. |
| Tests | Kept in the structure. **Written later**, after the model classes work (see section 7). |

---

## 2. Full tree

NetBeans shows these folders as **Source Packages**, **Other Sources**, **Test Packages** and **Project Files**.

```
SpaceGrid/
├── pom.xml                                         ✅ done (Project Files)
├── database/
│   └── spacegrid_db.sql                            Phase 2 script: run in Workbench
│
├── src/main/java/com/techhub/spacegridapplication/            ── Source Packages
│   ├── SpaceGridApplication.java
│   ├── model/
│   │   ├── BaseEntity.java
│   │   ├── User.java
│   │   ├── Role.java
│   │   ├── Property.java
│   │   ├── Amenities.java              (record)
│   │   ├── PropertyType.java
│   │   ├── PropertyStatus.java
│   │   ├── PropertyListing.java        (homepage, record)
│   │   ├── GridPreview.java            (homepage layout preview, record)
│   │   ├── UnitListing.java            (homepage, record)
│   │   ├── LeaseRequest.java
│   │   ├── RequestStatus.java
│   │   ├── GridZone.java
│   │   ├── RentableUnit.java
│   │   ├── UnitStatus.java
│   │   ├── CommonArea.java
│   │   ├── CommonAreaType.java
│   │   ├── GridPosition.java
│   │   ├── GridEdge.java
│   │   ├── Side.java
│   │   ├── Orientation.java
│   │   ├── EdgeType.java
│   │   ├── Dimensions.java
│   │   ├── LeaseContract.java
│   │   ├── PaymentTerms.java
│   │   ├── LeaseStatus.java
│   │   ├── LeaseState.java
│   │   ├── Payment.java
│   │   ├── PaymentStatus.java
│   │   ├── PaymentMethod.java
│   │   ├── RentDue.java
│   │   ├── DueStatus.java
│   │   ├── PaymentResult.java
│   │   ├── StoredFile.java             (uploaded photo / site plan / contract)
│   │   └── FileKind.java
│   ├── dao/
│   │   ├── CrudDao.java
│   │   ├── UserDao.java
│   │   ├── PropertyDao.java
│   │   ├── RentableUnitDao.java
│   │   ├── CommonAreaDao.java
│   │   ├── LeaseContractDao.java
│   │   ├── PaymentDao.java
│   │   ├── LeaseRequestDao.java
│   │   ├── StoredFileDao.java
│   │   └── jdbc/
│   │       ├── JdbcUserDao.java
│   │       ├── JdbcPropertyDao.java
│   │       ├── JdbcRentableUnitDao.java
│   │       ├── JdbcCommonAreaDao.java
│   │       ├── JdbcLeaseContractDao.java
│   │       ├── JdbcPaymentDao.java
│   │       ├── JdbcLeaseRequestDao.java
│   │       └── JdbcStoredFileDao.java
│   ├── service/
│   │   ├── AuthService.java
│   │   ├── PropertyService.java
│   │   ├── RentableUnitService.java
│   │   ├── CommonAreaService.java
│   │   ├── LeaseService.java
│   │   ├── LeaseExpiryJob.java                 ends expired leases (startup + daily 00:05)
│   │   ├── LeaseRequestService.java
│   │   ├── PaymentService.java
│   │   └── FileService.java            (uploads folder)
│   ├── controller/
│   │   ├── AuthController.java
│   │   ├── PropertyController.java
│   │   ├── RentableUnitController.java
│   │   ├── CommonAreaController.java
│   │   ├── LeaseController.java
│   │   ├── LeaseRequestController.java
│   │   ├── BrowseController.java       (public)
│   │   ├── PaymentController.java
│   │   └── FileController.java         (uploads; photos of ACTIVE properties are public)
│   ├── config/
│   │   └── WebConfig.java              (page routes)
│   ├── security/
│   │   ├── PasswordHasher.java
│   │   ├── BCryptPasswordHasher.java
│   │   └── SessionManager.java
│   ├── payment/
│   │   ├── PaymentGateway.java
│   │   └── FakePaymentGateway.java
│   └── exception/
│       ├── SpaceGridException.java
│       ├── ValidationException.java
│       ├── UnauthenticatedException.java
│       ├── AccessDeniedException.java
│       ├── NotFoundException.java
│       ├── ConflictException.java
│       └── GlobalExceptionHandler.java
│
├── src/main/resources/                             ── Other Sources
│   ├── application.properties
│   └── static/
│       ├── index.html
│       ├── homepage.html               (public: browse spaces; routes /, /home, /browse; Tailwind CDN)
│       ├── requests.html               (lease requests, both roles; route /requests)
│       ├── login.html
│       ├── register.html
│       ├── lease.html
│       ├── contract.html               (printable lease agreement; browser Print / Save as PDF)
│       ├── landlord/
│       │   ├── dashboard.html
│       │   ├── property-form.html
│       │   ├── property-grid.html
│       │   ├── units.html
│       │   ├── leases.html
│       │   └── lease-form.html
│       ├── renter/
│       │   ├── dashboard.html
│       │   └── pay.html
│       ├── css/
│       │   ├── base.css
│       │   ├── grid.css
│       │   ├── plotter.css                         full-screen plotter: floating toolbar, panel, popovers
│       │   └── zones.css
│       ├── js/
│       │   ├── common/
│       │   │   ├── api.js
│       │   │   ├── auth.js
│       │   │   ├── nav.js                              shared top bar + request bell
│       │   │   ├── format.js
│       │   │   ├── grid-renderer.js
│       │   │   └── floating-panel.js                   draggable / minimizable panel (plotter)
│       │   └── pages/
│       │       ├── homepage.js
│       │       ├── requests.js
│       │       ├── login.js
│       │       ├── register.js
│       │       ├── lease.js
│       │       ├── landlord-dashboard.js
│       │       ├── property-form.js
│       │       ├── property-grid.js
│       │       ├── units.js
│       │       ├── leases.js
│       │       ├── lease-form.js
│       │       ├── renter-dashboard.js
│       │       └── pay.js
│       └── images/
│           └── zones/                              optional textures for zones.css
│
└── src/test/java/com/techhub/spacegridapplication/            ── Test Packages (written later)
    ├── SpaceGridApplicationTests.java
    └── model/
        ├── PropertyTest.java
        └── LeaseContractTest.java
```

**File count:** 74 Java classes · 3 test classes · 14 HTML · 3 CSS · 17 JS · 1 properties file · 1 SQL script · `pom.xml`

---

## 3. Java packages and Spring annotations

Spring finds and connects classes by their annotations. Classes without one are plain Java objects that Spring doesn't manage.

| Package | Files | Spring annotation | Notes |
|---|---|---|---|
| *(root)* | `SpaceGridApplication` | `@SpringBootApplication` | Has `main()`. It must stay in the root package so Spring scans every sub-package. |
| `model` | 26 | none | Plain Java: entities, enums, value objects. `@JsonIgnore` on `User.passwordHash`. |
| `dao` | 7 interfaces | none | `CrudDao<T>` + one interface per entity |
| `dao.jdbc` | 6 classes | `@Repository` | Constructor receives `JdbcTemplate`. `JdbcLeaseContractDao` reads from the `lease_details` view. |
| `service` | 6 | `@Service` | `@Transactional` on methods that write to several tables (save grid layout, create/renew/end lease, pay rent) |
| `controller` | 6 | `@RestController` + `@RequestMapping("/api/...")` | Every method receives `HttpSession` and uses `SessionManager` |
| `security` | `PasswordHasher` (interface), `BCryptPasswordHasher`, `SessionManager` | `@Component` on the two classes | |
| `payment` | `PaymentGateway` (interface), `FakePaymentGateway` | `@Component` on the class | Swap in a real gateway later by writing another class that implements the interface |
| `exception` | 6 exceptions + handler | `@RestControllerAdvice` on `GlobalExceptionHandler` | Exceptions are plain classes |

---

## 4. `application.properties` (planned contents)

```properties
# --- App ---
spring.application.name=SpaceGrid
server.port=8080

# --- Database: XAMPP (MariaDB), user root, no password ---
spring.datasource.url=jdbc:mysql://localhost:3306/spacegrid_db?serverTimezone=Asia/Manila&characterEncoding=UTF-8
spring.datasource.username=root
spring.datasource.password=

# Never run SQL scripts automatically (database/spacegrid_db.sql is run by hand in Workbench)
spring.sql.init.mode=never

# --- Login session (SessionManager) ---
server.servlet.session.timeout=30m
server.servlet.session.cookie.http-only=true

# --- Logging: show this app's debug messages while developing ---
logging.level.com.techhub.spacegridapplication=DEBUG
```

> XAMPP must be running (MySQL started in the XAMPP Control Panel) before you run the app.

---

## 5. Pages

Every page loads the shared files first, then its own script:

```html
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/zones.css">        <!-- pages that show a grid or badges -->
<link rel="stylesheet" href="/css/grid.css">         <!-- pages that show a grid -->
...
<script src="/js/common/api.js"></script>
<script src="/js/common/auth.js"></script>
<script src="/js/common/format.js"></script>
<script src="/js/common/grid-renderer.js"></script>  <!-- pages that show a grid -->
<script src="/js/pages/<page>.js"></script>
```
Links start with `/` so they work from inside the `landlord/` and `renter/` folders.

| Page | Who | Purpose | Script | Grid? | Endpoints |
|---|---|---|---|---|---|
| `index.html` | everyone | Old welcome page, Login / Register / Browse buttons | none | | none |
| `homepage.html` | everyone | **Front door (`/`).** Browse spaces with free blocks: search, type / min-blocks / power filters, sort, pagination, saved spaces, details window. Each card shows the layout (free units bright); the details window has a bigger map where a renter clicks a free unit to pick it. Renters send a lease request there; guests are sent to log in. Uses Tailwind CDN, not `base.css`, and the shared top bar in public mode (`nav.js`, guests get Log in / Register) | `homepage.js` | ✔ read-only | `GET /api/browse`, `GET /api/browse/{id}`, `GET /api/browse/{id}/layout`, `GET /api/auth/me` (plain fetch), `POST /api/lease-requests`, `POST /api/auth/logout` |
| `requests.html` | both | Renter: own requests + Cancel. Landlord: incoming requests + Approve / Decline, "Create lease" on approved ones | `requests.js` | | `GET /api/lease-requests`, `POST …/{id}/approve`, `…/decline`, `…/cancel` |
| `login.html` | everyone | Login, then redirect by role | `login.js` | | `POST /api/auth/login` |
| `register.html` | everyone | Create an account (choose role), then logged in right away | `register.js` | | `POST /api/auth/register`, `POST /api/auth/login` |
| `landlord/dashboard.html` | landlord | Property cards (cover photo with a layout inset, or the layout alone, plus a "View/Edit Layout" button; occupancy, income from active leases), search, type / occupancy / published filters; card → modal with Units, Grid, Edit, Leases, Publish / Archive | `landlord-dashboard.js` | ✔ read-only | `GET /api/properties`, `GET /api/leases`, `POST /api/properties/{id}/publish`, `POST …/{id}/archive` |
| `landlord/property-form.html` | landlord | Add (no id) or edit (`?id=`) a property: street / city / region, type, description, default rate, area, amenities, photos and site plans (map pin is a placeholder); save draft / publish / archive | `property-form.js` | | `GET/POST/PUT /api/properties`, `POST …/{id}/publish`, `POST …/{id}/archive`, `GET/POST /api/properties/{id}/files`, `DELETE /api/files/{id}` |
| `landlord/property-grid.html` | landlord | Grid plotter: resize, paint units and common areas, edit walls/doors/windows, add unit (rate starts at the default rate) or common area | `property-grid.js` | ✔ editable | `GET /api/properties/{id}`, `PUT …/{id}/grid`, `PUT …/{id}/edges`, `POST …/{id}/units`, `POST …/{id}/common-areas` |
| `landlord/units.html` | landlord | `?propertyId=`: Map / List toggle. Map = the property's grid, read-only, units colored by status, filters dim the others, click a unit → Quick Edit. List = compact unit cards (name, status, rate, tenant). Quick Edit (status, "Rate for new leases" with a note about the current lease, unit photos); Create Lease / View Lease | `units.js` | ✔ read-only | `GET /api/properties`, `GET /api/properties/{id}`, `GET /api/properties/{id}/units`, `GET …/{id}/leases`, `PUT /api/units/{id}`, `POST /api/units/{id}/maintenance`, `GET/POST /api/units/{id}/files`, `DELETE /api/files/{id}` |
| `landlord/leases.html` | landlord | All leases (or `?propertyId=`) with contract state and payment status (Paid / Pending / Overdue), filters, details modal with the contract PDF; renew / terminate | `leases.js` | | `GET /api/leases`, `GET /api/properties/{id}/leases`, `GET /api/leases/{id}/statement`, `GET /api/leases/{id}/files`, `GET /api/lease-requests`, `POST /api/leases/{id}/terminate` |
| `landlord/lease-form.html` | landlord | New lease (`?unitId=`, `?requestId=` prefill), or renew (`?renew=<leaseId>`): renter account + contact details, unit, dates, rent, payment terms, contract PDF | `lease-form.js` | | `GET /api/renters`, `GET /api/properties`, `GET …/{id}/units`, `POST /api/leases`, `POST /api/leases/{id}/renew`, `POST /api/leases/{id}/files` |
| `lease.html` | both | Lease details, unit location on the grid, statement by billing period, payment history, contract. **Landlord:** End / Terminate / Renew, upload contract. **Renter:** "Pay" on the oldest unpaid period. | `lease.js` | ✔ read-only | `GET /api/leases/{id}`, `GET …/{id}/property`, `GET …/{id}/statement`, `GET …/{id}/payments`, `GET/POST …/{id}/files`, `POST …/{id}/end`, `POST …/{id}/terminate` |
| `contract.html` | both | Generic lease agreement filled in from the lease (parties, premises, term, rent and payment terms, standard clauses, signature lines). "Print / Save as PDF" prints only the document. The signed scan is uploaded on `lease.html` as the "Signed copy". | `contract.js` | | `GET /api/leases/{id}`, `GET …/{id}/property` |
| `renter/dashboard.html` | renter | "My Leases": tiles (active leases, next payment, overdue months), pending-requests link, Current and Past lease cards (unit photo or the layout with the unit outlined, Lease Status + meaning, next due, View lease / Pay), search | `renter-dashboard.js` | ✔ read-only | `GET /api/leases`, `GET /api/leases/{id}/statement`, `GET /api/leases/{id}/property`, `GET /api/lease-requests` |
| `renter/pay.html` | renter | Simulated checkout for one period (`?leaseId=&month=`): summary (lease, period, amount, due date, status), method cards (GCash / Maya / Card), account number, receipt with reference number and "Pay next" | `pay.js` | | `GET /api/leases/{id}`, `GET /api/leases/{id}/statement`, `POST /api/leases/{id}/payments` |

### Shared CSS and JS

| File | Responsibility |
|---|---|
| `css/base.css` | Only for `login.html`, `register.html`, `index.html` and the plotter (the other pages use Tailwind): colors, buttons, forms, cards, badges, toasts |
| `css/grid.css` | Grid structure only: cell size, edge thickness, door/window shapes, labels |
| `css/zones.css` | **The file to edit to customize the look.** One rule per CSS class from the enums: `.zone-walkway`, `.zone-grass`, `.zone-bathroom`, …, `.status-available`, `.status-occupied`, …, `.edge-wall`, `.edge-door`, `.edge-window`, plus lease/due badges (`.state-expiring-soon`, `.due-overdue`, …). Default rule: `.zone { background: var(--zone-color); }` |
| `js/common/api.js` | `fetch` wrapper: JSON in/out, shows `{"error": …}` messages, 401 → `/login.html` |
| `js/common/auth.js` | `requireLogin(role)`: checks `/api/auth/me`, sends the wrong role away, fills the nav bar, logout button |
| `js/common/nav.js` | Builds the shared top bar into `<header id="appNav" data-page="…">`: links per role, bell with request count, user menu, Log Out |
| `js/common/format.js` | ₱ amounts, dates, "12 days left", badge HTML from a state's `cssClass` |
| `js/common/grid-renderer.js` | Draws a property's zones and edges (automatic walls + overrides) from the property JSON. Editable mode for the plotter; read-only mode with one unit highlighted for `lease.html`. Also `applyEdgeTool` and `snapshot`/`restore` (undo). |
| `css/plotter.css` | Plotter page only: full-window canvas, floating toolbar, Zones panel, popovers, shortcuts dialog |
| `js/common/floating-panel.js` | Drag / minimize / dock a floating panel; remembers its place in localStorage |

---

## 6. Moving from the old Swing project

1. **Make a new Git branch** (e.g. `feature/web-version`) so the Swing version stays safe.
2. **Replace `pom.xml`** with the new one, then right-click the project → *Reload POM* and *Build with Dependencies* (needs internet the first time).
3. **Delete:** the `ui/` package (all frames and dialogs), `SpaceGrid.java`, `config/DatabaseConnection.java`, and the earlier grid-plotter files (`GridDAO`, `GridController`, `SessionUtil`, `GridCell`, `dto/`, `grid.html`).
4. **Old DAOs** (`UserDAO`, `PropertyDAO`, `RentableUnitDAO`): copy any SQL you want to reuse into the new `Jdbc…Dao` classes, then delete them. The old `model/` classes are replaced by the Phase 1 versions.
5. **Create the packages and folders** from section 2. In NetBeans: right-click *Source Packages* → New → Java Package; right-click *Other Sources* → New → Folder for `static/…`.
6. **Run `database/spacegrid_db.sql`** in MySQL Workbench (it recreates `spacegrid_db` with sample data).

---

## 7. Tests (kept, written later)

The test classes stay in the structure but are **written after the matching code works**, as the last step of coding:

| Test class | Write it after | What it checks |
|---|---|---|
| `SpaceGridApplicationTests` | All controllers, services and DAOs exist | The whole app starts (`contextLoads`); catches missing annotations or bad properties. Needs XAMPP running. |
| `model/PropertyTest` | `Property`, `GridZone`, `RentableUnit`, `CommonArea`, `GridEdge` | Overlaps, bounds, resize, automatic walls, door overrides, archiving clears spots. No database needed. |
| `model/LeaseContractTest` | `LeaseContract`, `LeaseState` | Each lease state for a given "today", invalid dates, billing months, due dates in short months, renewal stops billing. No database needed. |

Run them in NetBeans: right-click the project → **Test**, or right-click one test file → **Test File**.

---

## 8. Suggested coding order (for the next phase)

1. `model` (enums and value objects first, then entities)
2. `exception`, then `security` and `payment`
3. `dao` interfaces → `dao.jdbc` implementations
4. `service`
5. `controller` + `application.properties` → test the API in the browser or Postman
6. `static`: shared CSS/JS first, then pages: login/register → landlord dashboard → property form → grid plotter → units → leases → lease details → renter pages
7. Tests (section 7)
