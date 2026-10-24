package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.dao.RentableUnitDao;
import com.techhub.spacegridapplication.model.Dimensions;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.RentableUnit;
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
    private final PropertyService propertyService;

    public RentableUnitService(
            RentableUnitDao unitDao,
            LeaseContractDao leaseDao,
            PropertyService propertyService) {
        this.unitDao = unitDao;
        this.leaseDao = leaseDao;
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

    /** Only without an ACTIVE lease. Uses Property.archiveUnit() so the spots are cleared. */
    @Transactional
    public void archiveUnit(int unitId, User landlord) {
        // TODO
    }

    /** Only if the unit was never leased (leaseDao.existsByUnitId); otherwise ConflictException: archive instead. */
    public void deleteUnit(int unitId, User landlord) {
        // TODO
    }
}
