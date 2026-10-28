# SpaceGrid · Phase 1: Final Class Specification

Java 17 · Spring Boot · JdbcTemplate · MySQL · HTML/JS frontend. Base package: `com.techhub.spacegridapplication`. Companion diagram: `SpaceGrid-Phase1-ClassDiagram.drawio` (page 1: Domain Model, page 2: Application Layers).

## 1. Design decisions

- **Layers:** controller → service → DAO (interface) → MySQL. The model package holds data and rules, and has no SQL or web code.
- **No DTOs.** `passwordHash` is hidden with `@JsonIgnore`. Controllers take simple request parameters and always set the owner/renter from the session, never from the browser. The grid uses `Map` bodies (`spotsByZone`, `edgesByType`).
- **One `User` class with a `Role` enum** (LANDLORD, RENTER). Both roles share the same fields, so subclasses would add nothing.
- **`GridZone` is abstract.** `RentableUnit` and `CommonArea` extend it, so walkways, grass and shared rooms take up grid spots without becoming rentable.
- **Walls are automatic but can be edited.** Walls are calculated; the landlord's changes are saved as overrides (`WALL`, `DOOR`, `WINDOW`, `OPEN`).
- **Colors come from CSS classes.** Enums carry a `cssClass` and a `defaultColor`. The page puts the class on the spot and sets `--zone-color`; any class can be restyled in CSS (textures, icons).
- **Leases can't be edited.** Terms are `final`. A change means end/terminate and create a new lease, or **Renew** (one step, linked by `previousLeaseId`).
- **Payments are simulated.** The payment step sits behind `PaymentGateway`; `FakePaymentGateway` can later be swapped for a real provider without changing other classes.
- **No lease amendments or notifications.** Lease states (Expiring soon, Expired) are calculated and shown on both lease screens instead.

## 2. Packages

| Package | Responsibility | Classes |
|---|---|---|
| `model` | Data and rules of the system: entities, enums and value objects. No SQL, no web code. | 26 |
| `dao` | Database access. Interfaces say what can be saved or loaded; Jdbc classes run the SQL with JdbcTemplate. | 13 |
| `service` | Business rules: ownership checks, lease rules, payment rules. Called by controllers, uses DAOs. | 6 |
| `controller` | Web API for the HTML pages. Reads the request, calls one service method, returns JSON. | 6 |
| `security` | Password hashing and tracking who is logged in. | 3 |
| `payment` | The payment step, hidden behind an interface. FakePaymentGateway simulates GCash, Maya and Card. | 2 |
| `exception` | Custom error types and the handler that turns them into JSON error messages. | 7 |
| `(root)` | Entry point that starts Spring Boot. | 1 |
| **Total** | | **64** |

## 3. Conventions (apply to every class)

- All fields are `private`, every field has a public getter, and there are no public setters. Data changes only through the listed methods, which check their input.
- Each entity has a "new" constructor (checks input, no id) and a "from database" constructor (`id`, `createdAt`, all fields) used by the RowMappers.
- Value objects are immutable and compare by value (`equals`/`hashCode`); they can be written as Java `record`s.
- Services, DAOs and controllers receive their dependencies through the constructor (Spring dependency injection).
- Every controller method also receives `HttpSession` and uses `SessionManager` to get the current user.
- Notation: `+` public, `-` private, `#` protected, `~` package-private.

## 4. Classes

### Package `model`

#### `BaseEntity`, Class · abstract

Parent of every entity. assignId() is called once by the DAO after INSERT; equals() compares ids.

```
- id: Integer
- createdAt: LocalDateTime

# BaseEntity()
# BaseEntity(id: int, createdAt: LocalDateTime)
+ isNew(): boolean
+ assignId(id: int): void
+ equals(o: Object): boolean
+ hashCode(): int
```

#### `User`, Class · entity · extends `BaseEntity`

An account. The password hash is never sent to the browser.

```
- username: String
- passwordHash: String {@JsonIgnore}
- fullName: String
- role: Role

+ User(username: String, passwordHash: String, fullName: String, role: Role)
+ isLandlord(): boolean
+ isRenter(): boolean
+ changePassword(newHash: String): void
+ updateFullName(fullName: String): void
```

#### `Role`, Class · enumeration

```
Values: LANDLORD, RENTER
- label: String

+ getLabel(): String
```

#### `Property`, Class · entity · extends `BaseEntity`

Owns its zones and the grid rules that involve more than one zone (no overlaps, bounds, automatic walls).

```
+ MAX_GRID_SIZE: int = 30   «static»
- landlordId: int
- name: String
- address: String
- propertyType: PropertyType
- description: String
- dimensions: Dimensions
- status: PropertyStatus
- gridRows: int
- gridColumns: int
- zones: List<GridZone>
- edgeOverrides: Map<GridEdge, EdgeType>

+ Property(landlordId: int, name: String, address: String, propertyType: PropertyType, description: String, dimensions: Dimensions)
+ updateDetails(name: String, address: String, propertyType: PropertyType, description: String, dimensions: Dimensions): void
+ publish(): void
+ archive(): void
+ isOwnedBy(userId: int): boolean
+ addZone(zone: GridZone): void
+ removeZone(zone: GridZone): void
+ archiveUnit(unit: RentableUnit): void
+ getZones(): List<GridZone>
+ getRentableUnits(): List<RentableUnit>
+ getCommonAreas(): List<CommonArea>
+ countUnitsByStatus(status: UnitStatus): int
+ resizeGrid(rows: int, cols: int): void
+ isWithinGrid(position: GridPosition): boolean
+ zoneAt(position: GridPosition): Optional<GridZone>
+ assignSpot(zone: GridZone, position: GridPosition): void
+ clearSpot(position: GridPosition): void
+ clearAllSpots(): void
+ totalSpots(): int
+ assignedSpotCount(): int
+ autoEdgeAt(edge: GridEdge): Optional<EdgeType>
+ edgeAt(position: GridPosition, side: Side): Optional<EdgeType>
+ setEdge(position: GridPosition, side: Side, type: EdgeType): void
+ resetEdge(position: GridPosition, side: Side): void
+ resetAllEdges(): void
- isEnclosedAt(position: GridPosition): boolean
```

#### `PropertyType`, Class · enumeration

```
Values: APARTMENT, CONDOMINIUM, TOWNHOUSE, COMMERCIAL
- label: String

+ getLabel(): String
```

#### `PropertyStatus`, Class · enumeration

```
Values: DRAFT, ACTIVE, ARCHIVED
- label: String

+ getLabel(): String
```

#### `GridZone`, Class · abstract · extends `BaseEntity`

Anything that takes up spots on the grid. Spots can only be changed through Property (package-private ~ methods).

```
- propertyId: int
- name: String
- positions: Set<GridPosition>

# GridZone(propertyId: int, name: String)
+ rename(name: String): void
+ occupies(position: GridPosition): boolean
+ getPositions(): Set<GridPosition>
+ spotCount(): int
~ addPosition(position: GridPosition): void
~ removePosition(position: GridPosition): void
~ clearPositions(): void
+ isRentable(): boolean   «abstract»
+ isEnclosed(): boolean   «abstract»
+ getCssClasses(): String   «abstract»
+ getColor(): String   «abstract»
```

#### `RentableUnit`, Class · entity · extends `GridZone`

A space that can be leased. isRentable() and isEnclosed() return true; CSS classes: "zone zone-unit status-available".

```
- rentalRate: BigDecimal
- dimensions: Dimensions
- includesElectricity: boolean
- includesWater: boolean
- status: UnitStatus

+ RentableUnit(propertyId: int, name: String, rentalRate: BigDecimal, dimensions: Dimensions, includesElectricity: boolean, includesWater: boolean)
+ updateDetails(name: String, dimensions: Dimensions, includesElectricity: boolean, includesWater: boolean): void
+ changeRate(rate: BigDecimal): void
+ isAvailable(): boolean
+ markOccupied(): void
+ markAvailable(): void
+ markUnderMaintenance(): void
+ isArchived(): boolean
~ archive(): void
+ isRentable(): boolean
+ isEnclosed(): boolean
+ getCssClasses(): String
+ getColor(): String
```

#### `UnitStatus`, Class · enumeration

ARCHIVED: kept for lease and payment history, removed from the grid, can't be leased again.

```
Values: AVAILABLE, OCCUPIED, UNDER_MAINTENANCE, ARCHIVED
- label: String
- cssClass: String
- defaultColor: String

+ getLabel(): String
+ getCssClass(): String
+ getDefaultColor(): String
```

#### `CommonArea`, Class · entity · extends `GridZone`

A non-rentable zone (walkway, grass, shared bathroom...). isRentable() is false; isEnclosed() follows areaType.isIndoor().

```
- areaType: CommonAreaType

+ CommonArea(propertyId: int, name: String, areaType: CommonAreaType)
+ changeType(areaType: CommonAreaType): void
+ isRentable(): boolean
+ isEnclosed(): boolean
+ getCssClasses(): String
+ getColor(): String
```

#### `CommonAreaType`, Class · enumeration

```
Values: WALKWAY, GRASS, BATHROOM, KITCHEN, LAUNDRY, LOBBY, PARKING, STAIRS
- label: String
- cssClass: String
- defaultColor: String
- indoor: boolean

+ getLabel(): String
+ getCssClass(): String
+ getDefaultColor(): String
+ isIndoor(): boolean
```

#### `LeaseContract`, Class · entity · extends `BaseEntity`

Terms are final and can't be edited. To change them: end/terminate and create a new lease, or renew. {readOnly} fields are filled by the DAO for display and never saved.

```
+ EXPIRING_SOON_DAYS: int = 30   «static»
- unitId: int {final}
- renterId: int {final}
- startDate: LocalDate {final}
- endDate: LocalDate {final}
- monthlyRent: BigDecimal {final}
- previousLeaseId: Integer {final}
- status: LeaseStatus
- closedOn: LocalDate
- unitName: String {readOnly}
- propertyName: String {readOnly}
- renterName: String {readOnly}

+ LeaseContract(unitId: int, renterId: int, startDate: LocalDate, endDate: LocalDate, monthlyRent: BigDecimal, previousLeaseId: Integer)
+ getCurrentState(today: LocalDate): LeaseState
+ daysRemaining(today: LocalDate): long
+ durationInMonths(): long
+ isRentedBy(renterId: int): boolean
+ isRenewal(): boolean
+ billingMonths(): List<YearMonth>
+ dueDateFor(month: YearMonth): LocalDate
+ end(today: LocalDate): void
+ terminate(today: LocalDate): void
+ markRenewed(lastDay: LocalDate): void
```

#### `LeaseStatus`, Class · enumeration

```
Values: ACTIVE, ENDED, TERMINATED, RENEWED
- label: String

+ getLabel(): String
```

#### `LeaseState`, Class · enumeration

Calculated, never saved: what the lease screens show.

```
Values: UPCOMING, ACTIVE, EXPIRING_SOON, EXPIRED, ENDED, TERMINATED, RENEWED
- label: String
- cssClass: String

+ getLabel(): String
+ getCssClass(): String
```

#### `Payment`, Class · entity · extends `BaseEntity`

One payment attempt for one billing month. Stores its own amount.

```
- leaseId: int
- renterId: int
- billingMonth: YearMonth
- amount: BigDecimal
- method: PaymentMethod
- status: PaymentStatus
- referenceNo: String
- paidAt: LocalDateTime

+ Payment(leaseId: int, renterId: int, billingMonth: YearMonth, amount: BigDecimal, method: PaymentMethod)
+ markPaid(referenceNo: String, paidAt: LocalDateTime): void
+ markFailed(): void
+ isPaid(): boolean
```

#### `PaymentStatus`, Class · enumeration

```
Values: PENDING, PAID, FAILED
- label: String

+ getLabel(): String
```

#### `PaymentMethod`, Class · enumeration

```
Values: GCASH, MAYA, CARD
- label: String

+ getLabel(): String
```

#### `DueStatus`, Class · enumeration

```
Values: UPCOMING, DUE, OVERDUE, PAID
- label: String
- cssClass: String

+ getLabel(): String
+ getCssClass(): String
```

#### `RentDue`, Class · value object

One line of a renter's rent statement.

```
- billingMonth: YearMonth
- dueDate: LocalDate
- amountDue: BigDecimal
- status: DueStatus

+ RentDue(billingMonth: YearMonth, dueDate: LocalDate, amountDue: BigDecimal, status: DueStatus)
+ isPayable(): boolean
```

#### `PaymentResult`, Class · value object

What the payment gateway answers.

```
- success: boolean
- referenceNo: String
- message: String

+ approved(referenceNo: String): PaymentResult   «static»
+ declined(message: String): PaymentResult   «static»
```

#### `Dimensions`, Class · value object

Size of a property or unit: an exact area in sqm, or a description when not exact.

```
- exact: boolean
- description: String
- areaSqm: BigDecimal

+ exact(areaSqm: BigDecimal): Dimensions   «static»
+ approximate(description: String): Dimensions   «static»
+ toDisplayString(): String
```

#### `GridPosition`, Class · value object

One spot on the grid (0-based row and column).

```
- row: int
- col: int

+ GridPosition(row: int, col: int)
+ isWithin(rows: int, cols: int): boolean
+ neighbor(side: Side): GridPosition
+ toDisplayString(): String
```

#### `GridEdge`, Class · value object

One line between spots, always stored as the line ABOVE (horizontal) or LEFT OF (vertical) a spot.

```
- row: int
- col: int
- orientation: Orientation

+ of(position: GridPosition, side: Side): GridEdge   «static»
+ isWithin(rows: int, cols: int): boolean
+ adjacentPositions(): List<GridPosition>
```

#### `Side`, Class · enumeration

```
Values: TOP, RIGHT, BOTTOM, LEFT

+ opposite(): Side
```

#### `Orientation`, Class · enumeration

```
Values: HORIZONTAL, VERTICAL
```

#### `EdgeType`, Class · enumeration

OPEN removes an automatic wall.

```
Values: WALL, DOOR, WINDOW, OPEN
- label: String
- cssClass: String

+ getLabel(): String
+ getCssClass(): String
```

### Package `dao`

#### `CrudDao<T>`, Interface · interface

Generic interface shared by all DAOs.

```
+ findById(id: int): Optional<T>
+ save(entity: T): T
+ update(entity: T): void
+ deleteById(id: int): void
```

#### `UserDao`, Interface · interface · extends `CrudDao<User>`

```
+ findByUsername(username: String): Optional<User>
+ existsByUsername(username: String): boolean
```

#### `JdbcUserDao`, Class · repository · implements `UserDao`

```
- jdbcTemplate: JdbcTemplate
- rowMapper: RowMapper<User>

+ JdbcUserDao(jdbcTemplate: JdbcTemplate)
+ «all UserDao methods»
```

#### `PropertyDao`, Interface · interface · extends `CrudDao<Property>`

```
+ findByLandlordId(landlordId: int): List<Property>
+ saveGridLayout(property: Property): void
+ saveEdgeOverrides(property: Property): void
```

#### `JdbcPropertyDao`, Class · repository · implements `PropertyDao`

```
- jdbcTemplate: JdbcTemplate
- rowMapper: RowMapper<Property>

+ JdbcPropertyDao(jdbcTemplate: JdbcTemplate)
+ «all PropertyDao methods»
- loadZones(property: Property): void
- loadEdgeOverrides(property: Property): void
```

#### `RentableUnitDao`, Interface · interface · extends `CrudDao<RentableUnit>`

```
+ findByPropertyId(propertyId: int): List<RentableUnit>
```

#### `JdbcRentableUnitDao`, Class · repository · implements `RentableUnitDao`

```
- jdbcTemplate: JdbcTemplate
- rowMapper: RowMapper<RentableUnit>

+ JdbcRentableUnitDao(jdbcTemplate: JdbcTemplate)
+ «all RentableUnitDao methods»
- loadPositions(unit: RentableUnit): void
```

#### `CommonAreaDao`, Interface · interface · extends `CrudDao<CommonArea>`

```
+ findByPropertyId(propertyId: int): List<CommonArea>
```

#### `JdbcCommonAreaDao`, Class · repository · implements `CommonAreaDao`

```
- jdbcTemplate: JdbcTemplate
- rowMapper: RowMapper<CommonArea>

+ JdbcCommonAreaDao(jdbcTemplate: JdbcTemplate)
+ «all CommonAreaDao methods»
- loadPositions(area: CommonArea): void
```

#### `LeaseContractDao`, Interface · interface · extends `CrudDao<LeaseContract>`

```
+ findByRenterId(renterId: int): List<LeaseContract>
+ findByLandlordId(landlordId: int): List<LeaseContract>
+ findByPropertyId(propertyId: int): List<LeaseContract>
+ findActiveByUnitId(unitId: int): Optional<LeaseContract>
+ existsByUnitId(unitId: int): boolean
```

#### `JdbcLeaseContractDao`, Class · repository · implements `LeaseContractDao`

```
- jdbcTemplate: JdbcTemplate
- rowMapper: RowMapper<LeaseContract>

+ JdbcLeaseContractDao(jdbcTemplate: JdbcTemplate)
+ «all LeaseContractDao methods»
```

#### `PaymentDao`, Interface · interface · extends `CrudDao<Payment>`

```
+ findByLeaseId(leaseId: int): List<Payment>
+ findPaidMonths(leaseId: int): Set<YearMonth>
```

#### `JdbcPaymentDao`, Class · repository · implements `PaymentDao`

```
- jdbcTemplate: JdbcTemplate
- rowMapper: RowMapper<Payment>

+ JdbcPaymentDao(jdbcTemplate: JdbcTemplate)
+ «all PaymentDao methods»
```

### Package `service`

#### `AuthService`, Class · service

```
- userDao: UserDao
- passwordHasher: PasswordHasher

+ register(username: String, rawPassword: String, fullName: String, role: Role): User
+ login(username: String, rawPassword: String): User
```

#### `PropertyService`, Class · service

```
- propertyDao: PropertyDao

+ getPropertiesForLandlord(landlord: User, search: String, type: PropertyType): List<Property>
+ getOwnedProperty(propertyId: int, landlord: User): Property
+ createProperty(landlord: User, name: String, address: String, type: PropertyType, description: String, dimensions: Dimensions): Property
+ updateProperty(propertyId: int, landlord: User, name: String, address: String, type: PropertyType, description: String, dimensions: Dimensions): Property
+ publishProperty(propertyId: int, landlord: User): void
+ archiveProperty(propertyId: int, landlord: User): void
+ saveGridLayout(propertyId: int, landlord: User, rows: int, cols: int, spotsByZone: Map<Integer, List<GridPosition>>): Property
+ saveEdgeOverrides(propertyId: int, landlord: User, edgesByType: Map<EdgeType, List<GridEdge>>): Property
```

#### `RentableUnitService`, Class · service

```
- unitDao: RentableUnitDao
- leaseDao: LeaseContractDao
- propertyService: PropertyService

+ getUnits(propertyId: int, landlord: User): List<RentableUnit>
+ addUnit(propertyId: int, landlord: User, name: String, rentalRate: BigDecimal, dimensions: Dimensions, electricity: boolean, water: boolean): RentableUnit
+ updateUnit(unitId: int, landlord: User, name: String, rentalRate: BigDecimal, dimensions: Dimensions, electricity: boolean, water: boolean): RentableUnit
+ setUnderMaintenance(unitId: int, landlord: User, underMaintenance: boolean): void
+ archiveUnit(unitId: int, landlord: User): void
+ deleteUnit(unitId: int, landlord: User): void
```

#### `CommonAreaService`, Class · service

```
- commonAreaDao: CommonAreaDao
- propertyService: PropertyService

+ getCommonAreas(propertyId: int, landlord: User): List<CommonArea>
+ addCommonArea(propertyId: int, landlord: User, name: String, areaType: CommonAreaType): CommonArea
+ updateCommonArea(areaId: int, landlord: User, name: String, areaType: CommonAreaType): CommonArea
+ deleteCommonArea(areaId: int, landlord: User): void
```

#### `LeaseService`, Class · service

```
- leaseDao: LeaseContractDao
- unitDao: RentableUnitDao
- userDao: UserDao
- propertyService: PropertyService

+ createLease(landlord: User, unitId: int, renterUsername: String, startDate: LocalDate, endDate: LocalDate, monthlyRent: BigDecimal): LeaseContract
+ renewLease(leaseId: int, landlord: User, newStartDate: LocalDate, newEndDate: LocalDate, newMonthlyRent: BigDecimal): LeaseContract
+ endLease(leaseId: int, landlord: User): void
+ terminateLease(leaseId: int, landlord: User): void
+ getLeasesForLandlord(landlord: User): List<LeaseContract>
+ getLeasesForProperty(propertyId: int, landlord: User): List<LeaseContract>
+ getLeasesForRenter(renter: User): List<LeaseContract>
+ getLeaseFor(leaseId: int, user: User): LeaseContract
```

#### `PaymentService`, Class · service

```
- paymentDao: PaymentDao
- leaseService: LeaseService
- paymentGateway: PaymentGateway

+ getStatement(leaseId: int, user: User, today: LocalDate): List<RentDue>
+ payRent(renter: User, leaseId: int, billingMonth: YearMonth, method: PaymentMethod, accountNumber: String): Payment
+ getPaymentHistory(leaseId: int, user: User): List<Payment>
```

### Package `controller`

#### `AuthController`, Class · controller

```
- authService: AuthService
- sessionManager: SessionManager

+ register(username, password, fullName, role): User
+ login(username, password): User
+ logout(): void
+ me(): User
```

| Endpoint | Method |
|---|---|
| `POST /api/auth/register` | `register` |
| `POST /api/auth/login` | `login` |
| `POST /api/auth/logout` | `logout` |
| `GET /api/auth/me` | `me` |

#### `PropertyController`, Class · controller

```
- propertyService: PropertyService
- sessionManager: SessionManager

+ list(search, type): List<Property>
+ get(id): Property
+ create(name, address, type, description, exactSize, areaSqm, sizeDescription): Property
+ update(id, name, address, type, description, exactSize, areaSqm, sizeDescription): Property
+ publish(id): void
+ archive(id): void
+ saveGrid(id, rows, cols, spotsByZone): Property
+ saveEdges(id, edgesByType): Property
```

| Endpoint | Method |
|---|---|
| `GET /api/properties?search=&type=` | `list` |
| `GET /api/properties/{id}` | `get` |
| `POST /api/properties` | `create` |
| `PUT /api/properties/{id}` | `update` |
| `POST /api/properties/{id}/publish` | `publish` |
| `POST /api/properties/{id}/archive` | `archive` |
| `PUT /api/properties/{id}/grid` | `saveGrid` |
| `PUT /api/properties/{id}/edges` | `saveEdges` |

#### `RentableUnitController`, Class · controller

```
- unitService: RentableUnitService
- sessionManager: SessionManager

+ list(propertyId): List<RentableUnit>
+ create(propertyId, name, rentalRate, exactSize, areaSqm, sizeDescription, electricity, water): RentableUnit
+ update(id, name, rentalRate, exactSize, areaSqm, sizeDescription, electricity, water): RentableUnit
+ setMaintenance(id, underMaintenance): void
+ archive(id): void
+ delete(id): void
```

| Endpoint | Method |
|---|---|
| `GET /api/properties/{propertyId}/units` | `list` |
| `POST /api/properties/{propertyId}/units` | `create` |
| `PUT /api/units/{id}` | `update` |
| `POST /api/units/{id}/maintenance` | `setMaintenance` |
| `POST /api/units/{id}/archive` | `archive` |
| `DELETE /api/units/{id}` | `delete` |

#### `CommonAreaController`, Class · controller

```
- commonAreaService: CommonAreaService
- sessionManager: SessionManager

+ list(propertyId): List<CommonArea>
+ create(propertyId, name, areaType): CommonArea
+ update(id, name, areaType): CommonArea
+ delete(id): void
```

| Endpoint | Method |
|---|---|
| `GET /api/properties/{propertyId}/common-areas` | `list` |
| `POST /api/properties/{propertyId}/common-areas` | `create` |
| `PUT /api/common-areas/{id}` | `update` |
| `DELETE /api/common-areas/{id}` | `delete` |

#### `LeaseController`, Class · controller

```
- leaseService: LeaseService
- sessionManager: SessionManager

+ list(): List<LeaseContract>
+ get(id): LeaseContract
+ listForProperty(propertyId): List<LeaseContract>
+ create(unitId, renterUsername, startDate, endDate, monthlyRent): LeaseContract
+ renew(id, newStartDate, newEndDate, newMonthlyRent): LeaseContract
+ end(id): void
+ terminate(id): void
```

| Endpoint | Method |
|---|---|
| `GET /api/leases` | `list (landlord: all theirs, renter: own)` |
| `GET /api/leases/{id}` | `get` |
| `GET /api/properties/{propertyId}/leases` | `listForProperty` |
| `POST /api/leases` | `create` |
| `POST /api/leases/{id}/renew` | `renew` |
| `POST /api/leases/{id}/end` | `end` |
| `POST /api/leases/{id}/terminate` | `terminate` |

#### `PaymentController`, Class · controller

```
- paymentService: PaymentService
- sessionManager: SessionManager

+ statement(leaseId): List<RentDue>
+ history(leaseId): List<Payment>
+ pay(leaseId, billingMonth, method, accountNumber): Payment
```

| Endpoint | Method |
|---|---|
| `GET /api/leases/{leaseId}/statement` | `statement` |
| `GET /api/leases/{leaseId}/payments` | `history` |
| `POST /api/leases/{leaseId}/payments` | `pay` |

### Package `security`

#### `PasswordHasher`, Interface · interface

```
+ hash(rawPassword: String): String
+ matches(rawPassword: String, hash: String): boolean
```

#### `BCryptPasswordHasher`, Class · implementation · implements `PasswordHasher`

```
+ hash(rawPassword: String): String
+ matches(rawPassword: String, hash: String): boolean
```

#### `SessionManager`, Class · component

```
- SESSION_KEY: String = "userId"   «static»
- userDao: UserDao

+ login(session: HttpSession, user: User): void
+ logout(session: HttpSession): void
+ currentUser(session: HttpSession): User
+ requireRole(session: HttpSession, role: Role): User
```

### Package `payment`

#### `PaymentGateway`, Interface · interface

```
+ charge(amount: BigDecimal, method: PaymentMethod, accountNumber: String): PaymentResult
```

#### `FakePaymentGateway`, Class · implementation · implements `PaymentGateway`

Approves every payment except account numbers ending in 0000 (to demo a failure).

```
+ charge(amount: BigDecimal, method: PaymentMethod, accountNumber: String): PaymentResult
- generateReference(): String
```

### Package `exception`

#### `SpaceGridException`, Class · abstract exception · extends `RuntimeException`

extends java.lang.RuntimeException

```
# SpaceGridException(message: String)
+ getHttpStatus(): int   «abstract»
```

#### `ValidationException`, Class · exception · extends `SpaceGridException`

Bad input → 400

```
+ ValidationException(message: String)
+ getHttpStatus(): int  // 400
```

#### `UnauthenticatedException`, Class · exception · extends `SpaceGridException`

Not logged in → 401

```
+ UnauthenticatedException(message: String)
+ getHttpStatus(): int  // 401
```

#### `AccessDeniedException`, Class · exception · extends `SpaceGridException`

Not allowed → 403

```
+ AccessDeniedException(message: String)
+ getHttpStatus(): int  // 403
```

#### `NotFoundException`, Class · exception · extends `SpaceGridException`

Id doesn't exist → 404

```
+ NotFoundException(message: String)
+ getHttpStatus(): int  // 404
```

#### `ConflictException`, Class · exception · extends `SpaceGridException`

Breaks a rule, e.g. username taken → 409

```
+ ConflictException(message: String)
+ getHttpStatus(): int  // 409
```

#### `GlobalExceptionHandler`, Class · exception handler

```
+ handleSpaceGridException(ex: SpaceGridException): ResponseEntity<Map<String, String>>
+ handleUnexpected(ex: Exception): ResponseEntity<Map<String, String>>
```

### Package `(root)`

#### `SpaceGridApplication`, Class · main

```
+ main(args: String[]): void   «static»
```

## 5. Relationships (model)

| From | Relationship | To | Multiplicity |
|---|---|---|---|
| User, Property, GridZone, LeaseContract, Payment | extends | BaseEntity |  |
| RentableUnit, CommonArea | extends | GridZone |  |
| User (landlord) | owns | Property | 1 → 0..* |
| Property | ◆ composition (zones) | GridZone | 1 → 0..* |
| GridZone | ◆ composition (positions) | GridPosition | 1 → 1..* |
| Property | ◆ composition (edgeOverrides) | GridEdge → EdgeType | 1 → 0..* |
| Property, RentableUnit | ◆ composition | Dimensions | 1 → 0..1 |
| User (renter) | rents | LeaseContract | 1 → 0..* |
| RentableUnit | leased through | LeaseContract | 1 → 0..* |
| LeaseContract | renews (previousLeaseId) | LeaseContract | 0..1 → 0..1 |
| LeaseContract | paid by | Payment | 1 → 0..* |

## 6. Business rules

**Accounts**

- Usernames are unique (`ConflictException`). Passwords are hashed with BCrypt and must be at least 8 characters.
- Login errors use one generic message, so the app never reveals whether a username exists.
- Landlord-only actions call `SessionManager.requireRole(LANDLORD)`. Renters only see their own leases and payments.

**Properties**

- Only the owner can view or change a property (`isOwnedBy`); anyone else gets `AccessDeniedException`.
- A new property starts as DRAFT with a 1 × 1 grid. Rows and columns go from 1 to 30 (`MAX_GRID_SIZE`).
- Property types: Apartment, Condominium, Townhouse, Commercial.

**Grid**

- Each spot belongs to at most one zone; `assignSpot()` takes the spot away from any other zone first.
- A zone must belong to the same property and its spots must be inside the grid.
- Shrinking the grid removes spots and edge overrides that fall outside it.
- The Save layout button sends two requests: `PUT …/grid` (size and spots), then `PUT …/edges` (wall overrides).

**Walls, doors and windows**

- Automatic wall: on the line between two spots of different zones when at least one side is enclosed (`isEnclosed()`: rentable units and indoor common areas). Also on the grid border next to an enclosed spot.
- Indoor common areas: Bathroom, Kitchen, Laundry, Lobby, Stairs. Outdoor (no automatic walls): Walkway, Grass, Parking.
- Manual overrides replace the automatic result: WALL, DOOR, WINDOW, or OPEN (removes an automatic wall). `resetEdge()` goes back to automatic.
- Each line is stored once, as the line above (horizontal) or left of (vertical) a spot (`GridEdge.of`).

**Colors and CSS**

- Spots get CSS classes such as `zone zone-common zone-grass` or `zone zone-unit status-occupied`, plus `--zone-color` set to the default color.
- The default CSS rule paints `var(--zone-color)`; any class can be restyled (textures, icons). Edges use `edge-wall`, `edge-door`, `edge-window`; badges use the `cssClass` of `LeaseState` and `DueStatus`.

**Units**

- Statuses: AVAILABLE, OCCUPIED, UNDER_MAINTENANCE, ARCHIVED. A unit can only become OCCUPIED from AVAILABLE, and can't go into maintenance while OCCUPIED.
- Archive (`Property.archiveUnit`): only when the unit has no ACTIVE lease. The unit's spots are cleared from the grid, it can't be leased or edited again, and its past leases and payments are kept. Archived units are hidden from the grid and the unit list (shown under an "Archived" filter).
- Delete is only allowed for a unit that has never been leased (`existsByUnitId` is false). Otherwise `ConflictException` asks the landlord to archive it instead. The database also blocks it (ON DELETE RESTRICT).
- Zone names don't have to be unique. Rental rates can't be negative.

**Leases**

- Terms are final: unit, renter, start date, end date, monthly rent. End date must be after start date.
- A unit can have only one ACTIVE lease. The chosen user must have the RENTER role.
- Create: unit → OCCUPIED. End (normal) or Terminate (early): status changes, `closedOn` is set, unit → AVAILABLE.
- Renew: the old lease becomes RENEWED with `closedOn` = the day before the new start date. A new ACTIVE lease is created with `previousLeaseId` and the new terms, and the unit stays OCCUPIED. All of this happens in one transaction. The new start date must be after the old start date and no later than the day after the old end date.
- Displayed state (`getCurrentState`): UPCOMING (not started), ACTIVE, EXPIRING_SOON (30 days or fewer left), EXPIRED (end date passed but still ACTIVE, so the landlord should end or renew it), ENDED, TERMINATED, RENEWED.
- Landlord view: all leases on their properties, with renter name, state, and end/terminate/renew actions. Renter view: own leases only, read-only, with days remaining and the rent statement.

**Payments**

- Billing months run from the start month to the last month in effect (`closedOn` or `endDate`). The due date is the lease's start day of the month (or the last day of shorter months).
- Amount due = the lease's `monthlyRent`. Each payment stores its own amount.
- A month can only be paid once. Months must be paid in order, oldest unpaid first. Paying ahead (future months within the lease) is allowed.
- Due status per month: PAID; OVERDUE if unpaid after the due date; DUE if unpaid within 7 days before the due date; otherwise UPCOMING.
- Methods: GCash, Maya, Card. `FakePaymentGateway` approves every payment except account numbers ending in 0000, which are declined. A declined payment is saved as FAILED and can be retried.

**Errors**

- ValidationException 400 · UnauthenticatedException 401 (the page redirects to login) · AccessDeniedException 403 · NotFoundException 404 · ConflictException 409. Anything unexpected returns 500 with a generic message; details are only logged on the server.
