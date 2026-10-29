# SpaceGrid

Property rental management for landlords and renters in Davao City: grid plotting of properties, lease contracts
and simulated rent payments. Java 17 · Spring Boot 4.1.1 · JdbcTemplate · MySQL (XAMPP) · HTML/CSS/JS.

## Status: skeleton

This project is the **structure only**, generated from the Phase 1–3 specifications:

| Part | What's in it |
|---|---|
| Java classes (64) | Fields, constructors (with input checks), getters, Spring annotations, endpoint mappings. **Every other method is empty** with a `// TODO` hint and `throw new UnsupportedOperationException("TODO")` so it compiles. |
| Enums | Complete: values, labels, CSS classes, default colors |
| `application.properties` | Complete (XAMPP: root, no password) |
| `database/spacegrid_db.sql` | Complete schema + sample data (Phase 2) |
| HTML / CSS / JS | Short starter templates with help comments. `api.js` and `auth.js` are small working helpers. |
| Tests | Test classes with the planned test names, `@Disabled` until the code exists |

Guides:
- **`docs/projectfiles/HOW-TO-CONNECT.md`**: how the pages call the controllers (form vs JSON, value formats, JSON shapes, errors, login)
- Each HTML file's comment block lists its endpoints; each page script lists its exact `api.*` calls.

## Run it

1. XAMPP Control Panel → start **MySQL**.
2. MySQL Workbench → open and execute `database/spacegrid_db.sql` (first time only; it recreates `spacegrid_db`).
3. NetBeans → open the project → right-click → *Build with Dependencies* (needs internet the first time) → *Run Project*.
4. Browser → `http://localhost:8080/`

Sample logins (password `password123`): landlords `maria.santos`, `jose.reyes`; renters `ana.cruz`, `paolo.garcia`, `liza.mendoza`.

The app starts even though the methods are empty. Calling an endpoint that isn't implemented yet returns a
500 error until you fill in its TODOs.

## Small adjustments to the Phase 1 spec (made while writing the skeleton)

| Change | Why |
|---|---|
| "From database" constructors of `Property`, `RentableUnit` and `CommonArea` also take their zones / spots / edge overrides | DAOs live in another package and can't call the package-private grid methods; building complete objects through the constructor keeps the grid rules encapsulated |
| `JdbcPropertyDao.loadZones` / `loadEdgeOverrides` and `Jdbc…Dao.loadPositions` **return** their data | Same reason (they feed the constructors) |
| `Property.getEdgesByType()` added; `getEdgeOverrides()` hidden from JSON | A map with object keys can't become JSON; this matches the shape the grid page sends to `PUT /edges` |
| `LeaseContract.getCurrentState()` and `getDaysRemaining()` (no-argument versions) added | So the lease JSON includes `currentState` and `daysRemaining` for the lease screens |
| Value objects are Java `record`s | Immutable, with `equals()`/`hashCode()` generated (records' accessors are `row()`, not `getRow()`) |
| Helper booleans (`isNew`, `isAvailable`, `isPaid`, …) are `@JsonIgnore` | They'd duplicate fields in the JSON |

## Suggested coding order

1. `model`: enums are done; then `BaseEntity`, value objects, entities
2. `exception` (`getHttpStatus`, `GlobalExceptionHandler`), `security`, `payment`
3. `dao.jdbc` implementations (RowMappers + SQL)
4. `service`
5. `controller`: test each endpoint in the browser (see `docs/projectfiles/HOW-TO-CONNECT.md` §10)
6. Pages: login/register → landlord pages → lease pages → renter pages
7. Tests: remove `@Disabled` and write them
