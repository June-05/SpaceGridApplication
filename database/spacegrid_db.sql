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
    address           VARCHAR(255)  NOT NULL,
    property_type     VARCHAR(20)   NOT NULL,
    description       TEXT          NULL,
    is_exact_size     BOOLEAN       NULL,                  -- NULL = no size given
    size_description  VARCHAR(100)  NULL,                  -- used when is_exact_size = FALSE
    area_sqm          DECIMAL(10,2) NULL,                  -- used when is_exact_size = TRUE
    status            VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    grid_rows         TINYINT       NOT NULL DEFAULT 1,
    grid_columns      TINYINT       NOT NULL DEFAULT 1,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_properties PRIMARY KEY (id),
    CONSTRAINT fk_properties_landlord FOREIGN KEY (landlord_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_properties_type   CHECK (property_type IN ('APARTMENT', 'CONDOMINIUM', 'TOWNHOUSE', 'COMMERCIAL')),
    CONSTRAINT ck_properties_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_properties_rows   CHECK (grid_rows BETWEEN 1 AND 30),
    CONSTRAINT ck_properties_cols   CHECK (grid_columns BETWEEN 1 AND 30),
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
    CONSTRAINT pk_common_areas PRIMARY KEY (zone_id),
    CONSTRAINT fk_common_areas_zone FOREIGN KEY (zone_id) REFERENCES grid_zones (id)
        ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT ck_common_areas_type CHECK (area_type IN
        ('WALKWAY', 'GRASS', 'BATHROOM', 'KITCHEN', 'LAUNDRY', 'LOBBY', 'PARKING', 'STAIRS'))
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
    CONSTRAINT ck_zone_cells_row CHECK (row_idx BETWEEN 0 AND 29),
    CONSTRAINT ck_zone_cells_col CHECK (col_idx BETWEEN 0 AND 29)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 7. edge_overrides  (Java: Property.edgeOverrides  Map<GridEdge, EdgeType>)
--    Only manual changes are stored; automatic walls are calculated in Java.
--    HORIZONTAL (r, c) = line ABOVE spot (r, c)   rows 0..30 (30 = bottom border)
--    VERTICAL   (r, c) = line LEFT OF spot (r, c) cols 0..30 (30 = right border)
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
    CONSTRAINT ck_edge_overrides_row         CHECK (row_idx BETWEEN 0 AND 30),
    CONSTRAINT ck_edge_overrides_col         CHECK (col_idx BETWEEN 0 AND 30),
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
    status             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    closed_on          DATE          NULL,                 -- date it actually ended / was terminated / renewed
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
    CONSTRAINT ck_lease_contracts_closed CHECK (
        (status = 'ACTIVE' AND closed_on IS NULL) OR (status <> 'ACTIVE' AND closed_on IS NOT NULL))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 9. payments  (Java: Payment; billing_month = YearMonth stored as the 1st of the month)
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
-- View used by JdbcLeaseContractDao: lease + the display names
-- (LeaseContract.unitName / propertyName / renterName) and the landlord id.
-- ---------------------------------------------------------------------
CREATE VIEW lease_details AS
SELECT  l.id, l.rentable_unit_id, l.renter_id, l.previous_lease_id,
        l.start_date, l.end_date, l.monthly_rent, l.status, l.closed_on, l.created_at,
        z.name        AS unit_name,
        p.id          AS property_id,
        p.name        AS property_name,
        p.landlord_id AS landlord_id,
        u.full_name   AS renter_name
FROM    lease_contracts l
JOIN    grid_zones  z ON z.id = l.rentable_unit_id
JOIN    properties  p ON p.id = z.property_id
JOIN    users       u ON u.id = l.renter_id;

-- =====================================================================
--  SAMPLE DATA  (today in the story: late October 2026)
-- =====================================================================

INSERT INTO users (id, username, password_hash, full_name, role) VALUES
    (1, 'maria.santos', '$2a$10$xa6bk8SrcyVlZBTkbUZhaedvRDXVzirEaSAB0MEbzEeHZLo.PCluy', 'Maria Santos', 'LANDLORD'),
    (2, 'jose.reyes', '$2a$10$UetlukyMfYqTVbQqKT61b.HgkuA6b4wfZPJvNATXQc8FBkAGO02T.', 'Jose Reyes', 'LANDLORD'),
    (3, 'ana.cruz', '$2a$10$DZM1gRWmxi6JAteggmCKGOBxZMR.Nj1NQaSAU7.dVwvzQafroIQuG', 'Ana Cruz', 'RENTER'),
    (4, 'paolo.garcia', '$2a$10$QkRkiHaHZpflgYT0WkOVhuISlYhhGCeC2t9ScDzWRnrv2xRsoXUNK', 'Paolo Garcia', 'RENTER'),
    (5, 'liza.mendoza', '$2a$10$ea1UwbTp0KqG6U0SD6VY4.TsfDn1hLQ42/jNonDQi9r3Qsffr86P.', 'Liza Mendoza', 'RENTER');

INSERT INTO properties (id, landlord_id, name, address, property_type, description,
                        is_exact_size, size_description, area_sqm, status, grid_rows, grid_columns) VALUES
    (1, 1, 'SpaceGrid Suites Bajada', 'J.P. Laurel Ave, Bajada, Davao City', 'APARTMENT', 'Two-floor apartment near Victoria Plaza with a shared garden.', 1, NULL, 180.00, 'ACTIVE', 4, 6),
    (2, 1, 'Matina Enclave Residences', 'MacArthur Highway, Matina, Davao City', 'CONDOMINIUM', 'Condo floor still being set up.', 0, 'Half-floor', NULL, 'DRAFT', 3, 3),
    (3, 2, 'Agdao Market Stalls', 'Lapu-Lapu St, Agdao, Davao City', 'COMMERCIAL', 'Ground-floor stalls with customer parking.', 1, NULL, 96.00, 'ACTIVE', 2, 4);

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
    (13, 3, 'COMMON', 'Parking');

INSERT INTO rentable_units (zone_id, rental_rate, is_exact_size, size_description, area_sqm,
                            includes_electricity, includes_water, status) VALUES
    (1, 12000.00, 1, NULL, 36.00, 1, 1, 'OCCUPIED'),
    (2, 12500.00, 1, NULL, 36.00, 1, 1, 'OCCUPIED'),
    (3, 9800.00, 0, 'Studio-size', NULL, 0, 1, 'AVAILABLE'),
    (6, 8500.00, 1, NULL, 18.00, 0, 0, 'UNDER_MAINTENANCE'),
    (8, 7000.00, NULL, NULL, NULL, 0, 0, 'ARCHIVED'),
    (9, 15000.00, 1, NULL, 40.00, 1, 1, 'AVAILABLE'),
    (11, 6000.00, 1, NULL, 12.00, 1, 0, 'OCCUPIED'),
    (12, 6000.00, 1, NULL, 12.00, 1, 0, 'AVAILABLE');

INSERT INTO common_areas (zone_id, area_type) VALUES
    (4, 'WALKWAY'),
    (5, 'BATHROOM'),
    (7, 'GRASS'),
    (10, 'LOBBY'),
    (13, 'PARKING');

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
    (3, 1, 3, 13);

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
                             monthly_rent, status, closed_on) VALUES
    (1, 1, 3, NULL, '2026-06-01', '2027-05-31', 12000.00, 'ACTIVE', NULL),
    (2, 2, 4, NULL, '2025-05-01', '2026-04-30', 12000.00, 'RENEWED', '2026-04-30'),
    (3, 2, 4, 2, '2026-05-01', '2026-11-15', 12500.00, 'ACTIVE', NULL),
    (4, 8, 5, NULL, '2025-01-01', '2025-12-31', 7000.00, 'ENDED', '2025-12-31'),
    (5, 11, 5, NULL, '2026-08-01', '2027-07-31', 6000.00, 'ACTIVE', NULL);

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
