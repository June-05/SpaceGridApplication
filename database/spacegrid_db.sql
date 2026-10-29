-- =====================================================================
--  SpaceGrid - spacegrid_db
--  Phase 2: MySQL schema + sample data
--
--  Works on: XAMPP (MariaDB 10.4+) and MySQL 8, opened in MySQL Workbench.
--  How to run: in Workbench, File > Open SQL Script, then Execute (lightning icon).
--
--  WARNING: this DROPS and recreates spacegrid_db. Back up any data you need first.
--
--  Sample logins (all passwords: password123)
--    landlords: maria.santos, jose.reyes
--    renters:   ana.cruz, paolo.garcia, liza.mendoza
-- =====================================================================

DROP DATABASE IF EXISTS spacegrid_db;
CREATE DATABASE spacegrid_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE spacegrid_db;

-- ---------------------------------------------------------------------
-- 1. users  (Java: User)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id             INT          NOT NULL AUTO_INCREMENT,
    username       VARCHAR(50)  NOT NULL,
    password_hash  CHAR(60)     NOT NULL,                  -- BCrypt hash, always 60 characters
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(100) NULL,                     -- optional; a renter needs email + phone to send a lease request
    phone          VARCHAR(30)  NULL,
    role           VARCHAR(20)  NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT ck_users_role CHECK (role IN ('LANDLORD', 'RENTER'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2. properties  (Java: Property; size columns = Dimensions value object)
-- ---------------------------------------------------------------------
CREATE TABLE properties (
    id                INT           NOT NULL AUTO_INCREMENT,
    landlord_id       INT           NOT NULL,
    name              VARCHAR(100)  NOT NULL,
    address           VARCHAR(255)  NOT NULL,                  -- street address
    city              VARCHAR(100)  NOT NULL,
    region            VARCHAR(100)  NOT NULL,                  -- region / province
    property_type     VARCHAR(20)   NOT NULL,
    description       TEXT          NULL,
    is_exact_size     BOOLEAN       NULL,                  -- NULL = no size given
    size_description  VARCHAR(100)  NULL,                  -- used when is_exact_size = FALSE
    area_sqm          DECIMAL(10,2) NULL,                  -- used when is_exact_size = TRUE
    default_rate      DECIMAL(10,2) NULL,                  -- pre-fills a new unit's rate; each unit keeps its own
    has_parking       BOOLEAN       NOT NULL DEFAULT FALSE,   -- amenities (Java: Amenities)
    has_power_backup  BOOLEAN       NOT NULL DEFAULT FALSE,
    has_security      BOOLEAN       NOT NULL DEFAULT FALSE,
    has_water_access  BOOLEAN       NOT NULL DEFAULT FALSE,
    is_open_24h       BOOLEAN       NOT NULL DEFAULT FALSE,
    status            VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    grid_rows         TINYINT       NOT NULL DEFAULT 1,
    grid_columns      TINYINT       NOT NULL DEFAULT 1,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_properties PRIMARY KEY (id),
    CONSTRAINT fk_properties_landlord FOREIGN KEY (landlord_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_properties_type   CHECK (property_type IN ('APARTMENT', 'CONDOMINIUM', 'TOWNHOUSE', 'COMMERCIAL', 'NIGHT_MARKET', 'OPEN_SPACE')),
    CONSTRAINT ck_properties_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_properties_rate   CHECK (default_rate IS NULL OR default_rate >= 0),
    CONSTRAINT ck_properties_rows   CHECK (grid_rows BETWEEN 1 AND 60),
    CONSTRAINT ck_properties_cols   CHECK (grid_columns BETWEEN 1 AND 60),
    CONSTRAINT ck_properties_size   CHECK (
        is_exact_size IS NULL
        OR (is_exact_size = TRUE  AND area_sqm IS NOT NULL AND area_sqm > 0)
        OR (is_exact_size = FALSE AND size_description IS NOT NULL))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 3. grid_zones  (Java: abstract GridZone - the shared part)
--    Inheritance, "class table" style: each zone has ONE extra row in either
--    rentable_units (zone_kind = 'UNIT') or common_areas (zone_kind = 'COMMON'),
--    with the same id.
-- ---------------------------------------------------------------------
CREATE TABLE grid_zones (
    id           INT          NOT NULL AUTO_INCREMENT,
    property_id  INT          NOT NULL,
    zone_kind    VARCHAR(10)  NOT NULL,
    name         VARCHAR(100) NOT NULL,                    -- doesn't have to be unique
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_grid_zones PRIMARY KEY (id),
    CONSTRAINT uq_grid_zones_id_property UNIQUE (id, property_id),   -- target of zone_cells' composite FK
    CONSTRAINT fk_grid_zones_property FOREIGN KEY (property_id) REFERENCES properties (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_grid_zones_kind CHECK (zone_kind IN ('UNIT', 'COMMON'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 4. rentable_units  (Java: RentableUnit extends GridZone)
-- ---------------------------------------------------------------------
CREATE TABLE rentable_units (
    zone_id               INT           NOT NULL,          -- same id as grid_zones.id
    rental_rate           DECIMAL(10,2) NOT NULL,
    is_exact_size         BOOLEAN       NULL,
    size_description      VARCHAR(100)  NULL,
    area_sqm              DECIMAL(10,2) NULL,
    includes_electricity  BOOLEAN       NOT NULL DEFAULT FALSE,
    includes_water        BOOLEAN       NOT NULL DEFAULT FALSE,
    status                VARCHAR(20)   NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT pk_rentable_units PRIMARY KEY (zone_id),
    CONSTRAINT fk_rentable_units_zone FOREIGN KEY (zone_id) REFERENCES grid_zones (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_rentable_units_rate   CHECK (rental_rate >= 0),
    CONSTRAINT ck_rentable_units_status CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE', 'ARCHIVED')),
    CONSTRAINT ck_rentable_units_size   CHECK (
        is_exact_size IS NULL
        OR (is_exact_size = TRUE  AND area_sqm IS NOT NULL AND area_sqm > 0)
        OR (is_exact_size = FALSE AND size_description IS NOT NULL))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 5. common_areas  (Java: CommonArea extends GridZone)
-- ---------------------------------------------------------------------
CREATE TABLE common_areas (
    zone_id    INT         NOT NULL,                       -- same id as grid_zones.id
    area_type  VARCHAR(20) NOT NULL,
    color      CHAR(7)     NULL,                           -- '#rrggbb' picked by the landlord; NULL = the type's default
    CONSTRAINT pk_common_areas PRIMARY KEY (zone_id),
    CONSTRAINT fk_common_areas_zone FOREIGN KEY (zone_id) REFERENCES grid_zones (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_common_areas_type CHECK (area_type IN
        ('WALKWAY', 'GRASS', 'BATHROOM', 'KITCHEN', 'LAUNDRY', 'LOBBY', 'PARKING', 'STAIRS')),
    CONSTRAINT ck_common_areas_color CHECK (color IS NULL OR color REGEXP '^#[0-9a-f]{6}$')
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 6. zone_cells  (Java: GridZone.positions - one row per GridPosition)
--    PK (property_id, row_idx, col_idx) = one zone per spot.
--    Composite FK = the zone must belong to the same property.
-- ---------------------------------------------------------------------
CREATE TABLE zone_cells (
    property_id  INT     NOT NULL,
    row_idx      TINYINT NOT NULL,                         -- 0-based
    col_idx      TINYINT NOT NULL,                         -- 0-based
    zone_id      INT     NOT NULL,
    CONSTRAINT pk_zone_cells PRIMARY KEY (property_id, row_idx, col_idx),
    CONSTRAINT fk_zone_cells_zone FOREIGN KEY (zone_id, property_id) REFERENCES grid_zones (id, property_id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_zone_cells_row CHECK (row_idx BETWEEN 0 AND 59),          -- grid is at most 60 x 60
    CONSTRAINT ck_zone_cells_col CHECK (col_idx BETWEEN 0 AND 59)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 7. edge_overrides  (Java: Property.edgeOverrides  Map<GridEdge, EdgeType>)
--    Only manual changes are stored; automatic walls are calculated in Java.
--    HORIZONTAL (r, c) = line ABOVE spot (r, c)   rows 0..60 (60 = bottom border)
--    VERTICAL   (r, c) = line LEFT OF spot (r, c) cols 0..60 (60 = right border)
-- ---------------------------------------------------------------------
CREATE TABLE edge_overrides (
    property_id  INT         NOT NULL,
    row_idx      TINYINT     NOT NULL,
    col_idx      TINYINT     NOT NULL,
    orientation  VARCHAR(10) NOT NULL,
    edge_type    VARCHAR(10) NOT NULL,
    CONSTRAINT pk_edge_overrides PRIMARY KEY (property_id, row_idx, col_idx, orientation),
    CONSTRAINT fk_edge_overrides_property FOREIGN KEY (property_id) REFERENCES properties (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_edge_overrides_row         CHECK (row_idx BETWEEN 0 AND 60),
    CONSTRAINT ck_edge_overrides_col         CHECK (col_idx BETWEEN 0 AND 60),
    CONSTRAINT ck_edge_overrides_orientation CHECK (orientation IN ('HORIZONTAL', 'VERTICAL')),
    CONSTRAINT ck_edge_overrides_type        CHECK (edge_type IN ('WALL', 'DOOR', 'WINDOW', 'OPEN'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 8. lease_contracts  (Java: LeaseContract)
--    active_unit_id is calculated by the database: it holds the unit id only
--    while the lease is ACTIVE (otherwise NULL). Its UNIQUE rule therefore
--    blocks two ACTIVE leases on the same unit (NULLs don't count as duplicates).
-- ---------------------------------------------------------------------
CREATE TABLE lease_contracts (
    id                 INT           NOT NULL AUTO_INCREMENT,
    rentable_unit_id   INT           NOT NULL,
    renter_id          INT           NOT NULL,
    previous_lease_id  INT           NULL,                 -- set when this lease is a renewal
    start_date         DATE          NOT NULL,
    end_date           DATE          NOT NULL,
    monthly_rent       DECIMAL(10,2) NOT NULL,
    payment_terms      VARCHAR(20)   NOT NULL DEFAULT 'MONTHLY_ADVANCE',   -- Java: PaymentTerms
    tenant_name        VARCHAR(100)  NOT NULL,             -- contact details typed in the lease form
    tenant_email       VARCHAR(100)  NULL,
    tenant_phone       VARCHAR(30)   NULL,
    status             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    closed_on          DATE          NULL,                 -- date it actually ended / was terminated / renewed
    termination_reason VARCHAR(255)  NULL,                 -- why the landlord terminated it (shown to the renter)
    released_on        DATE          NULL,                 -- when the landlord confirmed the move-out (or leased the unit again to the same renter); until then an ENDED / TERMINATED lease still holds its unit
    ended_automatically BOOLEAN      NOT NULL DEFAULT FALSE,   -- TRUE = ended by LeaseExpiryJob after its end date
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active_unit_id     INT AS (IF(status = 'ACTIVE', rentable_unit_id, NULL)) STORED,
    CONSTRAINT pk_lease_contracts PRIMARY KEY (id),
    CONSTRAINT uq_lease_contracts_previous    UNIQUE (previous_lease_id),   -- a lease can be renewed once
    CONSTRAINT uq_lease_contracts_active_unit UNIQUE (active_unit_id),      -- one ACTIVE lease per unit
    CONSTRAINT fk_lease_contracts_unit FOREIGN KEY (rentable_unit_id) REFERENCES rentable_units (zone_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_lease_contracts_renter FOREIGN KEY (renter_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_lease_contracts_previous FOREIGN KEY (previous_lease_id) REFERENCES lease_contracts (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_lease_contracts_dates  CHECK (end_date > start_date),
    CONSTRAINT ck_lease_contracts_rent   CHECK (monthly_rent >= 0),
    CONSTRAINT ck_lease_contracts_status CHECK (status IN ('ACTIVE', 'ENDED', 'TERMINATED', 'RENEWED')),
    CONSTRAINT ck_lease_contracts_terms  CHECK (payment_terms IN
        ('MONTHLY_ADVANCE', 'MONTHLY_ARREARS', 'QUARTERLY_ADVANCE', 'SEMI_ANNUAL_ADVANCE', 'ANNUAL_ADVANCE')),
    CONSTRAINT ck_lease_contracts_closed CHECK (
        (status = 'ACTIVE' AND closed_on IS NULL) OR (status <> 'ACTIVE' AND closed_on IS NOT NULL)),
    CONSTRAINT ck_lease_contracts_reason CHECK (termination_reason IS NULL OR status = 'TERMINATED'),
    CONSTRAINT ck_lease_contracts_auto   CHECK (ended_automatically = FALSE OR status = 'ENDED'),
    CONSTRAINT ck_lease_contracts_released CHECK (released_on IS NULL OR status IN ('ENDED', 'TERMINATED'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 9. payments  (Java: Payment; billing_month = YearMonth stored as the 1st of the month)
--    billing_month is the FIRST month of the period paid (one month, or 3 / 6 / 12 with
--    quarterly / semi-annual / annual payment terms); amount covers the whole period.
--    paid_lease_id is calculated: the lease id only when status = 'PAID'.
--    UNIQUE (paid_lease_id, billing_month) blocks paying the same month twice,
--    while FAILED / PENDING attempts can repeat.
-- ---------------------------------------------------------------------
CREATE TABLE payments (
    id             INT           NOT NULL AUTO_INCREMENT,
    lease_id       INT           NOT NULL,
    renter_id      INT           NOT NULL,
    billing_month  DATE          NOT NULL,
    amount         DECIMAL(10,2) NOT NULL,
    method         VARCHAR(10)   NOT NULL,
    status         VARCHAR(10)   NOT NULL DEFAULT 'PENDING',
    reference_no   VARCHAR(40)   NULL,
    paid_at        DATETIME      NULL,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_lease_id  INT AS (IF(status = 'PAID', lease_id, NULL)) STORED,
    CONSTRAINT pk_payments PRIMARY KEY (id),
    CONSTRAINT uq_payments_reference  UNIQUE (reference_no),
    CONSTRAINT uq_payments_paid_month UNIQUE (paid_lease_id, billing_month),
    CONSTRAINT fk_payments_lease FOREIGN KEY (lease_id) REFERENCES lease_contracts (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_payments_renter FOREIGN KEY (renter_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_payments_month  CHECK (DAYOFMONTH(billing_month) = 1),
    CONSTRAINT ck_payments_amount CHECK (amount > 0),
    CONSTRAINT ck_payments_method CHECK (method IN ('GCASH', 'MAYA', 'CARD')),
    CONSTRAINT ck_payments_status CHECK (status IN ('PENDING', 'PAID', 'FAILED')),
    CONSTRAINT ck_payments_paid   CHECK (
        (status = 'PAID' AND reference_no IS NOT NULL AND paid_at IS NOT NULL) OR status <> 'PAID')
) ENGINE = InnoDB;

CREATE INDEX ix_payments_lease_month ON payments (lease_id, billing_month);

-- ---------------------------------------------------------------------
-- 10. uploaded_files  (Java: StoredFile) - photos, site plans and contract PDFs.
--     The file itself is saved in the uploads/ folder (spacegrid.upload-dir) under stored_name;
--     this row says what it belongs to. Exactly one owner column is set, matching file_kind:
--       PROPERTY_PHOTO, SITE_PLAN -> property_id   UNIT_PHOTO -> unit_id   CONTRACT -> lease_id
-- ---------------------------------------------------------------------
CREATE TABLE uploaded_files (
    id            INT          NOT NULL AUTO_INCREMENT,
    file_kind     VARCHAR(20)  NOT NULL,
    property_id   INT          NULL,
    unit_id       INT          NULL,
    lease_id      INT          NULL,
    file_name     VARCHAR(255) NOT NULL,                   -- the name on the uploader's computer (shown on screen)
    stored_name   VARCHAR(100) NOT NULL,                   -- random name in the uploads folder
    content_type  VARCHAR(50)  NOT NULL,                   -- image/jpeg, image/png, image/webp or application/pdf
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_uploaded_files PRIMARY KEY (id),
    CONSTRAINT uq_uploaded_files_stored UNIQUE (stored_name),
    CONSTRAINT fk_uploaded_files_property FOREIGN KEY (property_id) REFERENCES properties (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_uploaded_files_unit FOREIGN KEY (unit_id) REFERENCES rentable_units (zone_id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT fk_uploaded_files_lease FOREIGN KEY (lease_id) REFERENCES lease_contracts (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_uploaded_files_kind CHECK (file_kind IN ('PROPERTY_PHOTO', 'SITE_PLAN', 'UNIT_PHOTO', 'CONTRACT')),
    CONSTRAINT ck_uploaded_files_owner CHECK (
        (file_kind IN ('PROPERTY_PHOTO', 'SITE_PLAN') AND property_id IS NOT NULL AND unit_id IS NULL AND lease_id IS NULL)
        OR (file_kind = 'UNIT_PHOTO' AND unit_id IS NOT NULL AND property_id IS NULL AND lease_id IS NULL)
        OR (file_kind = 'CONTRACT' AND lease_id IS NOT NULL AND property_id IS NULL AND unit_id IS NULL))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- View used by JdbcLeaseContractDao: lease + the display names
-- (LeaseContract.unitName / propertyName / renterName), the landlord id and the unit's first photo.
-- ---------------------------------------------------------------------
CREATE VIEW lease_details AS
SELECT  l.id, l.rentable_unit_id, l.renter_id, l.previous_lease_id,
        l.start_date, l.end_date, l.monthly_rent, l.payment_terms,
        l.tenant_name, l.tenant_email, l.tenant_phone,
        l.status, l.closed_on, l.termination_reason, l.ended_automatically, l.released_on, l.created_at,
        z.name        AS unit_name,
        p.id          AS property_id,
        p.name        AS property_name,
        p.landlord_id AS landlord_id,
        u.full_name   AS renter_name,
        u.username    AS renter_username,
        (SELECT MIN(f.id) FROM uploaded_files f
         WHERE f.unit_id = l.rentable_unit_id AND f.file_kind = 'UNIT_PHOTO') AS unit_photo_id
FROM    lease_contracts l
JOIN    grid_zones  z ON z.id = l.rentable_unit_id
JOIN    properties  p ON p.id = z.property_id
JOIN    users       u ON u.id = l.renter_id;

-- ---------------------------------------------------------------------
-- 11. lease_requests  (Java: LeaseRequest) - a renter asks to lease an AVAILABLE unit
--     found on the homepage; the landlord approves or declines it, then creates the lease.
--     pending_key is calculated: it holds "unit-renter" only while the request is PENDING,
--     so its UNIQUE rule blocks the same renter from having two open requests on one unit.
-- ---------------------------------------------------------------------
CREATE TABLE lease_requests (
    id                INT           NOT NULL AUTO_INCREMENT,
    rentable_unit_id  INT           NULL,                  -- NULL once the landlord deleted the unit
    unit_label        VARCHAR(100)  NOT NULL,              -- unit name when the request was made (kept if the unit is deleted)
    property_label    VARCHAR(100)  NOT NULL,              -- property name when the request was made
    renter_id         INT           NOT NULL,
    desired_start     DATE          NOT NULL,
    months            TINYINT       NOT NULL,
    message           VARCHAR(500)  NULL,
    status            VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    decided_at        DATETIME      NULL,                  -- when approved / declined / cancelled
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pending_key       VARCHAR(30) AS (IF(status = 'PENDING', CONCAT(rentable_unit_id, '-', renter_id), NULL)) STORED,
    CONSTRAINT pk_lease_requests PRIMARY KEY (id),
    CONSTRAINT uq_lease_requests_pending UNIQUE (pending_key),
    -- Deleting a unit keeps its requests (they are declined first) so the renter still sees what happened.
    CONSTRAINT fk_lease_requests_unit FOREIGN KEY (rentable_unit_id) REFERENCES rentable_units (zone_id)
        ON DELETE SET NULL ON UPDATE RESTRICT,
    CONSTRAINT fk_lease_requests_renter FOREIGN KEY (renter_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_lease_requests_months  CHECK (months BETWEEN 1 AND 60),
    CONSTRAINT ck_lease_requests_status  CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED')),
    CONSTRAINT ck_lease_requests_decided CHECK (
        (status = 'PENDING' AND decided_at IS NULL) OR (status <> 'PENDING' AND decided_at IS NOT NULL))
) ENGINE = InnoDB;

-- View used by JdbcLeaseRequestDao: request + display names, the unit's rate and the landlord id.
-- After the unit was deleted the names come from the labels saved with the request, and rate/property/landlord are NULL.
CREATE VIEW lease_request_details AS
SELECT  r.id, r.rentable_unit_id, r.renter_id, r.desired_start, r.months, r.message,
        r.status, r.decided_at, r.created_at,
        COALESCE(z.name, r.unit_label)     AS unit_name,
        u.rental_rate                      AS rental_rate,
        p.id                               AS property_id,
        COALESCE(p.name, r.property_label) AS property_name,
        p.landlord_id                      AS landlord_id,
        usr.full_name                      AS renter_name
FROM    lease_requests r
LEFT JOIN grid_zones     z   ON z.id = r.rentable_unit_id
LEFT JOIN rentable_units u   ON u.zone_id = z.id
LEFT JOIN properties     p   ON p.id = z.property_id
JOIN      users          usr ON usr.id = r.renter_id;

-- =====================================================================
--  SAMPLE DATA  (today in the story: late October 2026)
-- =====================================================================

INSERT INTO users (id, username, password_hash, full_name, email, phone, role) VALUES
    (1, 'maria.santos', '$2a$10$xa6bk8SrcyVlZBTkbUZhaedvRDXVzirEaSAB0MEbzEeHZLo.PCluy', 'Maria Santos', 'maria.santos@example.com', '+63 917 555 0001', 'LANDLORD'),
    (2, 'jose.reyes', '$2a$10$UetlukyMfYqTVbQqKT61b.HgkuA6b4wfZPJvNATXQc8FBkAGO02T.', 'Jose Reyes', 'jose.reyes@example.com', '+63 917 555 0002', 'LANDLORD'),
    (3, 'ana.cruz', '$2a$10$DZM1gRWmxi6JAteggmCKGOBxZMR.Nj1NQaSAU7.dVwvzQafroIQuG', 'Ana Cruz', 'ana.cruz@example.com', '+63 917 555 0101', 'RENTER'),
    (4, 'paolo.garcia', '$2a$10$QkRkiHaHZpflgYT0WkOVhuISlYhhGCeC2t9ScDzWRnrv2xRsoXUNK', 'Paolo Garcia', 'paolo.garcia@example.com', '+63 917 555 0102', 'RENTER'),
    (5, 'liza.mendoza', '$2a$10$ea1UwbTp0KqG6U0SD6VY4.TsfDn1hLQ42/jNonDQi9r3Qsffr86P.', 'Liza Mendoza', NULL, NULL, 'RENTER');

INSERT INTO properties (id, landlord_id, name, address, city, region, property_type, description,
                        is_exact_size, size_description, area_sqm, default_rate,
                        has_parking, has_power_backup, has_security, has_water_access, is_open_24h,
                        status, grid_rows, grid_columns) VALUES
    (1, 1, 'SpaceGrid Suites Bajada', 'J.P. Laurel Ave, Bajada', 'Davao City', 'Davao del Sur', 'APARTMENT', 'Two-floor apartment near Victoria Plaza with a shared garden.', 1, NULL, 180.00, 12000.00, 0, 1, 1, 1, 1, 'ACTIVE', 4, 6),
    (2, 1, 'Matina Enclave Residences', 'MacArthur Highway, Matina', 'Davao City', 'Davao del Sur', 'CONDOMINIUM', 'Condo floor still being set up.', 0, 'Half-floor', NULL, NULL, 1, 0, 1, 1, 0, 'DRAFT', 3, 3),
    (3, 2, 'Agdao Market Stalls', 'Lapu-Lapu St, Agdao', 'Davao City', 'Davao del Sur', 'COMMERCIAL', 'Ground-floor stalls with customer parking.', 1, NULL, 96.00, 6000.00, 1, 0, 1, 1, 0, 'ACTIVE', 2, 4),
    (4, 2, 'Roxas Night Market - Section C', 'Roxas Ave, Poblacion District', 'Davao City', 'Davao del Sur', 'NIGHT_MARKET', 'Evening market booths along a covered walkway.', 1, NULL, 150.00, 4500.00, 0, 1, 1, 1, 0, 'ACTIVE', 3, 4),
    (5, 1, 'Magsaysay Open Plaza', 'Magsaysay Park', 'Davao City', 'Davao del Sur', 'OPEN_SPACE', 'Open plaza plots for pop-up stalls and events.', 0, 'Open plaza', NULL, 2500.00, 0, 0, 0, 1, 1, 'ACTIVE', 2, 3);

-- Property 1 grid (4 x 6):
--   row 0: [101][101][102][102][103][103]
--   row 1: [101][101][102][102][103][103]
--   row 2: [hall][hall][hall][hall][hall][hall]
--   row 3: [bath][104][104][garden][garden][garden]      Storage Room = archived, no spots
INSERT INTO grid_zones (id, property_id, zone_kind, name) VALUES
    (1, 1, 'UNIT', 'Unit 101'),
    (2, 1, 'UNIT', 'Unit 102'),
    (3, 1, 'UNIT', 'Unit 103'),
    (4, 1, 'COMMON', 'Hallway'),
    (5, 1, 'COMMON', 'Shared Bathroom'),
    (6, 1, 'UNIT', 'Unit 104'),
    (7, 1, 'COMMON', 'Garden'),
    (8, 1, 'UNIT', 'Storage Room'),
    (9, 2, 'UNIT', 'Studio A'),
    (10, 2, 'COMMON', 'Lobby'),
    (11, 3, 'UNIT', 'Stall 1'),
    (12, 3, 'UNIT', 'Stall 2'),
    (13, 3, 'COMMON', 'Parking'),
    (14, 4, 'UNIT', 'Booth 1'),
    (15, 4, 'UNIT', 'Booth 2'),
    (16, 4, 'UNIT', 'Booth 3'),
    (17, 4, 'UNIT', 'Booth 4'),
    (18, 4, 'COMMON', 'Walkway'),
    (19, 5, 'UNIT', 'Plot A'),
    (20, 5, 'UNIT', 'Plot B');

INSERT INTO rentable_units (zone_id, rental_rate, is_exact_size, size_description, area_sqm,
                            includes_electricity, includes_water, status) VALUES
    (1, 12000.00, 1, NULL, 36.00, 1, 1, 'OCCUPIED'),
    (2, 12500.00, 1, NULL, 36.00, 1, 1, 'OCCUPIED'),
    (3, 9800.00, 0, 'Studio-size', NULL, 0, 1, 'AVAILABLE'),
    (6, 8500.00, 1, NULL, 18.00, 0, 0, 'UNDER_MAINTENANCE'),
    (8, 7000.00, NULL, NULL, NULL, 0, 0, 'ARCHIVED'),
    (9, 15000.00, 1, NULL, 40.00, 1, 1, 'AVAILABLE'),
    (11, 6000.00, 1, NULL, 12.00, 1, 0, 'OCCUPIED'),
    (12, 6000.00, 1, NULL, 12.00, 1, 0, 'AVAILABLE'),
    (14, 4500.00, 1, NULL, 20.00, 1, 0, 'AVAILABLE'),
    (15, 4500.00, 1, NULL, 20.00, 1, 0, 'AVAILABLE'),
    (16, 5200.00, 1, NULL, 25.00, 1, 1, 'AVAILABLE'),
    (17, 5200.00, 1, NULL, 25.00, 1, 1, 'UNDER_MAINTENANCE'),
    (19, 3000.00, 0, 'Large plot', NULL, 0, 0, 'AVAILABLE'),
    (20, 2200.00, 0, 'Small plot', NULL, 0, 0, 'AVAILABLE');

-- color NULL = the type's default color. The night market walkway shows a picked color.
INSERT INTO common_areas (zone_id, area_type, color) VALUES
    (4, 'WALKWAY', NULL),
    (5, 'BATHROOM', NULL),
    (7, 'GRASS', NULL),
    (10, 'LOBBY', NULL),
    (13, 'PARKING', NULL),
    (18, 'WALKWAY', '#fde68a');

INSERT INTO zone_cells (property_id, row_idx, col_idx, zone_id) VALUES
    (1, 0, 0, 1),
    (1, 0, 1, 1),
    (1, 1, 0, 1),
    (1, 1, 1, 1),
    (1, 0, 2, 2),
    (1, 0, 3, 2),
    (1, 1, 2, 2),
    (1, 1, 3, 2),
    (1, 0, 4, 3),
    (1, 0, 5, 3),
    (1, 1, 4, 3),
    (1, 1, 5, 3),
    (1, 2, 0, 4),
    (1, 2, 1, 4),
    (1, 2, 2, 4),
    (1, 2, 3, 4),
    (1, 2, 4, 4),
    (1, 2, 5, 4),
    (1, 3, 0, 5),
    (1, 3, 1, 6),
    (1, 3, 2, 6),
    (1, 3, 3, 7),
    (1, 3, 4, 7),
    (1, 3, 5, 7),
    (2, 0, 0, 9),
    (2, 0, 1, 9),
    (2, 1, 0, 9),
    (2, 1, 1, 9),
    (2, 2, 0, 10),
    (2, 2, 1, 10),
    (2, 2, 2, 10),
    (3, 0, 0, 11),
    (3, 0, 1, 11),
    (3, 0, 2, 12),
    (3, 0, 3, 12),
    (3, 1, 0, 13),
    (3, 1, 1, 13),
    (3, 1, 2, 13),
    (3, 1, 3, 13),
    (4, 0, 0, 14),
    (4, 0, 1, 14),
    (4, 0, 2, 15),
    (4, 0, 3, 15),
    (4, 1, 0, 18),
    (4, 1, 1, 18),
    (4, 1, 2, 18),
    (4, 1, 3, 18),
    (4, 2, 0, 16),
    (4, 2, 1, 16),
    (4, 2, 2, 17),
    (4, 2, 3, 17),
    (5, 0, 0, 19),
    (5, 0, 1, 19),
    (5, 1, 0, 19),
    (5, 1, 1, 19),
    (5, 0, 2, 20),
    (5, 1, 2, 20);

-- Manual edits on top of the automatic walls (doors to the hallway, street windows)
INSERT INTO edge_overrides (property_id, row_idx, col_idx, orientation, edge_type) VALUES
    (1, 2, 0, 'HORIZONTAL', 'DOOR'),
    (1, 2, 2, 'HORIZONTAL', 'DOOR'),
    (1, 2, 4, 'HORIZONTAL', 'DOOR'),
    (1, 3, 0, 'HORIZONTAL', 'DOOR'),
    (1, 3, 1, 'HORIZONTAL', 'DOOR'),
    (1, 0, 0, 'HORIZONTAL', 'WINDOW'),
    (1, 0, 4, 'HORIZONTAL', 'WINDOW'),
    (3, 1, 0, 'HORIZONTAL', 'DOOR'),
    (3, 1, 2, 'HORIZONTAL', 'DOOR');

-- Lease 3 is a renewal of lease 2 (rent went up); lease 3 ends 2026-11-15 -> EXPIRING_SOON.
-- Lease 4 is the old lease of the archived Storage Room (kept as history).
INSERT INTO lease_contracts (id, rentable_unit_id, renter_id, previous_lease_id, start_date, end_date,
                             monthly_rent, payment_terms, tenant_name, tenant_email, tenant_phone, status, closed_on, released_on) VALUES
    (1, 1, 3, NULL, '2026-06-01', '2027-05-31', 12000.00, 'MONTHLY_ADVANCE', 'Ana Cruz', 'ana.cruz@example.com', '+63 917 555 0101', 'ACTIVE', NULL, NULL),
    (2, 2, 4, NULL, '2025-05-01', '2026-04-30', 12000.00, 'MONTHLY_ADVANCE', 'Paolo Garcia', 'paolo.garcia@example.com', '+63 917 555 0102', 'RENEWED', '2026-04-30', NULL),
    (3, 2, 4, 2, '2026-05-01', '2026-11-15', 12500.00, 'MONTHLY_ADVANCE', 'Paolo Garcia', 'paolo.garcia@example.com', '+63 917 555 0102', 'ACTIVE', NULL, NULL),
    (4, 8, 5, NULL, '2025-01-01', '2025-12-31', 7000.00, 'MONTHLY_ADVANCE', 'Liza Mendoza', 'liza.mendoza@example.com', NULL, 'ENDED', '2025-12-31', '2025-12-31'),
    (5, 11, 5, NULL, '2026-08-01', '2027-07-31', 6000.00, 'MONTHLY_ADVANCE', 'Liza Mendoza', 'liza.mendoza@example.com', '+63 917 555 0103', 'ACTIVE', NULL, NULL);

-- Lease 1: one FAILED card attempt in September, November paid ahead.
-- Lease 3: October not paid yet -> OVERDUE on the statement.
INSERT INTO payments (lease_id, renter_id, billing_month, amount, method, status, reference_no, paid_at) VALUES
    (2, 4, '2025-05-01', 12000.00, 'GCASH', 'PAID', 'SG-20250429-0001', '2025-04-29 10:15:00'),
    (2, 4, '2025-06-01', 12000.00, 'GCASH', 'PAID', 'SG-20250530-0002', '2025-05-30 10:15:00'),
    (2, 4, '2025-07-01', 12000.00, 'GCASH', 'PAID', 'SG-20250629-0003', '2025-06-29 10:15:00'),
    (2, 4, '2025-08-01', 12000.00, 'GCASH', 'PAID', 'SG-20250730-0004', '2025-07-30 10:15:00'),
    (2, 4, '2025-09-01', 12000.00, 'GCASH', 'PAID', 'SG-20250830-0005', '2025-08-30 10:15:00'),
    (2, 4, '2025-10-01', 12000.00, 'GCASH', 'PAID', 'SG-20250929-0006', '2025-09-29 10:15:00'),
    (2, 4, '2025-11-01', 12000.00, 'GCASH', 'PAID', 'SG-20251030-0007', '2025-10-30 10:15:00'),
    (2, 4, '2025-12-01', 12000.00, 'GCASH', 'PAID', 'SG-20251129-0008', '2025-11-29 10:15:00'),
    (2, 4, '2026-01-01', 12000.00, 'GCASH', 'PAID', 'SG-20251230-0009', '2025-12-30 10:15:00'),
    (2, 4, '2026-02-01', 12000.00, 'GCASH', 'PAID', 'SG-20260130-0010', '2026-01-30 10:15:00'),
    (2, 4, '2026-03-01', 12000.00, 'GCASH', 'PAID', 'SG-20260227-0011', '2026-02-27 10:15:00'),
    (2, 4, '2026-04-01', 12000.00, 'GCASH', 'PAID', 'SG-20260330-0012', '2026-03-30 10:15:00'),
    (1, 3, '2026-06-01', 12000.00, 'MAYA', 'PAID', 'SG-20260530-0013', '2026-05-30 10:15:00'),
    (1, 3, '2026-07-01', 12000.00, 'MAYA', 'PAID', 'SG-20260629-0014', '2026-06-29 10:15:00'),
    (1, 3, '2026-08-01', 12000.00, 'MAYA', 'PAID', 'SG-20260730-0015', '2026-07-30 10:15:00'),
    (1, 3, '2026-09-01', 12000.00, 'CARD', 'FAILED', NULL, NULL),
    (1, 3, '2026-09-01', 12000.00, 'CARD', 'PAID', 'SG-20260831-0016', '2026-08-31 10:15:00'),
    (1, 3, '2026-10-01', 12000.00, 'MAYA', 'PAID', 'SG-20260929-0017', '2026-09-29 10:15:00'),
    (1, 3, '2026-11-01', 12000.00, 'MAYA', 'PAID', 'SG-20261020-0018', '2026-10-20 10:15:00'),
    (3, 4, '2026-05-01', 12500.00, 'GCASH', 'PAID', 'SG-20260429-0019', '2026-04-29 10:15:00'),
    (3, 4, '2026-06-01', 12500.00, 'GCASH', 'PAID', 'SG-20260530-0020', '2026-05-30 10:15:00'),
    (3, 4, '2026-07-01', 12500.00, 'GCASH', 'PAID', 'SG-20260629-0021', '2026-06-29 10:15:00'),
    (3, 4, '2026-08-01', 12500.00, 'GCASH', 'PAID', 'SG-20260730-0022', '2026-07-30 10:15:00'),
    (3, 4, '2026-09-01', 12500.00, 'GCASH', 'PAID', 'SG-20260830-0023', '2026-08-30 10:15:00'),
    (4, 5, '2025-01-01', 7000.00, 'GCASH', 'PAID', 'SG-20241229-0024', '2024-12-29 10:15:00'),
    (4, 5, '2025-02-01', 7000.00, 'GCASH', 'PAID', 'SG-20250129-0025', '2025-01-29 10:15:00'),
    (4, 5, '2025-03-01', 7000.00, 'GCASH', 'PAID', 'SG-20250226-0026', '2025-02-26 10:15:00'),
    (4, 5, '2025-04-01', 7000.00, 'GCASH', 'PAID', 'SG-20250329-0027', '2025-03-29 10:15:00'),
    (4, 5, '2025-05-01', 7000.00, 'GCASH', 'PAID', 'SG-20250428-0028', '2025-04-28 10:15:00'),
    (4, 5, '2025-06-01', 7000.00, 'GCASH', 'PAID', 'SG-20250529-0029', '2025-05-29 10:15:00'),
    (4, 5, '2025-07-01', 7000.00, 'GCASH', 'PAID', 'SG-20250628-0030', '2025-06-28 10:15:00'),
    (4, 5, '2025-08-01', 7000.00, 'GCASH', 'PAID', 'SG-20250729-0031', '2025-07-29 10:15:00'),
    (4, 5, '2025-09-01', 7000.00, 'GCASH', 'PAID', 'SG-20250829-0032', '2025-08-29 10:15:00'),
    (4, 5, '2025-10-01', 7000.00, 'GCASH', 'PAID', 'SG-20250928-0033', '2025-09-28 10:15:00'),
    (4, 5, '2025-11-01', 7000.00, 'GCASH', 'PAID', 'SG-20251029-0034', '2025-10-29 10:15:00'),
    (4, 5, '2025-12-01', 7000.00, 'GCASH', 'PAID', 'SG-20251128-0035', '2025-11-28 10:15:00'),
    (5, 5, '2026-08-01', 6000.00, 'CARD', 'PAID', 'SG-20260730-0036', '2026-07-30 10:15:00'),
    (5, 5, '2026-09-01', 6000.00, 'CARD', 'PAID', 'SG-20260830-0037', '2026-08-30 10:15:00'),
    (5, 5, '2026-10-01', 6000.00, 'CARD', 'PAID', 'SG-20260929-0038', '2026-09-29 10:15:00');

-- Lease requests made from the homepage. Request 4 was approved: the landlord still has to create the lease.
INSERT INTO lease_requests (id, rentable_unit_id, unit_label, property_label, renter_id, desired_start, months, message, status, decided_at) VALUES
    (1, 3, 'Unit 103', 'SpaceGrid Suites Bajada', 4, '2026-11-15', 12, 'Looking for a studio near the city center.', 'PENDING', NULL),
    (2, 12, 'Stall 2', 'Agdao Market Stalls', 3, '2026-12-01', 6, 'Planning to open a small food stall.', 'PENDING', NULL),
    (3, 12, 'Stall 2', 'Agdao Market Stalls', 5, '2026-09-01', 6, NULL, 'DECLINED', '2026-08-25 09:00:00'),
    (4, 14, 'Booth 1', 'Roxas Night Market - Section C', 5, '2026-11-10', 3, 'Selling handmade crafts on weekends.', 'APPROVED', '2026-10-26 14:30:00');


-- =====================================================================
--  DEMO ACCOUNTS: landlords and renters   (today in the story: 2026-10-29)
--  Added after the sample data above, which is unchanged. All passwords: password123
--    landlords: landlord, landlord2, landlord3
--    renters:   renter, renter2, renter3, renter4, renter5
--  Plan: docs/projectfiles/dummy-data-plan.md
--  Photos are not stored here: they ship in src/main/resources/static/images/
--  (found by file name, see model/DemoImages.java).
-- =====================================================================
INSERT INTO users (id, username, password_hash, full_name, email, phone, role) VALUES
    (6, 'landlord', '$2a$10$RXn7oYRxUj1NdE6zBb8NHOC9NEdyORqniD3RuLbyBvAjr4Cd0OqGu', 'Ramon Dela Cruz', 'ramon.delacruz@example.com', '+63 917 555 0201', 'LANDLORD'),
    (7, 'landlord2', '$2a$10$RXn7oYRxUj1NdE6zBb8NHOC9NEdyORqniD3RuLbyBvAjr4Cd0OqGu', 'Teresita Villanueva', 'teresita.villanueva@example.com', '+63 917 555 0202', 'LANDLORD'),
    (8, 'landlord3', '$2a$10$RXn7oYRxUj1NdE6zBb8NHOC9NEdyORqniD3RuLbyBvAjr4Cd0OqGu', 'Benjie Magallanes', 'benjie.magallanes@example.com', '+63 917 555 0203', 'LANDLORD'),
    (9, 'renter', '$2a$10$RXn7oYRxUj1NdE6zBb8NHOC9NEdyORqniD3RuLbyBvAjr4Cd0OqGu', 'Jasmine Ocampo', 'jasmine.ocampo@example.com', '+63 917 555 0211', 'RENTER'),
    (10, 'renter2', '$2a$10$RXn7oYRxUj1NdE6zBb8NHOC9NEdyORqniD3RuLbyBvAjr4Cd0OqGu', 'Carlo Abellana', 'carlo.abellana@example.com', '+63 917 555 0212', 'RENTER'),
    (11, 'renter3', '$2a$10$RXn7oYRxUj1NdE6zBb8NHOC9NEdyORqniD3RuLbyBvAjr4Cd0OqGu', 'Marites Lumbay', 'marites.lumbay@example.com', '+63 917 555 0213', 'RENTER'),
    (12, 'renter4', '$2a$10$RXn7oYRxUj1NdE6zBb8NHOC9NEdyORqniD3RuLbyBvAjr4Cd0OqGu', 'Joel Tumulak', 'joel.tumulak@example.com', '+63 917 555 0214', 'RENTER'),
    (13, 'renter5', '$2a$10$RXn7oYRxUj1NdE6zBb8NHOC9NEdyORqniD3RuLbyBvAjr4Cd0OqGu', 'Kristine Bacalso', NULL, NULL, 'RENTER');

INSERT INTO properties (id, landlord_id, name, address, city, region, property_type, description,
                        is_exact_size, size_description, area_sqm, default_rate,
                        has_parking, has_power_backup, has_security, has_water_access, is_open_24h,
                        status, grid_rows, grid_columns) VALUES
    (6, 6, 'Lanang Bayview Apartments', 'Insular Village Road, Lanang', 'Davao City', 'Davao del Sur', 'APARTMENT', 'Two-storey apartment building near the Lanang business district with a shared garden and covered parking.', 1, NULL, 220.0, 13000.0, 1, 1, 1, 1, 1, 'ACTIVE', 5, 8),
    (7, 6, 'Ecoland Garden Condominium', 'Ecoland Drive, Barangay 76-A', 'Davao City', 'Davao del Sur', 'CONDOMINIUM', 'Condominium floor close to Ecoland Terminal with a lobby, shared kitchen and landscaped garden.', 0, 'Whole floor', NULL, NULL, 1, 0, 1, 1, 0, 'ACTIVE', 4, 6),
    (8, 6, 'Buhangin Townhomes Row', 'Cabaguio Avenue, Buhangin', 'Davao City', 'Davao del Sur', 'TOWNHOUSE', 'Four townhouses in a row with a shared driveway and a small garden at the back.', NULL, NULL, NULL, 15000.0, 1, 0, 0, 1, 0, 'ACTIVE', 4, 8),
    (9, 6, 'Bolton Commercial Arcade', 'Bolton Street, Poblacion District', 'Davao City', 'Davao del Sur', 'COMMERCIAL', 'Street-level shop arcade with a covered walkway, customer parking and a public restroom.', 1, NULL, 180.0, NULL, 1, 1, 1, 0, 0, 'ACTIVE', 5, 7),
    (10, 6, 'Toril Weekend Night Bazaar', 'Saipan Road, Toril', 'Davao City', 'Davao del Sur', 'NIGHT_MARKET', 'Weekend night bazaar with stalls along a lit walkway and a shared commissary kitchen.', 1, NULL, 90.0, 3500.0, 0, 1, 1, 0, 0, 'ACTIVE', 4, 6),
    (11, 6, 'Sta. Ana Wharf Open Lot', 'Sta. Ana Wharf, Barangay 19-B', 'Davao City', 'Davao del Sur', 'OPEN_SPACE', 'Open lot beside the Sta. Ana wharf. Archived while the owner reviews the use of the land.', 0, 'Lot by the wharf', NULL, NULL, 0, 0, 0, 0, 0, 'ARCHIVED', 3, 4),
    (12, 6, 'Catalunan Pequeno Duplex', 'Catalunan Pequeno Road', 'Davao City', 'Davao del Sur', 'TOWNHOUSE', 'Duplex still being set up in the plotter.', 1, NULL, 110.0, NULL, 0, 0, 0, 1, 0, 'DRAFT', 3, 4),
    (13, 7, 'Matina Town Center Shops', 'MacArthur Highway, Matina', 'Davao City', 'Davao del Sur', 'COMMERCIAL', 'Row of four street-front shops with a walkway and parking, next to the Matina town center.', 1, NULL, 140.0, NULL, 1, 0, 1, 0, 0, 'ACTIVE', 4, 6),
    (14, 7, 'Magallanes Street Night Food Market', 'Magallanes Street, Poblacion District', 'Davao City', 'Davao del Sur', 'NIGHT_MARKET', 'Street food market that opens at dusk, with booths, a wash area and a restroom.', 0, 'Half street', NULL, 5500.0, 0, 1, 0, 1, 0, 'ACTIVE', 4, 6),
    (15, 7, 'Davao Riverside Events Lawn', 'Riverside Road, Ma-a', 'Davao City', 'Davao del Sur', 'OPEN_SPACE', 'Wide lawn by the river for events, weekend markets and pop-up stalls.', 1, NULL, 600.0, NULL, 0, 0, 0, 1, 1, 'ACTIVE', 3, 5),
    (16, 8, 'Maa Starter Apartments', 'Ma-a Road, Ma-a', 'Davao City', 'Davao del Sur', 'APARTMENT', 'A new landlord is starting to draw this building.', NULL, NULL, NULL, 7500.0, 0, 0, 0, 0, 0, 'DRAFT', 4, 5);

INSERT INTO grid_zones (id, property_id, zone_kind, name) VALUES
    (21, 6, 'UNIT', 'A101'),
    (22, 6, 'UNIT', 'A102'),
    (23, 6, 'UNIT', 'A103'),
    (24, 6, 'UNIT', 'A104'),
    (25, 6, 'UNIT', 'A201'),
    (26, 6, 'UNIT', 'A202'),
    (27, 6, 'COMMON', 'Hallway'),
    (28, 6, 'COMMON', 'Stairs'),
    (29, 6, 'COMMON', 'Lobby'),
    (30, 6, 'COMMON', 'Parking'),
    (31, 6, 'COMMON', 'Laundry Area'),
    (32, 6, 'COMMON', 'Garden'),
    (33, 7, 'UNIT', '5A'),
    (34, 7, 'UNIT', '5B'),
    (35, 7, 'UNIT', '5C'),
    (36, 7, 'UNIT', '5D'),
    (37, 7, 'UNIT', '6A'),
    (38, 7, 'COMMON', 'Lobby'),
    (39, 7, 'COMMON', 'Shared Kitchen'),
    (40, 7, 'COMMON', 'Shared Bathroom'),
    (41, 7, 'COMMON', 'Corridor'),
    (42, 8, 'UNIT', 'Townhouse 1'),
    (43, 8, 'UNIT', 'Townhouse 2'),
    (44, 8, 'UNIT', 'Townhouse 3'),
    (45, 8, 'UNIT', 'Townhouse 4'),
    (46, 8, 'COMMON', 'Driveway'),
    (47, 8, 'COMMON', 'Back Garden'),
    (48, 9, 'UNIT', 'Shop 1'),
    (49, 9, 'UNIT', 'Shop 2'),
    (50, 9, 'UNIT', 'Shop 3'),
    (51, 9, 'UNIT', 'Shop 4'),
    (52, 9, 'UNIT', 'Shop 5'),
    (53, 9, 'UNIT', 'Shop 6'),
    (54, 9, 'COMMON', 'Arcade Walkway'),
    (55, 9, 'COMMON', 'Customer Parking'),
    (56, 9, 'COMMON', 'Public Restroom'),
    (57, 10, 'UNIT', 'Stall N1'),
    (58, 10, 'UNIT', 'Stall N2'),
    (59, 10, 'UNIT', 'Stall N3'),
    (60, 10, 'UNIT', 'Stall N4'),
    (61, 10, 'UNIT', 'Stall N5'),
    (62, 10, 'UNIT', 'Stall N6'),
    (63, 10, 'COMMON', 'Walkway'),
    (64, 10, 'COMMON', 'Commissary'),
    (65, 11, 'UNIT', 'Lot 1'),
    (66, 11, 'UNIT', 'Lot 2'),
    (67, 11, 'COMMON', 'Open Grass'),
    (68, 12, 'UNIT', 'Duplex A'),
    (69, 12, 'COMMON', 'Driveway'),
    (70, 13, 'UNIT', 'Shop A'),
    (71, 13, 'UNIT', 'Shop B'),
    (72, 13, 'UNIT', 'Shop C'),
    (73, 13, 'UNIT', 'Shop D'),
    (74, 13, 'COMMON', 'Shop Walkway'),
    (75, 13, 'COMMON', 'Parking'),
    (76, 14, 'UNIT', 'Booth 1'),
    (77, 14, 'UNIT', 'Booth 2'),
    (78, 14, 'UNIT', 'Booth 3'),
    (79, 14, 'UNIT', 'Booth 4'),
    (80, 14, 'UNIT', 'Booth 5'),
    (81, 14, 'UNIT', 'Booth 6'),
    (82, 14, 'COMMON', 'Walkway'),
    (83, 14, 'COMMON', 'Wash Area'),
    (84, 14, 'COMMON', 'Restroom'),
    (85, 15, 'UNIT', 'Plot 1'),
    (86, 15, 'UNIT', 'Plot 2'),
    (87, 15, 'UNIT', 'Plot 3'),
    (88, 15, 'COMMON', 'Lawn'),
    (89, 15, 'COMMON', 'Riverside Path'),
    (90, 16, 'UNIT', 'Room 1'),
    (91, 16, 'COMMON', 'Hallway'),
    (92, 16, 'UNIT', 'Room 2');

INSERT INTO rentable_units (zone_id, rental_rate, is_exact_size, size_description, area_sqm,
                            includes_electricity, includes_water, status) VALUES
    (21, 14500.00, 1, NULL, 32.00, 1, 1, 'OCCUPIED'),
    (22, 13500.00, 1, NULL, 30.00, 0, 1, 'AVAILABLE'),
    (23, 12000.00, 0, 'Studio-size', NULL, 0, 0, 'AVAILABLE'),
    (24, 11500.00, NULL, NULL, NULL, 0, 0, 'OCCUPIED'),
    (25, 14000.00, 1, NULL, 34.00, 1, 1, 'UNDER_MAINTENANCE'),
    (26, 15000.00, 0, 'Corner unit', NULL, 1, 1, 'AVAILABLE'),
    (33, 18000.00, 1, NULL, 42.00, 1, 1, 'OCCUPIED'),
    (34, 17500.00, 1, NULL, 40.00, 0, 1, 'AVAILABLE'),
    (35, 16000.00, 0, 'Studio', NULL, 0, 0, 'AVAILABLE'),
    (36, 17000.00, NULL, NULL, NULL, 0, 0, 'UNDER_MAINTENANCE'),
    (37, 19500.00, 1, NULL, 48.00, 1, 1, 'AVAILABLE'),
    (42, 15500.00, 1, NULL, 65.00, 0, 1, 'OCCUPIED'),
    (43, 16000.00, 1, NULL, 65.00, 0, 1, 'OCCUPIED'),
    (44, 16500.00, 1, NULL, 70.00, 0, 1, 'AVAILABLE'),
    (45, 10000.00, 0, 'Small townhouse', NULL, 0, 0, 'OCCUPIED'),
    (48, 22000.00, 1, NULL, 28.00, 1, 0, 'AVAILABLE'),
    (49, 20000.00, 1, NULL, 25.00, 1, 0, 'AVAILABLE'),
    (50, 21000.00, 1, NULL, 26.00, 1, 1, 'OCCUPIED'),
    (51, 18500.00, 0, 'Small shop', NULL, 1, 0, 'AVAILABLE'),
    (52, 24000.00, 1, NULL, 30.00, 0, 0, 'UNDER_MAINTENANCE'),
    (53, 23000.00, 1, NULL, 32.00, 1, 1, 'AVAILABLE'),
    (57, 3500.00, 1, NULL, 9.00, 1, 0, 'AVAILABLE'),
    (58, 3500.00, 1, NULL, 9.00, 1, 0, 'AVAILABLE'),
    (59, 4000.00, 0, 'Corner stall', NULL, 1, 0, 'AVAILABLE'),
    (60, 4000.00, 1, NULL, 10.00, 1, 0, 'UNDER_MAINTENANCE'),
    (61, 3000.00, NULL, NULL, NULL, 0, 0, 'AVAILABLE'),
    (62, 4500.00, 1, NULL, 12.00, 1, 1, 'AVAILABLE'),
    (65, 5000.00, NULL, NULL, NULL, 0, 0, 'ARCHIVED'),
    (66, 4000.00, 0, 'Small lot', NULL, 0, 0, 'AVAILABLE'),
    (68, 14000.00, 1, NULL, 55.00, 0, 1, 'AVAILABLE'),
    (70, 25000.00, 1, NULL, 30.00, 1, 0, 'AVAILABLE'),
    (71, 24000.00, 1, NULL, 28.00, 1, 0, 'OCCUPIED'),
    (72, 26000.00, 0, 'Corner shop', NULL, 1, 1, 'AVAILABLE'),
    (73, 22000.00, NULL, NULL, NULL, 0, 0, 'AVAILABLE'),
    (76, 5500.00, 1, NULL, 10.00, 1, 0, 'OCCUPIED'),
    (77, 5500.00, 1, NULL, 10.00, 1, 0, 'AVAILABLE'),
    (78, 6000.00, 0, 'Corner booth', NULL, 1, 0, 'AVAILABLE'),
    (79, 5000.00, NULL, NULL, NULL, 0, 0, 'AVAILABLE'),
    (80, 5000.00, 1, NULL, 10.00, 1, 0, 'UNDER_MAINTENANCE'),
    (81, 7000.00, 1, NULL, 14.00, 1, 1, 'AVAILABLE'),
    (85, 8000.00, 0, 'Large lawn plot', NULL, 0, 0, 'AVAILABLE'),
    (86, 4500.00, 1, NULL, 60.00, 0, 1, 'AVAILABLE'),
    (87, 3000.00, NULL, NULL, NULL, 0, 0, 'AVAILABLE'),
    (90, 7500.00, 1, NULL, 20.00, 0, 0, 'AVAILABLE'),
    (92, 7500.00, NULL, NULL, NULL, 0, 0, 'AVAILABLE');

INSERT INTO common_areas (zone_id, area_type, color) VALUES
    (27, 'WALKWAY', NULL),
    (28, 'STAIRS', NULL),
    (29, 'LOBBY', '#f9a8d4'),
    (30, 'PARKING', NULL),
    (31, 'LAUNDRY', NULL),
    (32, 'GRASS', '#bbf7d0'),
    (38, 'LOBBY', NULL),
    (39, 'KITCHEN', NULL),
    (40, 'BATHROOM', NULL),
    (41, 'WALKWAY', NULL),
    (46, 'PARKING', NULL),
    (47, 'GRASS', NULL),
    (54, 'WALKWAY', '#e7e5e4'),
    (55, 'PARKING', NULL),
    (56, 'BATHROOM', NULL),
    (63, 'WALKWAY', '#fde68a'),
    (64, 'KITCHEN', '#fdba74'),
    (67, 'GRASS', NULL),
    (69, 'WALKWAY', NULL),
    (74, 'WALKWAY', NULL),
    (75, 'PARKING', NULL),
    (82, 'WALKWAY', '#fcd34d'),
    (83, 'LAUNDRY', NULL),
    (84, 'BATHROOM', NULL),
    (88, 'GRASS', NULL),
    (89, 'WALKWAY', NULL),
    (91, 'WALKWAY', NULL);

INSERT INTO zone_cells (property_id, row_idx, col_idx, zone_id) VALUES
    (6, 0, 0, 21),
    (6, 0, 1, 21),
    (6, 0, 2, 22),
    (6, 0, 3, 22),
    (6, 0, 4, 23),
    (6, 0, 5, 23),
    (6, 0, 6, 24),
    (6, 0, 7, 24),
    (6, 1, 0, 21),
    (6, 1, 1, 21),
    (6, 1, 2, 22),
    (6, 1, 3, 22),
    (6, 1, 4, 23),
    (6, 1, 5, 23),
    (6, 1, 6, 24),
    (6, 1, 7, 24),
    (6, 2, 0, 27),
    (6, 2, 1, 27),
    (6, 2, 2, 27),
    (6, 2, 3, 27),
    (6, 2, 4, 27),
    (6, 2, 5, 27),
    (6, 2, 6, 27),
    (6, 2, 7, 27),
    (6, 3, 0, 25),
    (6, 3, 1, 25),
    (6, 3, 2, 26),
    (6, 3, 3, 26),
    (6, 3, 4, 28),
    (6, 3, 5, 31),
    (6, 3, 6, 29),
    (6, 3, 7, 29),
    (6, 4, 0, 30),
    (6, 4, 1, 30),
    (6, 4, 2, 30),
    (6, 4, 3, 30),
    (6, 4, 4, 32),
    (6, 4, 5, 32),
    (6, 4, 6, 32),
    (6, 4, 7, 32),
    (7, 0, 0, 33),
    (7, 0, 1, 33),
    (7, 0, 2, 34),
    (7, 0, 3, 34),
    (7, 0, 4, 35),
    (7, 0, 5, 35),
    (7, 1, 0, 33),
    (7, 1, 1, 33),
    (7, 1, 2, 34),
    (7, 1, 3, 34),
    (7, 1, 4, 35),
    (7, 1, 5, 35),
    (7, 2, 0, 41),
    (7, 2, 1, 41),
    (7, 2, 2, 41),
    (7, 2, 3, 41),
    (7, 2, 4, 41),
    (7, 2, 5, 41),
    (7, 3, 0, 36),
    (7, 3, 1, 37),
    (7, 3, 2, 39),
    (7, 3, 3, 40),
    (7, 3, 4, 38),
    (7, 3, 5, 38),
    (8, 0, 0, 42),
    (8, 0, 1, 42),
    (8, 0, 2, 43),
    (8, 0, 3, 43),
    (8, 0, 4, 44),
    (8, 0, 5, 44),
    (8, 0, 6, 45),
    (8, 0, 7, 45),
    (8, 1, 0, 42),
    (8, 1, 1, 42),
    (8, 1, 2, 43),
    (8, 1, 3, 43),
    (8, 1, 4, 44),
    (8, 1, 5, 44),
    (8, 1, 6, 45),
    (8, 1, 7, 45),
    (8, 2, 0, 46),
    (8, 2, 1, 46),
    (8, 2, 2, 46),
    (8, 2, 3, 46),
    (8, 2, 4, 46),
    (8, 2, 5, 46),
    (8, 2, 6, 46),
    (8, 2, 7, 46),
    (8, 3, 0, 47),
    (8, 3, 1, 47),
    (8, 3, 2, 47),
    (8, 3, 3, 47),
    (8, 3, 4, 47),
    (8, 3, 5, 47),
    (8, 3, 6, 47),
    (8, 3, 7, 47),
    (9, 0, 0, 48),
    (9, 0, 1, 48),
    (9, 0, 2, 49),
    (9, 0, 3, 49),
    (9, 0, 4, 50),
    (9, 0, 5, 50),
    (9, 0, 6, 51),
    (9, 1, 0, 48),
    (9, 1, 1, 48),
    (9, 1, 2, 49),
    (9, 1, 3, 49),
    (9, 1, 4, 50),
    (9, 1, 5, 50),
    (9, 1, 6, 51),
    (9, 2, 0, 54),
    (9, 2, 1, 54),
    (9, 2, 2, 54),
    (9, 2, 3, 54),
    (9, 2, 4, 54),
    (9, 2, 5, 54),
    (9, 2, 6, 54),
    (9, 3, 0, 52),
    (9, 3, 1, 52),
    (9, 3, 2, 53),
    (9, 3, 3, 53),
    (9, 3, 4, 53),
    (9, 3, 5, 56),
    (9, 3, 6, 56),
    (9, 4, 0, 55),
    (9, 4, 1, 55),
    (9, 4, 2, 55),
    (9, 4, 3, 55),
    (9, 4, 4, 55),
    (9, 4, 5, 55),
    (9, 4, 6, 55),
    (10, 0, 0, 57),
    (10, 0, 1, 58),
    (10, 0, 2, 59),
    (10, 0, 3, 60),
    (10, 0, 4, 61),
    (10, 0, 5, 62),
    (10, 1, 0, 63),
    (10, 1, 1, 63),
    (10, 1, 2, 63),
    (10, 1, 3, 63),
    (10, 1, 4, 63),
    (10, 1, 5, 63),
    (10, 2, 0, 64),
    (10, 2, 1, 64),
    (10, 2, 2, 63),
    (10, 2, 3, 63),
    (10, 2, 4, 63),
    (10, 2, 5, 63),
    (11, 0, 0, 66),
    (11, 0, 1, 66),
    (11, 0, 2, 67),
    (11, 0, 3, 67),
    (11, 1, 0, 67),
    (11, 1, 1, 67),
    (11, 1, 2, 67),
    (11, 1, 3, 67),
    (11, 2, 0, 67),
    (11, 2, 1, 67),
    (11, 2, 2, 67),
    (11, 2, 3, 67),
    (12, 0, 0, 68),
    (12, 0, 1, 68),
    (12, 1, 0, 68),
    (12, 1, 1, 68),
    (12, 2, 0, 69),
    (12, 2, 1, 69),
    (12, 2, 2, 69),
    (12, 2, 3, 69),
    (13, 0, 0, 70),
    (13, 0, 1, 70),
    (13, 0, 2, 71),
    (13, 0, 3, 71),
    (13, 0, 4, 72),
    (13, 0, 5, 72),
    (13, 1, 0, 70),
    (13, 1, 1, 70),
    (13, 1, 2, 71),
    (13, 1, 3, 71),
    (13, 1, 4, 72),
    (13, 1, 5, 72),
    (13, 2, 0, 74),
    (13, 2, 1, 74),
    (13, 2, 2, 74),
    (13, 2, 3, 74),
    (13, 2, 4, 74),
    (13, 2, 5, 74),
    (13, 3, 0, 73),
    (13, 3, 1, 73),
    (13, 3, 2, 73),
    (13, 3, 3, 75),
    (13, 3, 4, 75),
    (13, 3, 5, 75),
    (14, 0, 0, 76),
    (14, 0, 1, 77),
    (14, 0, 2, 78),
    (14, 0, 3, 79),
    (14, 0, 4, 80),
    (14, 0, 5, 81),
    (14, 1, 0, 82),
    (14, 1, 1, 82),
    (14, 1, 2, 82),
    (14, 1, 3, 82),
    (14, 1, 4, 82),
    (14, 1, 5, 82),
    (14, 2, 0, 83),
    (14, 2, 1, 83),
    (14, 2, 2, 84),
    (14, 2, 3, 84),
    (14, 2, 4, 82),
    (14, 2, 5, 82),
    (15, 0, 0, 85),
    (15, 0, 1, 85),
    (15, 0, 2, 85),
    (15, 0, 3, 86),
    (15, 0, 4, 86),
    (15, 1, 0, 85),
    (15, 1, 1, 85),
    (15, 1, 2, 85),
    (15, 1, 3, 86),
    (15, 1, 4, 86),
    (15, 2, 0, 87),
    (15, 2, 1, 87),
    (15, 2, 2, 88),
    (15, 2, 3, 89),
    (15, 2, 4, 89),
    (16, 0, 0, 90),
    (16, 0, 1, 90),
    (16, 1, 0, 90),
    (16, 1, 1, 90),
    (16, 2, 0, 91),
    (16, 2, 1, 91),
    (16, 2, 2, 91),
    (16, 2, 3, 91),
    (16, 2, 4, 91);

INSERT INTO edge_overrides (property_id, row_idx, col_idx, orientation, edge_type) VALUES
    (6, 2, 0, 'HORIZONTAL', 'DOOR'),
    (6, 2, 2, 'HORIZONTAL', 'DOOR'),
    (6, 2, 4, 'HORIZONTAL', 'DOOR'),
    (6, 2, 6, 'HORIZONTAL', 'DOOR'),
    (6, 0, 0, 'HORIZONTAL', 'WINDOW'),
    (6, 0, 2, 'HORIZONTAL', 'WINDOW'),
    (7, 2, 0, 'HORIZONTAL', 'DOOR'),
    (7, 2, 2, 'HORIZONTAL', 'DOOR'),
    (7, 3, 0, 'HORIZONTAL', 'DOOR'),
    (7, 0, 4, 'HORIZONTAL', 'WINDOW'),
    (8, 2, 0, 'HORIZONTAL', 'DOOR'),
    (8, 2, 2, 'HORIZONTAL', 'DOOR'),
    (8, 2, 4, 'HORIZONTAL', 'DOOR'),
    (8, 2, 6, 'HORIZONTAL', 'DOOR'),
    (8, 3, 0, 'HORIZONTAL', 'WALL'),
    (9, 2, 0, 'HORIZONTAL', 'DOOR'),
    (9, 2, 2, 'HORIZONTAL', 'DOOR'),
    (9, 2, 4, 'HORIZONTAL', 'DOOR'),
    (9, 2, 6, 'HORIZONTAL', 'DOOR'),
    (9, 3, 2, 'HORIZONTAL', 'OPEN'),
    (10, 2, 0, 'HORIZONTAL', 'DOOR'),
    (12, 0, 0, 'HORIZONTAL', 'WINDOW'),
    (13, 2, 0, 'HORIZONTAL', 'DOOR'),
    (13, 2, 2, 'HORIZONTAL', 'DOOR'),
    (13, 2, 4, 'HORIZONTAL', 'DOOR'),
    (14, 2, 0, 'HORIZONTAL', 'DOOR'),
    (14, 2, 2, 'HORIZONTAL', 'DOOR');

INSERT INTO lease_contracts (id, rentable_unit_id, renter_id, previous_lease_id, start_date, end_date,
                             monthly_rent, payment_terms, tenant_name, tenant_email, tenant_phone, status,
                             closed_on, termination_reason, released_on, ended_automatically) VALUES
    (6, 21, 9, NULL, '2025-03-01', '2026-02-28', 13500.00, 'MONTHLY_ADVANCE', 'Jasmine Ocampo', 'jasmine.ocampo@example.com', '+63 917 555 0211', 'RENEWED', '2026-02-28', NULL, NULL, 0),
    (7, 21, 9, 6, '2026-03-01', '2027-02-28', 14500.00, 'MONTHLY_ADVANCE', 'Jasmine Ocampo', 'jasmine.ocampo@example.com', '+63 917 555 0211', 'ACTIVE', NULL, NULL, NULL, 0),
    (8, 33, 9, NULL, '2025-11-20', '2026-11-19', 18000.00, 'MONTHLY_ADVANCE', 'Jasmine Ocampo', 'jasmine.ocampo@example.com', '+63 917 555 0211', 'ACTIVE', NULL, NULL, NULL, 0),
    (9, 42, 9, NULL, '2025-10-29', '2026-10-28', 15500.00, 'MONTHLY_ADVANCE', 'Jasmine Ocampo', 'jasmine.ocampo@example.com', '+63 917 555 0211', 'ACTIVE', NULL, NULL, NULL, 0),
    (10, 70, 9, NULL, '2025-01-01', '2025-12-31', 24000.00, 'MONTHLY_ADVANCE', 'Jasmine Ocampo', 'jasmine.ocampo@example.com', '+63 917 555 0211', 'ENDED', '2025-12-31', NULL, '2025-12-31', 0),
    (11, 49, 9, NULL, '2026-02-01', '2027-01-31', 20000.00, 'MONTHLY_ADVANCE', 'Jasmine Ocampo', 'jasmine.ocampo@example.com', '+63 917 555 0211', 'TERMINATED', '2026-09-15', 'Repeated late payments and an unauthorized sublease.', '2026-09-30', 0),
    (12, 24, 9, NULL, '2026-12-01', '2027-11-30', 11500.00, 'MONTHLY_ADVANCE', 'Jasmine Ocampo', 'jasmine.ocampo@example.com', '+63 917 555 0211', 'ACTIVE', NULL, NULL, NULL, 0),
    (13, 43, 10, NULL, '2026-07-01', '2027-06-30', 16000.00, 'QUARTERLY_ADVANCE', 'Carlo Abellana', 'carlo.abellana@example.com', '+63 917 555 0212', 'ACTIVE', NULL, NULL, NULL, 0),
    (14, 76, 10, NULL, '2026-09-01', '2027-02-28', 5500.00, 'MONTHLY_ARREARS', 'Carlo Abellana', 'carlo.abellana@example.com', '+63 917 555 0212', 'ACTIVE', NULL, NULL, NULL, 0),
    (15, 45, 11, NULL, '2025-03-01', '2026-02-28', 9000.00, 'MONTHLY_ADVANCE', 'Marites Lumbay', 'marites.lumbay@example.com', '+63 917 555 0213', 'RENEWED', '2026-02-28', NULL, NULL, 0),
    (16, 45, 11, 15, '2026-03-01', '2026-08-31', 9500.00, 'MONTHLY_ADVANCE', 'Marites Lumbay', 'marites.lumbay@example.com', '+63 917 555 0213', 'RENEWED', '2026-08-31', NULL, NULL, 0),
    (17, 45, 11, 16, '2026-09-01', '2027-02-28', 10000.00, 'SEMI_ANNUAL_ADVANCE', 'Marites Lumbay', 'marites.lumbay@example.com', '+63 917 555 0213', 'ACTIVE', NULL, NULL, NULL, 0),
    (18, 50, 11, NULL, '2026-01-15', '2027-01-14', 21000.00, 'MONTHLY_ADVANCE', 'Marites Lumbay', 'marites.lumbay@example.com', '+63 917 555 0213', 'TERMINATED', '2026-10-20', 'Tenant left the shop and stopped paying.', NULL, 0),
    (19, 71, 11, NULL, '2025-11-01', '2026-10-27', 24000.00, 'MONTHLY_ADVANCE', 'Marites Lumbay', 'marites.lumbay@example.com', '+63 917 555 0213', 'ENDED', '2026-10-27', NULL, NULL, 1),
    (21, 65, 9, NULL, '2025-02-01', '2025-12-31', 5000.00, 'ANNUAL_ADVANCE', 'Jasmine Ocampo', 'jasmine.ocampo@example.com', '+63 917 555 0211', 'ENDED', '2025-12-31', NULL, '2025-12-31', 0);

INSERT INTO payments (id, lease_id, renter_id, billing_month, amount, method, status, reference_no, paid_at) VALUES
    (40, 6, 9, '2025-03-01', 13500.00, 'GCASH', 'PAID', 'SG-20250228-0039', '2025-02-28 10:15:00'),
    (41, 6, 9, '2025-04-01', 13500.00, 'GCASH', 'PAID', 'SG-20250331-0040', '2025-03-31 10:15:00'),
    (42, 6, 9, '2025-05-01', 13500.00, 'GCASH', 'PAID', 'SG-20250430-0041', '2025-04-30 10:15:00'),
    (43, 6, 9, '2025-06-01', 13500.00, 'GCASH', 'PAID', 'SG-20250531-0042', '2025-05-31 10:15:00'),
    (44, 6, 9, '2025-07-01', 13500.00, 'GCASH', 'PAID', 'SG-20250630-0043', '2025-06-30 10:15:00'),
    (45, 6, 9, '2025-08-01', 13500.00, 'GCASH', 'PAID', 'SG-20250731-0044', '2025-07-31 10:15:00'),
    (46, 6, 9, '2025-09-01', 13500.00, 'GCASH', 'PAID', 'SG-20250831-0045', '2025-08-31 10:15:00'),
    (47, 6, 9, '2025-10-01', 13500.00, 'GCASH', 'PAID', 'SG-20250930-0046', '2025-09-30 10:15:00'),
    (48, 6, 9, '2025-11-01', 13500.00, 'GCASH', 'PAID', 'SG-20251031-0047', '2025-10-31 10:15:00'),
    (49, 6, 9, '2025-12-01', 13500.00, 'GCASH', 'PAID', 'SG-20251130-0048', '2025-11-30 10:15:00'),
    (50, 6, 9, '2026-01-01', 13500.00, 'GCASH', 'PAID', 'SG-20251231-0049', '2025-12-31 10:15:00'),
    (51, 6, 9, '2026-02-01', 13500.00, 'GCASH', 'PAID', 'SG-20260131-0050', '2026-01-31 10:15:00'),
    (52, 7, 9, '2026-03-01', 14500.00, 'MAYA', 'PAID', 'SG-20260228-0051', '2026-02-28 10:15:00'),
    (53, 7, 9, '2026-04-01', 14500.00, 'MAYA', 'PAID', 'SG-20260331-0052', '2026-03-31 10:15:00'),
    (54, 7, 9, '2026-05-01', 14500.00, 'CARD', 'FAILED', NULL, NULL),
    (55, 7, 9, '2026-05-01', 14500.00, 'MAYA', 'PAID', 'SG-20260430-0053', '2026-04-30 10:15:00'),
    (56, 7, 9, '2026-06-01', 14500.00, 'MAYA', 'PAID', 'SG-20260531-0054', '2026-05-31 10:15:00'),
    (57, 7, 9, '2026-07-01', 14500.00, 'MAYA', 'PAID', 'SG-20260630-0055', '2026-06-30 10:15:00'),
    (58, 7, 9, '2026-08-01', 14500.00, 'MAYA', 'PAID', 'SG-20260731-0056', '2026-07-31 10:15:00'),
    (59, 7, 9, '2026-09-01', 14500.00, 'MAYA', 'PAID', 'SG-20260831-0057', '2026-08-31 10:15:00'),
    (60, 7, 9, '2026-10-01', 14500.00, 'MAYA', 'PAID', 'SG-20260930-0058', '2026-09-30 10:15:00'),
    (61, 8, 9, '2025-11-01', 18000.00, 'CARD', 'PAID', 'SG-20251119-0059', '2025-11-19 10:15:00'),
    (62, 8, 9, '2025-12-01', 18000.00, 'CARD', 'PAID', 'SG-20251219-0060', '2025-12-19 10:15:00'),
    (63, 8, 9, '2026-01-01', 18000.00, 'CARD', 'PAID', 'SG-20260119-0061', '2026-01-19 10:15:00'),
    (64, 8, 9, '2026-02-01', 18000.00, 'CARD', 'PAID', 'SG-20260219-0062', '2026-02-19 10:15:00'),
    (65, 8, 9, '2026-03-01', 18000.00, 'CARD', 'PAID', 'SG-20260319-0063', '2026-03-19 10:15:00'),
    (66, 8, 9, '2026-04-01', 18000.00, 'CARD', 'PAID', 'SG-20260419-0064', '2026-04-19 10:15:00'),
    (67, 8, 9, '2026-05-01', 18000.00, 'CARD', 'PAID', 'SG-20260519-0065', '2026-05-19 10:15:00'),
    (68, 8, 9, '2026-06-01', 18000.00, 'CARD', 'PAID', 'SG-20260619-0066', '2026-06-19 10:15:00'),
    (69, 8, 9, '2026-07-01', 18000.00, 'CARD', 'PAID', 'SG-20260719-0067', '2026-07-19 10:15:00'),
    (70, 8, 9, '2026-08-01', 18000.00, 'CARD', 'PAID', 'SG-20260819-0068', '2026-08-19 10:15:00'),
    (71, 8, 9, '2026-09-01', 18000.00, 'CARD', 'PAID', 'SG-20260919-0069', '2026-09-19 10:15:00'),
    (72, 8, 9, '2026-10-01', 18000.00, 'CARD', 'PAID', 'SG-20261019-0070', '2026-10-19 10:15:00'),
    (73, 8, 9, '2026-11-01', 18000.00, 'GCASH', 'PENDING', NULL, NULL),
    (74, 9, 9, '2025-10-01', 15500.00, 'MAYA', 'PAID', 'SG-20251028-0071', '2025-10-28 10:15:00'),
    (75, 9, 9, '2025-11-01', 15500.00, 'MAYA', 'PAID', 'SG-20251128-0072', '2025-11-28 10:15:00'),
    (76, 9, 9, '2025-12-01', 15500.00, 'MAYA', 'PAID', 'SG-20251228-0073', '2025-12-28 10:15:00'),
    (77, 9, 9, '2026-01-01', 15500.00, 'MAYA', 'PAID', 'SG-20260128-0074', '2026-01-28 10:15:00'),
    (78, 9, 9, '2026-02-01', 15500.00, 'MAYA', 'PAID', 'SG-20260227-0075', '2026-02-27 10:15:00'),
    (79, 9, 9, '2026-03-01', 15500.00, 'MAYA', 'PAID', 'SG-20260328-0076', '2026-03-28 10:15:00'),
    (80, 9, 9, '2026-04-01', 15500.00, 'MAYA', 'PAID', 'SG-20260428-0077', '2026-04-28 10:15:00'),
    (81, 9, 9, '2026-05-01', 15500.00, 'MAYA', 'PAID', 'SG-20260528-0078', '2026-05-28 10:15:00'),
    (82, 9, 9, '2026-06-01', 15500.00, 'MAYA', 'PAID', 'SG-20260628-0079', '2026-06-28 10:15:00'),
    (83, 9, 9, '2026-07-01', 15500.00, 'MAYA', 'PAID', 'SG-20260728-0080', '2026-07-28 10:15:00'),
    (84, 9, 9, '2026-08-01', 15500.00, 'MAYA', 'PAID', 'SG-20260828-0081', '2026-08-28 10:15:00'),
    (85, 9, 9, '2026-09-01', 15500.00, 'MAYA', 'PAID', 'SG-20260928-0082', '2026-09-28 10:15:00'),
    (86, 10, 9, '2025-01-01', 24000.00, 'GCASH', 'PAID', 'SG-20241231-0083', '2024-12-31 10:15:00'),
    (87, 10, 9, '2025-02-01', 24000.00, 'MAYA', 'PAID', 'SG-20250131-0084', '2025-01-31 10:15:00'),
    (88, 10, 9, '2025-03-01', 24000.00, 'CARD', 'PAID', 'SG-20250228-0085', '2025-02-28 10:15:00'),
    (89, 10, 9, '2025-04-01', 24000.00, 'GCASH', 'PAID', 'SG-20250331-0086', '2025-03-31 10:15:00'),
    (90, 10, 9, '2025-05-01', 24000.00, 'MAYA', 'PAID', 'SG-20250430-0087', '2025-04-30 10:15:00'),
    (91, 10, 9, '2025-06-01', 24000.00, 'CARD', 'PAID', 'SG-20250531-0088', '2025-05-31 10:15:00'),
    (92, 10, 9, '2025-07-01', 24000.00, 'GCASH', 'PAID', 'SG-20250630-0089', '2025-06-30 10:15:00'),
    (93, 10, 9, '2025-08-01', 24000.00, 'MAYA', 'PAID', 'SG-20250731-0090', '2025-07-31 10:15:00'),
    (94, 10, 9, '2025-09-01', 24000.00, 'CARD', 'PAID', 'SG-20250831-0091', '2025-08-31 10:15:00'),
    (95, 10, 9, '2025-10-01', 24000.00, 'GCASH', 'PAID', 'SG-20250930-0092', '2025-09-30 10:15:00'),
    (96, 10, 9, '2025-11-01', 24000.00, 'MAYA', 'PAID', 'SG-20251031-0093', '2025-10-31 10:15:00'),
    (97, 10, 9, '2025-12-01', 24000.00, 'CARD', 'PAID', 'SG-20251130-0094', '2025-11-30 10:15:00'),
    (98, 11, 9, '2026-02-01', 20000.00, 'GCASH', 'PAID', 'SG-20260131-0095', '2026-01-31 10:15:00'),
    (99, 11, 9, '2026-03-01', 20000.00, 'GCASH', 'PAID', 'SG-20260228-0096', '2026-02-28 10:15:00'),
    (100, 11, 9, '2026-04-01', 20000.00, 'GCASH', 'PAID', 'SG-20260331-0097', '2026-03-31 10:15:00'),
    (101, 11, 9, '2026-05-01', 20000.00, 'GCASH', 'PAID', 'SG-20260430-0098', '2026-04-30 10:15:00'),
    (102, 11, 9, '2026-06-01', 20000.00, 'GCASH', 'PAID', 'SG-20260531-0099', '2026-05-31 10:15:00'),
    (103, 11, 9, '2026-07-01', 20000.00, 'GCASH', 'PAID', 'SG-20260630-0100', '2026-06-30 10:15:00'),
    (104, 11, 9, '2026-08-01', 20000.00, 'GCASH', 'PAID', 'SG-20260731-0101', '2026-07-31 10:15:00'),
    (105, 11, 9, '2026-09-01', 20000.00, 'CARD', 'FAILED', NULL, NULL),
    (106, 13, 10, '2026-07-01', 48000.00, 'GCASH', 'PAID', 'SG-20260630-0102', '2026-06-30 10:15:00'),
    (107, 13, 10, '2026-10-01', 48000.00, 'CARD', 'PAID', 'SG-20260925-0103', '2026-09-25 10:15:00'),
    (108, 15, 11, '2025-03-01', 9000.00, 'MAYA', 'PAID', 'SG-20250228-0104', '2025-02-28 10:15:00'),
    (109, 15, 11, '2025-04-01', 9000.00, 'MAYA', 'PAID', 'SG-20250331-0105', '2025-03-31 10:15:00'),
    (110, 15, 11, '2025-05-01', 9000.00, 'MAYA', 'PAID', 'SG-20250430-0106', '2025-04-30 10:15:00'),
    (111, 15, 11, '2025-06-01', 9000.00, 'MAYA', 'PAID', 'SG-20250531-0107', '2025-05-31 10:15:00'),
    (112, 15, 11, '2025-07-01', 9000.00, 'MAYA', 'PAID', 'SG-20250630-0108', '2025-06-30 10:15:00'),
    (113, 15, 11, '2025-08-01', 9000.00, 'MAYA', 'PAID', 'SG-20250731-0109', '2025-07-31 10:15:00'),
    (114, 15, 11, '2025-09-01', 9000.00, 'MAYA', 'PAID', 'SG-20250831-0110', '2025-08-31 10:15:00'),
    (115, 15, 11, '2025-10-01', 9000.00, 'MAYA', 'PAID', 'SG-20250930-0111', '2025-09-30 10:15:00'),
    (116, 15, 11, '2025-11-01', 9000.00, 'MAYA', 'PAID', 'SG-20251031-0112', '2025-10-31 10:15:00'),
    (117, 15, 11, '2025-12-01', 9000.00, 'MAYA', 'PAID', 'SG-20251130-0113', '2025-11-30 10:15:00'),
    (118, 15, 11, '2026-01-01', 9000.00, 'MAYA', 'PAID', 'SG-20251231-0114', '2025-12-31 10:15:00'),
    (119, 15, 11, '2026-02-01', 9000.00, 'MAYA', 'PAID', 'SG-20260131-0115', '2026-01-31 10:15:00'),
    (120, 16, 11, '2026-03-01', 9500.00, 'MAYA', 'PAID', 'SG-20260228-0116', '2026-02-28 10:15:00'),
    (121, 16, 11, '2026-04-01', 9500.00, 'MAYA', 'PAID', 'SG-20260331-0117', '2026-03-31 10:15:00'),
    (122, 16, 11, '2026-05-01', 9500.00, 'MAYA', 'PAID', 'SG-20260430-0118', '2026-04-30 10:15:00'),
    (123, 16, 11, '2026-06-01', 9500.00, 'MAYA', 'PAID', 'SG-20260531-0119', '2026-05-31 10:15:00'),
    (124, 16, 11, '2026-07-01', 9500.00, 'MAYA', 'PAID', 'SG-20260630-0120', '2026-06-30 10:15:00'),
    (125, 16, 11, '2026-08-01', 9500.00, 'MAYA', 'PAID', 'SG-20260731-0121', '2026-07-31 10:15:00'),
    (126, 17, 11, '2026-09-01', 60000.00, 'MAYA', 'PAID', 'SG-20260831-0122', '2026-08-31 10:15:00'),
    (127, 18, 11, '2026-01-01', 21000.00, 'GCASH', 'PAID', 'SG-20260114-0123', '2026-01-14 10:15:00'),
    (128, 18, 11, '2026-02-01', 21000.00, 'GCASH', 'PAID', 'SG-20260214-0124', '2026-02-14 10:15:00'),
    (129, 18, 11, '2026-03-01', 21000.00, 'GCASH', 'PAID', 'SG-20260314-0125', '2026-03-14 10:15:00'),
    (130, 18, 11, '2026-04-01', 21000.00, 'GCASH', 'PAID', 'SG-20260414-0126', '2026-04-14 10:15:00'),
    (131, 18, 11, '2026-05-01', 21000.00, 'GCASH', 'PAID', 'SG-20260514-0127', '2026-05-14 10:15:00'),
    (132, 18, 11, '2026-06-01', 21000.00, 'GCASH', 'PAID', 'SG-20260614-0128', '2026-06-14 10:15:00'),
    (133, 18, 11, '2026-07-01', 21000.00, 'GCASH', 'PAID', 'SG-20260714-0129', '2026-07-14 10:15:00'),
    (134, 18, 11, '2026-08-01', 21000.00, 'GCASH', 'PAID', 'SG-20260814-0130', '2026-08-14 10:15:00'),
    (135, 19, 11, '2025-11-01', 24000.00, 'GCASH', 'PAID', 'SG-20251031-0131', '2025-10-31 10:15:00'),
    (136, 19, 11, '2025-12-01', 24000.00, 'GCASH', 'PAID', 'SG-20251130-0132', '2025-11-30 10:15:00'),
    (137, 19, 11, '2026-01-01', 24000.00, 'GCASH', 'PAID', 'SG-20251231-0133', '2025-12-31 10:15:00'),
    (138, 19, 11, '2026-02-01', 24000.00, 'GCASH', 'PAID', 'SG-20260131-0134', '2026-01-31 10:15:00'),
    (139, 19, 11, '2026-03-01', 24000.00, 'GCASH', 'PAID', 'SG-20260228-0135', '2026-02-28 10:15:00'),
    (140, 19, 11, '2026-04-01', 24000.00, 'GCASH', 'PAID', 'SG-20260331-0136', '2026-03-31 10:15:00'),
    (141, 19, 11, '2026-05-01', 24000.00, 'GCASH', 'PAID', 'SG-20260430-0137', '2026-04-30 10:15:00'),
    (142, 19, 11, '2026-06-01', 24000.00, 'GCASH', 'PAID', 'SG-20260531-0138', '2026-05-31 10:15:00'),
    (143, 19, 11, '2026-07-01', 24000.00, 'GCASH', 'PAID', 'SG-20260630-0139', '2026-06-30 10:15:00'),
    (144, 19, 11, '2026-08-01', 24000.00, 'GCASH', 'PAID', 'SG-20260731-0140', '2026-07-31 10:15:00'),
    (145, 19, 11, '2026-09-01', 24000.00, 'GCASH', 'PAID', 'SG-20260831-0141', '2026-08-31 10:15:00'),
    (146, 21, 9, '2025-02-01', 55000.00, 'CARD', 'PAID', 'SG-20250131-0142', '2025-01-31 10:15:00');

INSERT INTO lease_requests (id, rentable_unit_id, unit_label, property_label, renter_id, desired_start, months, message, status, decided_at) VALUES
    (5, 22, 'A102', 'Lanang Bayview Apartments', 9, '2026-12-15', 12, 'Looking for a one-bedroom close to my workplace.', 'PENDING', NULL),
    (6, 72, 'Shop C', 'Matina Town Center Shops', 9, '2026-11-20', 12, 'Opening a small bakery.', 'APPROVED', '2026-10-27 15:00:00'),
    (7, 3, 'Unit 103', 'SpaceGrid Suites Bajada', 9, '2026-11-01', 6, 'A studio for six months while my house is repaired.', 'DECLINED', '2026-10-10 09:30:00'),
    (8, 15, 'Booth 2', 'Roxas Night Market - Section C', 9, '2026-11-15', 3, 'Weekend booth for the holiday season.', 'CANCELLED', '2026-10-12 18:00:00'),
    (9, 34, '5B', 'Ecoland Garden Condominium', 10, '2027-01-01', 12, 'Moving closer to the university.', 'PENDING', NULL),
    (10, 77, 'Booth 2', 'Magallanes Street Night Food Market', 11, '2026-12-01', 6, 'Selling grilled snacks in the evening.', 'PENDING', NULL),
    (11, 12, 'Stall 2', 'Agdao Market Stalls', 12, '2026-12-01', 6, 'Selling dried fish and snacks.', 'PENDING', NULL),
    (12, 62, 'Stall N6', 'Toril Weekend Night Bazaar', 12, '2026-11-15', 3, NULL, 'PENDING', NULL),
    (13, 37, '6A', 'Ecoland Garden Condominium', 12, '2026-11-01', 12, 'Family of three, need two rooms.', 'DECLINED', '2026-10-05 11:00:00'),
    (14, 85, 'Plot 1', 'Davao Riverside Events Lawn', 12, '2026-11-10', 1, 'Birthday event with about 80 guests.', 'DECLINED', '2026-10-18 10:15:00'),
    (15, NULL, 'Stall N7', 'Toril Weekend Night Bazaar', 10, '2026-10-01', 3, 'Selling handmade crafts.', 'DECLINED', '2026-09-20 14:00:00');
