# Dummy data plan (demo accounts)

Status: **plan, not yet in the SQL script.** It is added to `database/spacegrid_db.sql` in a later step, after approval.
Checked against `database/spacegrid_db.sql` (schema and sample data), the model classes and the services.

## Ground rules

- **"Today" is 2026-10-29.** All dates are fixed literals relative to that day. If the demo is shown on another day, the calculated states (UPCOMING, EXPIRING_SOON, DUE, OVERDUE) will move. `LeaseExpiryJob` also runs at startup and ends any ACTIVE lease whose end date is before the real today, so the EXPIRED and "ending today" examples hold only on 2026-10-29. (Phase 2 will check how `LeaseContract` and the job treat these dates before the SQL is written.)
- The **existing sample data stays untouched** (users 1-5, properties 1-5, zones 1-20, leases 1-5, payments 1-38, requests 1-4). Everything below is added after it, with explicit ids that continue after the current maximum.
- All new accounts use the password `password123` (one BCrypt hash, generated with the app's jBCrypt and checked with `checkpw`).
- Payment reference numbers follow the sample data pattern `SG-YYYYMMDD-NNNN` (the sample ends at `-0038`; new ones continue at `-0039`). The real gateway generates `SG-YYYYMMDD-XXXXXX` (6 random characters), so both patterns fit the 40-character column; every reference is unique.
- `paid_at` follows the sample style: the day before the due date, 10:15.
- Colors of common areas are unique inside a property and never equal to a unit status color.

## Id ranges (continue after the current maximum)

| Table | Current max | New ids |
|---|---|---|
| `users` | 5 | 6-13 |
| `properties` | 5 | 6-16 |
| `grid_zones` (units and common areas share ids) | 20 | 21-92 |
| `lease_contracts` | 5 | 6-21 |
| `payments` | 38 | 39 and up (explicit ids, in lease order) |
| `lease_requests` | 4 | 5-15 |
| `uploaded_files` | none | depends on the image decision (see `image-manifest.md`) |

## Accounts

| id | username | role | full name | e-mail / phone |
|---|---|---|---|---|
| 6 | `landlord` | LANDLORD | Ramon Dela Cruz | set |
| 7 | `landlord2` | LANDLORD | Teresita Villanueva | set |
| 8 | `landlord3` | LANDLORD | Benjie Magallanes | set |
| 9 | `renter` | RENTER | Jasmine Ocampo | set |
| 10 | `renter2` | RENTER | Carlo Abellana | set |
| 11 | `renter3` | RENTER | Marites Lumbay | set |
| 12 | `renter4` | RENTER | Joel Tumulak | set |
| 13 | `renter5` | RENTER | Kristine Bacalso | **both NULL** (tests "a renter needs e-mail and phone before requesting") |

E-mails look like `ramon.delacruz@example.com`; phones like `+63 917 555 02xx`.

## Properties

| id | landlord | name | type | status | grid | size | notes |
|---|---|---|---|---|---|---|---|
| 6 | landlord | Lanang Bayview Apartments | APARTMENT | ACTIVE | 5 x 8 | exact 220 sqm | parking, power backup, security, water, 24h; default rate 13,000 |
| 7 | landlord | Ecoland Garden Condominium | CONDOMINIUM | ACTIVE | 4 x 6 | approx. "Whole floor" | parking, security, water; no default rate |
| 8 | landlord | Buhangin Townhomes Row | TOWNHOUSE | ACTIVE | 4 x 8 | no size (NULL) | parking, water; default rate 15,000 |
| 9 | landlord | Bolton Commercial Arcade | COMMERCIAL | ACTIVE | 5 x 7 | exact 180 sqm | parking, security, power backup |
| 10 | landlord | Toril Weekend Night Bazaar | NIGHT_MARKET | ACTIVE | 4 x 6 | exact 90 sqm | power backup, security; default rate 3,500 |
| 11 | landlord | Sta. Ana Wharf Open Lot | OPEN_SPACE | **ARCHIVED** | 3 x 4 | approx. "Lot by the wharf" | no amenities |
| 12 | landlord | Catalunan Pequeno Duplex | TOWNHOUSE | **DRAFT** | 3 x 4 | exact 110 sqm | unfinished grid |
| 13 | landlord2 | Matina Town Center Shops | COMMERCIAL | ACTIVE | 4 x 6 | exact 140 sqm | |
| 14 | landlord2 | Magallanes Street Night Food Market | NIGHT_MARKET | ACTIVE | 4 x 6 | approx. "Half street" | |
| 15 | landlord2 | Davao Riverside Events Lawn | OPEN_SPACE | ACTIVE | 3 x 5 | exact 600 sqm | |
| 16 | landlord3 | Maa Starter Apartments | APARTMENT | **DRAFT** | 4 x 5 | none | started but unfinished grid; no leases |

All six `property_type` values and all three statuses appear. Each description is 1-2 sentences about a real kind of Davao City place (street, barangay). Addresses use `city = 'Davao City'`, `region = 'Davao del Sur'` like the sample data.

## Grids (zones, spots, edges)

Grid sizes are inside 1-60; spot rows/columns are 0-based and below the grid size, so inside the 0-59 CHECK. Each spot belongs to exactly one zone, and every `(zone_id, property_id)` pair in `zone_cells` exists in `grid_zones`, so the composite foreign key holds. Layouts (numbers are zone ids):

```text
P6  5x8   r0: 21 21 22 22 23 23 24 24      P7  4x6   r0: 33 33 34 34 35 35
          r1: 21 21 22 22 23 23 24 24            r1: 33 33 34 34 35 35
          r2: 27 27 27 27 27 27 27 27            r2: 41 41 41 41 41 41
          r3: 25 25 26 26 28 31 29 29            r3: 36 37 39 40 38 38
          r4: 30 30 30 30 32 32 32 32
P8  4x8   r0: 42 42 43 43 44 44 45 45      P9  5x7   r0: 48 48 49 49 50 50 51
          r1: 42 42 43 43 44 44 45 45            r1: 48 48 49 49 50 50 51
          r2: 46 x8   r3: 47 x8                  r2: 54 x7   r4: 55 x7
                                                 r3: 52 52 53 53 53 56 56
P10 4x6   r0: 57 58 59 60 61 62            P11 3x4   r0: 66 66 67 67   (unit 65 archived: no spots)
          r1: 63 x6                                  r1: 67 x4   r2: 67 x4
          r2: 64 64 63 63 63 63
P12 3x4   r0: 68 68 .. ..  r1: 68 68 .. ..  r2: 69 69 69 69      (rest empty: unfinished)
P13 4x6   r0: 70 70 71 71 72 72            P14 4x6   r0: 76 77 78 79 80 81
          r1: 70 70 71 71 72 72                      r1: 82 x6
          r2: 74 x6                                  r2: 83 83 84 84 82 82
          r3: 73 73 73 75 75 75
P15 3x5   r0: 85 85 85 86 86               P16 4x5   r0: 90 90 .. .. ..
          r1: 85 85 85 86 86                         r1: 90 90 .. .. ..
          r2: 87 87 88 89 89                         r2: 91 91 91 91 91  (zone 92 has no spots yet)
```

**Edge overrides** (each stored once as the line above (HORIZONTAL) or left of (VERTICAL) a spot; rows and columns 0-60):

| Property | Overrides | Types shown |
|---|---|---|
| 6 | DOOR on `(2,0) (2,2) (2,4) (2,6)` HORIZONTAL; WINDOW on `(0,0) (0,2)` HORIZONTAL | DOOR, WINDOW |
| 7 | DOOR `(2,0)` and `(3,0)` HORIZONTAL; WINDOW `(0,4)` HORIZONTAL | DOOR, WINDOW |
| 8 | WALL `(3,0)` HORIZONTAL (a fence between driveway and garden; no automatic wall there) | WALL |
| 9 | OPEN `(3,2)` HORIZONTAL (Shop 6 opens to the walkway); DOOR `(1,0)` and `(2,0)` | OPEN, DOOR |
| 10, 13, 14, 15 | one DOOR each where a restroom/commissary meets the walkway | DOOR |
| 12 | WINDOW `(0,0)` HORIZONTAL | WINDOW |

**Common areas** (all 8 types are used): WALKWAY 27, 41, 54, 63, 74, 82, 89; STAIRS 28; LOBBY 29, 38; PARKING 30, 46, 55, 75; LAUNDRY 31, 83; GRASS 32, 47, 67, 88; KITCHEN 39, 64; BATHROOM 40, 56, 84; plus 69 (WALKWAY, "Driveway" in the draft duplex) and 91 (WALKWAY "Hallway") and 92 is a unit. Some have a picked color (`#rrggbb`), the others use the type default (NULL).

## Units

`status` follows the lease below. `size`: exact = `is_exact_size 1` with `area_sqm`; approx. = `is_exact_size 0` with `size_description`; none = all three NULL. E = includes electricity, W = includes water.

| Prop | Zone id | Unit | Status | Rate | Size | E | W | Lease |
|---|---|---|---|---|---|---|---|---|
| 6 | 21 | A101 | OCCUPIED | 14,500 | exact 32 | yes | yes | 7 |
| 6 | 22 | A102 | AVAILABLE | 13,500 | exact 30 | no | yes | |
| 6 | 23 | A103 | AVAILABLE | 12,000 | approx. "Studio-size" | no | no | |
| 6 | 24 | A104 | OCCUPIED | 11,500 | none | no | no | 12 (UPCOMING) |
| 6 | 25 | A201 | UNDER_MAINTENANCE | 14,000 | exact 34 | yes | yes | |
| 6 | 26 | A202 | AVAILABLE | 15,000 | approx. "Corner unit" | yes | yes | |
| 7 | 33 | 5A | OCCUPIED | 18,000 | exact 42 | yes | yes | 8 |
| 7 | 34 | 5B | AVAILABLE | 17,500 | exact 40 | no | yes | |
| 7 | 35 | 5C | AVAILABLE | 16,000 | approx. "Studio" | no | no | |
| 7 | 36 | 5D | UNDER_MAINTENANCE | 17,000 | none | no | no | |
| 7 | 37 | 6A | AVAILABLE | 19,500 | exact 48 | yes | yes | |
| 8 | 42 | Townhouse 1 | OCCUPIED | 15,500 | exact 65 | no | yes | 9 |
| 8 | 43 | Townhouse 2 | OCCUPIED | 16,000 | exact 65 | no | yes | 13 |
| 8 | 44 | Townhouse 3 | AVAILABLE | 16,500 | exact 70 | no | yes | |
| 8 | 45 | Townhouse 4 | OCCUPIED | 10,000 | approx. "Small townhouse" | no | no | 17 |
| 9 | 48 | Shop 1 | AVAILABLE | 22,000 | exact 28 | yes | no | |
| 9 | 49 | Shop 2 | AVAILABLE | 20,000 | exact 25 | yes | no | 11 (history) |
| 9 | 50 | Shop 3 | OCCUPIED | 21,000 | exact 26 | yes | yes | 18 (awaiting move-out) |
| 9 | 51 | Shop 4 | AVAILABLE | 18,500 | approx. "Small shop" | yes | no | |
| 9 | 52 | Shop 5 | UNDER_MAINTENANCE | 24,000 | exact 30 | no | no | |
| 9 | 53 | Shop 6 | AVAILABLE | 23,000 | exact 32 | yes | yes | |
| 10 | 57 | Stall N1 | AVAILABLE | 3,500 | exact 9 | yes | no | |
| 10 | 58 | Stall N2 | AVAILABLE | 3,500 | exact 9 | yes | no | |
| 10 | 59 | Stall N3 | AVAILABLE | 4,000 | approx. "Corner stall" | yes | no | |
| 10 | 60 | Stall N4 | UNDER_MAINTENANCE | 4,000 | exact 10 | yes | no | |
| 10 | 61 | Stall N5 | AVAILABLE | 3,000 | none | no | no | |
| 10 | 62 | Stall N6 | AVAILABLE | 4,500 | exact 12 | yes | yes | |
| 11 | 65 | Lot 1 | ARCHIVED | 5,000 | none | no | no | 21 (history; spots cleared) |
| 11 | 66 | Lot 2 | AVAILABLE | 4,000 | approx. "Small lot" | no | no | (not on the homepage: property is ARCHIVED) |
| 12 | 68 | Duplex A | AVAILABLE | 14,000 | exact 55 | no | yes | |
| 13 | 70 | Shop A | AVAILABLE | 25,000 | exact 30 | yes | no | 10 (history) |
| 13 | 71 | Shop B | OCCUPIED | 24,000 | exact 28 | yes | no | 19 (awaiting move-out) |
| 13 | 72 | Shop C | AVAILABLE | 26,000 | approx. "Corner shop" | yes | yes | request 6 approved |
| 13 | 73 | Shop D | AVAILABLE | 22,000 | none | no | no | |
| 14 | 76 | Booth 1 | OCCUPIED | 5,500 | exact 10 | yes | no | 14 |
| 14 | 77 | Booth 2 | AVAILABLE | 5,500 | exact 10 | yes | no | |
| 14 | 78 | Booth 3 | AVAILABLE | 6,000 | approx. "Corner booth" | yes | no | |
| 14 | 79 | Booth 4 | AVAILABLE | 5,000 | none | no | no | |
| 14 | 80 | Booth 5 | UNDER_MAINTENANCE | 5,000 | exact 10 | yes | no | |
| 14 | 81 | Booth 6 | AVAILABLE | 7,000 | exact 14 | yes | yes | |
| 15 | 85 | Plot 1 | AVAILABLE | 8,000 | approx. "Large lawn plot" | no | no | |
| 15 | 86 | Plot 2 | AVAILABLE | 4,500 | exact 60 | no | yes | |
| 15 | 87 | Plot 3 | AVAILABLE | 3,000 | none | no | no | |
| 16 | 90 | Room 1 | AVAILABLE | 7,500 | exact 20 | no | no | |
| 16 | 92 | Room 2 | AVAILABLE | 7,500 | none | no | no | no spots yet |

All four `UnitStatus` values appear. OCCUPIED comes only from leases (ACTIVE leases and closed leases still waiting for the move-out), as in the app.

## Leases

"State" is the calculated `LeaseState` on 2026-10-29. Dates are literal. `closed_on` rules from the CHECKs hold: ACTIVE has NULL, every other status has a date; `termination_reason` only on TERMINATED; `ended_automatically` only on ENDED; `released_on` only on ENDED/TERMINATED. `end_date > start_date` everywhere, rents match the unit's rate at lease time (renewals may be higher).

| Lease | Unit | Renter | Prev | Start | End | Rent | Terms | Status | State | closed_on | released_on | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | 21 | renter | | 2025-03-01 | 2026-02-28 | 13,500 | MONTHLY_ADVANCE | RENEWED | RENEWED | 2026-02-28 | | |
| 7 | 21 | renter | 6 | 2026-03-01 | 2027-02-28 | 14,500 | MONTHLY_ADVANCE | ACTIVE | ACTIVE | | | rent rose |
| 8 | 33 | renter | | 2025-11-20 | 2026-11-19 | 18,000 | MONTHLY_ADVANCE | ACTIVE | EXPIRING_SOON (21 days) | | | |
| 9 | 42 | renter | | 2025-10-30 | 2026-10-29 | 15,500 | MONTHLY_ADVANCE | ACTIVE | EXPIRED ("ending today") | | | job has not run yet |
| 10 | 70 | renter | | 2025-01-01 | 2025-12-31 | 24,000 | MONTHLY_ADVANCE | ENDED | ENDED | 2025-12-31 | 2025-12-31 | landlord2 |
| 11 | 49 | renter | | 2026-02-01 | 2027-01-31 | 20,000 | MONTHLY_ADVANCE | TERMINATED | TERMINATED | 2026-09-15 | 2026-09-30 | reason "Repeated late payments and an unauthorized sublease."; September stays unpaid |
| 12 | 24 | renter | | 2026-12-01 | 2027-11-30 | 11,500 | MONTHLY_ADVANCE | ACTIVE | UPCOMING | | | |
| 13 | 43 | renter2 | | 2026-07-01 | 2027-06-30 | 16,000 | QUARTERLY_ADVANCE | ACTIVE | ACTIVE | | | landlord |
| 14 | 76 | renter2 | | 2026-09-01 | 2027-02-28 | 5,500 | MONTHLY_ARREARS | ACTIVE | ACTIVE | | | landlord2 |
| 15 | 45 | renter3 | | 2025-03-01 | 2026-02-28 | 9,000 | MONTHLY_ADVANCE | RENEWED | RENEWED | 2026-02-28 | | chain 15 -> 16 -> 17 |
| 16 | 45 | renter3 | 15 | 2026-03-01 | 2026-08-31 | 9,500 | MONTHLY_ADVANCE | RENEWED | RENEWED | 2026-08-31 | | |
| 17 | 45 | renter3 | 16 | 2026-09-01 | 2027-02-28 | 10,000 | SEMI_ANNUAL_ADVANCE | ACTIVE | ACTIVE | | | |
| 18 | 50 | renter3 | | 2026-01-15 | 2027-01-14 | 21,000 | MONTHLY_ADVANCE | TERMINATED | TERMINATED | 2026-10-20 | NULL | reason "Tenant left the shop and stopped paying."; awaiting move-out; Sep and Oct unpaid |
| 19 | 71 | renter3 | | 2025-11-01 | 2026-10-27 | 24,000 | MONTHLY_ADVANCE | ENDED | ENDED | 2026-10-27 | NULL | `ended_automatically` = 1; awaiting move-out; October unpaid; landlord2 |
| 21 | 65 | renter | | 2025-02-01 | 2025-12-31 | 5,000 | ANNUAL_ADVANCE | ENDED | ENDED | 2025-12-31 | 2025-12-31 | the archived lot's history |

Lease id 20 is not used (the ids 6-19 and 21 are the leases; the gap is harmless).

Every `LeaseState` appears: UPCOMING (12), ACTIVE (7, 13, 14, 17), EXPIRING_SOON (8), EXPIRED (9), ENDED (10, 19, 21), TERMINATED (11, 18), RENEWED (6, 15, 16). Every `PaymentTerms` value appears: MONTHLY_ADVANCE, MONTHLY_ARREARS (14), QUARTERLY_ADVANCE (13), SEMI_ANNUAL_ADVANCE (17) and ANNUAL_ADVANCE (21). One ACTIVE lease per unit holds: the ACTIVE leases (7, 8, 9, 12, 13, 14, 17) are on different units, and closed leases do not count.

## Payments

Amount = rent x months in the billing period. Each period is one row per attempt; at most one PAID row per lease and billing month (`paid_lease_id` unique). `billing_month` is the first day of the period's first month. Methods: GCASH, MAYA, CARD, all used. Reference numbers `SG-YYYYMMDD-NNNN` are numbered 0039 upward in lease order, then month order, one per PAID row (FAILED and PENDING rows have none).

| Lease | Rows | Status on 2026-10-29 |
|---|---|---|
| 6 | 12 x PAID, GCASH, 2025-03 to 2026-02 | all PAID |
| 7 | PAID 2026-03 to 2026-10 (MAYA); one FAILED CARD attempt for 2026-05 before its PAID | 2026-11 **DUE** (due 2026-11-01, within 7 days) |
| 8 | PAID 2025-11 to 2026-10 (CARD); one **PENDING** GCASH row for 2026-11 | 2026-11 UPCOMING (due 2026-11-20) |
| 9 | PAID 2025-10 to 2026-09 (MAYA) | 2026-10 DUE (due 2026-10-30) |
| 10 | 12 x PAID, 2025-01 to 2025-12 (GCASH, MAYA and CARD in turns) | all PAID |
| 11 | PAID 2026-02 to 2026-08 (GCASH); FAILED CARD for 2026-09 | 2026-09 **OVERDUE**, kept payable after closing |
| 12 | none | 2026-12 UPCOMING |
| 13 | PAID 2026-07 quarter (GCASH, 48,000); PAID 2026-10 quarter **ahead**, paid 2026-09-25 (CARD, 48,000) | 2027-01 quarter UPCOMING; paid ahead |
| 14 | none (arrears: September's period is due 2026-10-01) | 2026-09 **OVERDUE**, 2026-10 DUE (due 2026-11-01) |
| 15 | 12 x PAID, 2025-03 to 2026-02 (MAYA) | all PAID |
| 16 | 6 x PAID, 2026-03 to 2026-08 (MAYA) | all PAID |
| 17 | one PAID period starting 2026-09 (6 months x 10,000 = 60,000, MAYA, paid 2026-08-31) | all PAID (the lease ends 2027-02-28, so this is its only period) |
| 18 | PAID 2026-01 to 2026-08 (GCASH) | 2026-09 and 2026-10 OVERDUE |
| 19 | PAID 2025-11 to 2026-09 (GCASH) | 2026-10 OVERDUE |
| 21 | one PAID row, CARD, for the single period starting 2025-02 (11 months x 5,000 = 55,000; the lease is shorter than a year, so the period is shorter) | all PAID |

**PAID / FAILED / PENDING** all appear, as do **PAID, OVERDUE, DUE, UPCOMING** due statuses.

## Lease requests

Status rules: PENDING has `decided_at` NULL, every other status has one; only one PENDING per unit and renter (`pending_key`). Each request keeps `unit_label` and `property_label`. A request on a removed unit has `rentable_unit_id` NULL.

| id | Renter | Unit (landlord) | Start / months | Status | Notes |
|---|---|---|---|---|---|
| 5 | renter | 22 A102 (landlord) | 2026-12-15 / 12 | PENDING | |
| 6 | renter | 72 Shop C (landlord2) | 2026-11-20 / 12 | APPROVED (2026-10-27) | the landlord2 still has to create the lease |
| 7 | renter | 3 Unit 103 (maria.santos) | 2026-11-01 / 6 | DECLINED (2026-10-10) | on a sample property |
| 8 | renter | 15 Booth 2 (jose.reyes) | 2026-11-15 / 3 | CANCELLED (2026-10-12) | on a sample property |
| 9 | renter2 | 34 5B (landlord) | 2027-01-01 / 12 | PENDING | |
| 10 | renter3 | 77 Booth 2 (landlord2) | 2026-12-01 / 6 | PENDING | |
| 11 | renter4 | 12 Stall 2 (jose.reyes) | 2026-12-01 / 6 | PENDING | |
| 12 | renter4 | 62 Stall N6 (landlord) | 2026-11-15 / 3 | PENDING | |
| 13 | renter4 | 37 6A (landlord) | 2026-11-01 / 12 | DECLINED (2026-10-05) | |
| 14 | renter4 | 85 Plot 1 (landlord2) | 2026-11-10 / 1 | DECLINED (2026-10-18) | |
| 15 | renter2 | removed unit "Stall N7" of "Toril Weekend Night Bazaar" | 2026-10-01 / 3 | DECLINED (2026-09-20) | `rentable_unit_id` NULL, unit-removed case |

All four statuses appear across landlords 1, 2, 6 and 7 (landlord3's only property is a draft, so it has no requests). `renter5` has none.

## Check against the constraints

- CHECKs: statuses, types, terms, methods are all in the allowed lists; rate/amount constraints hold; `grid_rows`/`grid_columns` 1-60 (largest is 5 x 8); `zone_cells` indexes 0-59; edge indexes 0-60; `months` 1-60; `DAYOFMONTH(billing_month) = 1`; `amount > 0`; `PAID` rows have a reference and `paid_at`.
- One ACTIVE lease per unit (`active_unit_id` unique): the ACTIVE leases are 7, 8, 9, 12, 13, 14, 17, all on different units. A lease is renewed once (`previous_lease_id` unique): 6->7, 15->16, 16->17.
- One PAID row per lease and billing month; reference numbers unique.
- `zone_cells` composite foreign key: a spot's zone must belong to the same property (every id in the layouts above does).
- Foreign keys: insert order users, properties, grid_zones, rentable_units / common_areas, zone_cells, edge_overrides, lease_contracts (parent before renewal), payments, lease_requests.
- Contacts: every renter who has a request (renter, renter2, renter3, renter4) has e-mail and phone; renter5 has neither.

## Homepage

ACTIVE properties with at least one AVAILABLE unit: 1, 3, 4, 5 (sample), 6, 7, 8, 9, 10, 13, 14, 15. Not on the homepage: DRAFT 12 and 16, ARCHIVED 11 (even though it has an AVAILABLE unit).

## Summary

| Account | Role | Owns | Demonstrates |
|---|---|---|---|
| `landlord` | Landlord | Properties 6-12 (every type; ACTIVE, ARCHIVED, DRAFT), 30 units, leases 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 18, 21 on those units; requests 5, 9, 12, 13 arrive on its units | The fullest landlord: every unit status, move-out waiting, overdue payments, unfinished draft, archived property |
| `landlord2` | Landlord | Properties 13-15 (commercial, night market, open space), 13 units, leases 10, 14, 19 | Variety on the homepage; an auto-ended lease awaiting move-out; an approved request waiting for a lease |
| `landlord3` | Landlord | Property 16 (DRAFT, unfinished grid) | Empty-state test: no leases, no requests, unplaced unit |
| `renter` | Renter | Leases 6, 7, 8, 9, 10, 11, 12, 21 and requests 5-8 | Every lease state, three landlords, all four request statuses |
| `renter2` | Renter | Leases 13, 14, requests 9, 15 | Two ACTIVE leases with different landlords; quarterly and arrears terms; paid ahead; overdue |
| `renter3` | Renter | Leases 15, 16, 17, 18, 19, request 10 | Renewal chain, TERMINATED lease, ended lease awaiting move-out, two landlords |
| `renter4` | Renter | Requests 11-14 | No leases; PENDING and DECLINED only |
| `renter5` | Renter | nothing | Empty-state test; no contact details |
