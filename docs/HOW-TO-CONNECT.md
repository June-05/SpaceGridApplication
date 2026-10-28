# How the HTML pages talk to the controllers

This guide explains how each page in `src/main/resources/static` uses the Spring Boot controllers. Each HTML file
also has a short comment block listing its own endpoints, and each page script lists the exact `api.*` calls.

---

## 1. The big picture

```
Browser (HTML + JS)  ──fetch()──►  Controller  ──►  Service  ──►  DAO  ──►  MySQL
        ▲                              │
        └──────────── JSON ◄───────────┘
```

- Spring Boot serves **both** the pages and the API from `http://localhost:8080`:
  - `/login.html`, `/landlord/dashboard.html`, … are files in `src/main/resources/static`.
  - `/api/...` are the controller methods.
- Because pages and API come from the **same address**, there's no CORS setup to do, and the browser sends
  the login session cookie automatically with every request.
- A controller method's return value is turned into **JSON** automatically, using the class's getters.
  Fields marked `@JsonIgnore` (like `passwordHash`) are never sent.

## 2. The three helper files every page loads

```html
<script src="/js/common/api.js"></script>      <!-- talking to the API -->
<script src="/js/common/auth.js"></script>     <!-- login check, logout -->
<script src="/js/common/format.js"></script>   <!-- ₱ amounts, dates, badge classes (optional) -->
<script src="/js/pages/<page>.js"></script>    <!-- the page's own script, always last -->
```
Paths start with `/` so they work from inside the `landlord/` and `renter/` folders.

## 3. Sending data: match the controller's annotation

| Controller parameter | What it means | In JavaScript |
|---|---|---|
| `@PathVariable int id` | Part of the URL | `` api.get(`/api/properties/${id}`) `` |
| `@RequestParam String name` | A form field, or a `?name=` in the URL | `api.form('POST', url, { name })` |
| `@RequestParam(required = false)` | Optional: leave it out → `null` | Don't include the key at all |
| `@RequestBody Map<...>` | A JSON body | `api.json('PUT', url, data)`: only the two grid saves |
| `HttpSession session` | The logged-in user's session | Nothing: the browser sends the cookie |

Examples:
```js
// GET with query string (PropertyController.list)
const props = await api.get('/api/properties?search=bajada&type=APARTMENT');

// POST with form fields (AuthController.login)
const user = await api.form('POST', '/api/auth/login', { username: 'maria.santos', password: 'password123' });

// PUT with query string + JSON body (PropertyController.saveGrid)
await api.json('PUT', '/api/properties/1/grid?rows=4&cols=6', { "1": [{ row: 0, col: 0 }] });
```

**Field names must match the `@RequestParam` names exactly.** An easy way to do that is to give the HTML inputs
the same `name`s and read the whole form:
```js
const data = Object.fromEntries(new FormData(formElement));   // { name: "...", address: "...", ... }
await api.form('POST', '/api/properties', data);
```
Remove empty optional fields first (`if (!data.areaSqm) delete data.areaSqm;`). Otherwise an empty string is sent
and a number field fails to convert.

## 4. Value formats

| Java type | Send / receive as | Example |
|---|---|---|
| `int`, `BigDecimal` | number text | `12500`, `12500.50` |
| `boolean` | `true` / `false` | `electricity: true` |
| Enums (`Role`, `PropertyType`, …) | the **name** | `"LANDLORD"`, `"EXPIRING_SOON"` |
| `LocalDate` | `yyyy-MM-dd` (what `<input type="date">` gives) | `"2026-11-01"` |
| `YearMonth` | `yyyy-MM` (what `<input type="month">` gives) | `"2026-11"` |
| `LocalDateTime` | ISO text (received only) | `"2026-10-20T10:15:00"` |

**Enum → CSS class:** the class is a prefix plus the name in lowercase with dashes. `format.cssClass` does this:

| Enum | Prefix | Example |
|---|---|---|
| `UnitStatus` | `status-` | `status-under-maintenance` |
| `LeaseState` | `state-` | `state-expiring-soon` |
| `DueStatus` | `due-` | `due-overdue` |
| `CommonAreaType` | `zone-` | `zone-grass` |
| `EdgeType` | `edge-` | `edge-door` |

Grid zones already come with their classes and color (`cssClasses`, `color`). The styles themselves live in
`css/zones.css`.

## 5. What comes back (JSON shapes)

The JSON keys are the getter names without `get`/`is` (`getFullName()` → `fullName`).

| Endpoint returns | Main JSON fields |
|---|---|
| `User` | `id, createdAt, username, fullName, role` |
| `Property` | `id, landlordId, name, address, propertyType, description, dimensions{exact, description, areaSqm}, status, gridRows, gridColumns, zones[], edgesByType{}` |
| zone in `zones[]` | `id, propertyId, name, positions[{row, col}], rentable, enclosed, cssClasses, color`, plus unit fields (`rentalRate, status, …`) or `areaType` |
| `RentableUnit` | `id, propertyId, name, positions, rentalRate, dimensions, includesElectricity, includesWater, status, …` |
| `LeaseContract` | `id, unitId, renterId, startDate, endDate, monthlyRent, previousLeaseId, status, closedOn, unitName, propertyName, renterName, currentState, daysRemaining` |
| `RentDue` | `billingMonth, dueDate, amountDue, status` |
| `Payment` | `id, leaseId, billingMonth, amount, method, status, referenceNo, paidAt` |
| `PropertyListing` (`/api/browse`) | `id, name, address, propertyType, description, landlordName, createdAt, units[], availableBlocks, minRate, maxRate, powerIncluded, waterIncluded` |
| unit in `units[]` | `id, name, rentalRate, dimensions{exact, description, areaSqm} or null, includesElectricity, includesWater` |
| `LeaseRequest` | `id, unitId, renterId, desiredStart, months, message, status, decidedAt, createdAt, propertyId, landlordId, unitName, propertyName, renterName, monthlyRate, suggestedEndDate` |

To see the real JSON at any time, open a GET URL in the browser while logged in, e.g. `http://localhost:8080/api/auth/me`.

## 6. Errors

`GlobalExceptionHandler` turns every service error into `{"error": "message"}` with a status code. `api.js` throws
it as a normal JavaScript error, so every call can be wrapped like this:
```js
try {
  await api.form('POST', '/api/leases', fields);
} catch (err) {
  errorBox.textContent = err.message;      // e.g. "This unit already has an active lease."
}
```

| Status | Exception | Typical cause |
|---|---|---|
| 400 | `ValidationException` | Blank name, negative rent, end date before start |
| 401 | `UnauthenticatedException` | Not logged in → `api.js` redirects to `/login.html` |
| 403 | `AccessDeniedException` | Not your property / wrong role |
| 404 | `NotFoundException` | Wrong id in the URL |
| 409 | `ConflictException` | Username taken, unit already leased, deleting a unit with leases |
| 500 | anything else | A bug: check the NetBeans output window |

While a method is still a skeleton, it throws `UnsupportedOperationException("TODO")`, which shows up as a **500**.

## 7. Login and roles

- `login.html` posts to `/api/auth/login`. The controller stores the user's id in the session (`SessionManager`).
- Every protected page script starts with:
  ```js
  const user = await auth.requireLogin('LANDLORD');   // or 'RENTER'; no argument = either role
  ```
  This calls `GET /api/auth/me`, sends logged-out users to the login page, and sends the wrong role to their own dashboard.
- The page **never sends a user id or landlord id**. The controllers always take the user from the session, so
  nobody can act as someone else by editing a request.

## 8. Passing data between pages

Use the URL, the same way `new EditFrame(id)` passed data in Swing:
```js
location.href = `/landlord/property-grid.html?id=${property.id}`;   // going to a page
const id = new URLSearchParams(location.search).get('id');          // reading it on that page
```
URLs used by the pages: `property-form.html?id=`, `property-grid.html?id=`, `units.html?propertyId=`,
`lease.html?id=`, `lease-form.html?renew=`, `lease-form.html?requestId=` (from an approved request), `pay.html?leaseId=&month=`,
`/?space=` (homepage, opens that space's details window; used to come back after logging in).

Short page routes (set in `config/WebConfig`): `/`, `/home`, `/browse` → `homepage.html`; `/login`; `/register`; `/requests`.

## 8b. The public homepage is different

`homepage.html` is the only page that works **without login**, so it does not use `auth.requireLogin` (that would send guests to
the login page). It calls `GET /api/browse` (no session needed), and asks `GET /api/auth/me` with a plain `fetch`: a 401 simply means
"guest". It loads `api.js` only for the lease-request POST and the logout. The request form sends form fields
`unitId, startDate (yyyy-MM-dd), months, message` to `POST /api/lease-requests`, which needs a RENTER login.

## 9. The grid page in short

1. `GET /api/properties/{id}` returns the size, zones (each with `positions`, `cssClasses`, `color`, `enclosed`) and `edgesByType`.
2. `grid-renderer.js` draws the cells and edges. Automatic walls use the same rule as `Property.autoEdgeAt` in Java,
   repeated in JS so the walls update live while editing.
3. "Save layout" sends two requests, in this order:
   - `PUT /api/properties/{id}/grid?rows=&cols=` with JSON `{ "zoneId": [{row, col}, …] }`
   - `PUT /api/properties/{id}/edges` with JSON `{ "DOOR": [{row, col, orientation}], … }`
4. Adding a unit or common area uses the normal form endpoints, then reload the property.

## 10. Testing an endpoint before its page exists

- **GET:** open the URL in the browser while logged in.
- **POST/PUT/DELETE:** open any page, press F12 → Console, and type (api.js is already loaded):
  ```js
  await api.form('POST', '/api/auth/login', { username: 'maria.santos', password: 'password123' })
  await api.get('/api/properties')
  ```
- Or use Postman: send form fields as `x-www-form-urlencoded`, and log in first so it keeps the session cookie.

## 11. Suggested order

1. Implement `AuthService` + `AuthController` + `SessionManager`, then build `login.html` / `register.html`.
2. Landlord dashboard → property form → units → grid plotter.
3. Leases (landlord) → lease details → renter dashboard → pay page.

Test each endpoint in the browser console (section 10) before building its page.
