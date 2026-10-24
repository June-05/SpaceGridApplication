package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.dao.RentableUnitDao;
import com.techhub.spacegridapplication.dao.UserDao;
import com.techhub.spacegridapplication.model.LeaseContract;
import com.techhub.spacegridapplication.model.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Lease contracts: create, renew, end, terminate, and the landlord/renter lists. */
@Service
public class LeaseService {

    private final LeaseContractDao leaseDao;
    private final RentableUnitDao unitDao;
    private final UserDao userDao;
    private final PropertyService propertyService;

    public LeaseService(
            LeaseContractDao leaseDao,
            RentableUnitDao unitDao,
            UserDao userDao,
            PropertyService propertyService) {
        this.leaseDao = leaseDao;
        this.unitDao = unitDao;
        this.userDao = userDao;
        this.propertyService = propertyService;
    }

    /** Unit must be the landlord's and AVAILABLE; the user must be a RENTER; unit -> OCCUPIED. */
    @Transactional
    public LeaseContract createLease(
            User landlord,
            int unitId,
            String renterUsername,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal monthlyRent) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    /** Old lease -> RENEWED (closedOn = day before newStartDate); new ACTIVE lease with previousLeaseId; unit stays OCCUPIED. */
    @Transactional
    public LeaseContract renewLease(
            int leaseId,
            User landlord,
            LocalDate newStartDate,
            LocalDate newEndDate,
            BigDecimal newMonthlyRent) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    /** Normal end; unit -> AVAILABLE. */
    @Transactional
    public void endLease(int leaseId, User landlord) {
        // TODO
    }

    /** Early end; unit -> AVAILABLE. */
    @Transactional
    public void terminateLease(int leaseId, User landlord) {
        // TODO
    }

    public List<LeaseContract> getLeasesForLandlord(User landlord) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    public List<LeaseContract> getLeasesForProperty(int propertyId, User landlord) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    public List<LeaseContract> getLeasesForRenter(User renter) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    /** A renter may only open their own leases; a landlord only leases on their properties. */
    public LeaseContract getLeaseFor(int leaseId, User user) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }
}
