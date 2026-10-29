package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.dao.LeaseRequestDao;
import com.techhub.spacegridapplication.dao.RentableUnitDao;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.NotFoundException;
import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.FileKind;
import com.techhub.spacegridapplication.model.LeaseContract;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.RentableUnit;
import com.techhub.spacegridapplication.model.UnitDetails;
import com.techhub.spacegridapplication.model.UnitRemovalCheck;
import com.techhub.spacegridapplication.model.UnitStatus;
import com.techhub.spacegridapplication.model.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/** Units of a property. */
@Service
public class RentableUnitService {

    private final RentableUnitDao unitDao;
    private final LeaseContractDao leaseDao;
    private final LeaseRequestDao leaseRequestDao;
    private final PropertyService propertyService;
    private final FileService fileService;

    public RentableUnitService(
            RentableUnitDao unitDao,
            LeaseContractDao leaseDao,
            LeaseRequestDao leaseRequestDao,
            PropertyService propertyService,
            FileService fileService) {
        this.unitDao = unitDao;
        this.leaseDao = leaseDao;
        this.leaseRequestDao = leaseRequestDao;
        this.propertyService = propertyService;
        this.fileService = fileService;
    }

    /** The property's units, without archived ones (they left the grid and the lists; their history stays). */
    public List<RentableUnit> getUnits(int propertyId, User landlord) {
        propertyService.getOwnedProperty(propertyId, landlord);
        return unitDao.findByPropertyId(propertyId).stream()
                .filter(unit -> !unit.isArchived())
                .toList();
    }

    @Transactional
    public RentableUnit addUnit(
            int propertyId,
            User landlord,
            String name,
            BigDecimal rentalRate,
            Dimensions dimensions,
            boolean electricity,
            boolean water) {
        Property property = propertyService.getOwnedProperty(propertyId, landlord);
        RentableUnit unit = new RentableUnit(property.getId(), name, rentalRate, dimensions, electricity, water);
        return unitDao.save(unit);
    }

    /** Name, rate, size and utilities. Not for archived units. Existing leases keep their own rent. */
    @Transactional
    public RentableUnit updateUnit(
            int unitId,
            User landlord,
            String name,
            BigDecimal rentalRate,
            Dimensions dimensions,
            boolean electricity,
            boolean water) {
        RentableUnit unit = getOwnedUnit(unitId, landlord);
        unit.updateDetails(name, dimensions, electricity, water);
        unit.changeRate(rentalRate);
        unitDao.update(unit);
        return unit;
    }

    /** true: AVAILABLE → UNDER_MAINTENANCE (not while occupied). false: UNDER_MAINTENANCE → AVAILABLE. */
    @Transactional
    public RentableUnit setUnderMaintenance(int unitId, User landlord, boolean underMaintenance) {
        RentableUnit unit = getOwnedUnit(unitId, landlord);
        if (underMaintenance) {
            unit.markUnderMaintenance();
        } else if (unit.getStatus() == UnitStatus.UNDER_MAINTENANCE) {
            unit.markAvailable();
        }
        unitDao.update(unit);
        return unit;
    }

    /**
     * What may happen to a unit taken off the grid:
     *   ACTIVE lease (running or upcoming) → nothing, end or terminate it first
     *   ended / terminated lease waiting for the move-out → nothing, confirm the move-out first
     *   past leases only                   → archive (keeps the lease and payment history)
     *   never leased                       → delete for good
     * Open lease requests (PENDING / APPROVED) are declined either way.
     */
    public UnitRemovalCheck removalCheck(int unitId, User landlord) {
        RentableUnit unit = getOwnedUnit(unitId, landlord);
        int open = leaseRequestDao.countOpenByUnitId(unitId);
        if (unit.isArchived()) {
            return new UnitRemovalCheck(false, false, open, unit.getName() + " is already archived.");
        }
        if (leaseDao.findActiveByUnitId(unitId).isPresent()) {
            return new UnitRemovalCheck(false, false, open,
                    unit.getName() + " has an active lease. End or terminate it first.");
        }
        LeaseContract waiting = leaseDao.findAwaitingMoveOutByUnitId(unitId).orElse(null);
        if (waiting != null) {
            return new UnitRemovalCheck(false, false, open, unit.getName() + " is waiting for " + waiting.getTenantName()
                    + " to move out. Confirm the move-out first.");
        }
        if (leaseDao.existsByUnitId(unitId)) {
            return new UnitRemovalCheck(false, true, open, unit.getName()
                    + " was leased before, so its lease and payment history must be kept. Archive it instead:"
                    + " it leaves the grid and the lists, and its history stays.");
        }
        return new UnitRemovalCheck(true, false, open, null);
    }

    /** Only with an ACTIVE lease nowhere and past leases kept. Uses Property.archiveUnit() so the spots are cleared. */
    @Transactional
    public void archiveUnit(int unitId, User landlord) {
        UnitRemovalCheck check = removalCheck(unitId, landlord);
        if (!check.canArchive() && !check.canDelete()) {
            throw new ConflictException(check.reason());
        }
        RentableUnit unit = getOwnedUnit(unitId, landlord);
        Property property = propertyService.getOwnedProperty(unit.getPropertyId(), landlord);
        RentableUnit onGrid = property.getZones().stream()
                .filter(z -> z instanceof RentableUnit && z.getId() == unitId)
                .map(z -> (RentableUnit) z)
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Unit not found."));
        property.archiveUnit(onGrid);                 // status ARCHIVED, spots cleared
        unitDao.update(onGrid);
        leaseRequestDao.declineOpenByUnitId(unitId);
    }

    /** Only if the unit was never leased (leaseDao.existsByUnitId); otherwise ConflictException: archive instead. */
    @Transactional
    public void deleteUnit(int unitId, User landlord) {
        UnitRemovalCheck check = removalCheck(unitId, landlord);
        if (!check.canDelete()) {
            throw new ConflictException(check.reason());
        }
        leaseRequestDao.declineOpenByUnitId(unitId);  // the renters still see them, marked declined
        fileService.deleteFilesFromDisk(FileKind.UNIT_PHOTO, unitId);   // their rows go with the unit (CASCADE)
        unitDao.deleteById(unitId);
    }

    /** For the plotter's View mode: the unit, its ACTIVE lease (or null) and how many lease requests are open. */
    public UnitDetails getUnitDetails(int unitId, User landlord) {
        RentableUnit unit = getOwnedUnit(unitId, landlord);
        return new UnitDetails(unit, leaseDao.findActiveByUnitId(unitId).orElse(null),
                leaseDao.findAwaitingMoveOutByUnitId(unitId).orElse(null),
                leaseRequestDao.countOpenByUnitId(unitId));
    }

    /** NotFoundException if missing, AccessDeniedException (via getOwnedProperty) if not the landlord's. */
    private RentableUnit getOwnedUnit(int unitId, User landlord) {
        RentableUnit unit = unitDao.findById(unitId).orElseThrow(() -> new NotFoundException("Unit not found."));
        propertyService.getOwnedProperty(unit.getPropertyId(), landlord);
        return unit;
    }
}
