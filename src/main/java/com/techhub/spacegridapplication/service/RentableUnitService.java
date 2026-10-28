package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.dao.LeaseRequestDao;
import com.techhub.spacegridapplication.dao.RentableUnitDao;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.NotFoundException;
import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.RentableUnit;
import com.techhub.spacegridapplication.model.UnitRemovalCheck;
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

    public RentableUnitService(
            RentableUnitDao unitDao,
            LeaseContractDao leaseDao,
            LeaseRequestDao leaseRequestDao,
            PropertyService propertyService) {
        this.unitDao = unitDao;
        this.leaseDao = leaseDao;
        this.leaseRequestDao = leaseRequestDao;
        this.propertyService = propertyService;
    }

    public List<RentableUnit> getUnits(int propertyId, User landlord) {
        // TODO
        throw new UnsupportedOperationException("TODO");
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

    public RentableUnit updateUnit(
            int unitId,
            User landlord,
            String name,
            BigDecimal rentalRate,
            Dimensions dimensions,
            boolean electricity,
            boolean water) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    public void setUnderMaintenance(int unitId, User landlord, boolean underMaintenance) {
        // TODO
    }

    /**
     * What may happen to a unit taken off the grid:
     *   ACTIVE lease (running or upcoming) → nothing, end or terminate it first
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
        unitDao.deleteById(unitId);
    }

    /** NotFoundException if missing, AccessDeniedException (via getOwnedProperty) if not the landlord's. */
    private RentableUnit getOwnedUnit(int unitId, User landlord) {
        RentableUnit unit = unitDao.findById(unitId).orElseThrow(() -> new NotFoundException("Unit not found."));
        propertyService.getOwnedProperty(unit.getPropertyId(), landlord);
        return unit;
    }
}
