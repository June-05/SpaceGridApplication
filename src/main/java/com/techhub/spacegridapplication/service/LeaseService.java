package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.LeaseContractDao;
import com.techhub.spacegridapplication.dao.RentableUnitDao;
import com.techhub.spacegridapplication.dao.UserDao;
import com.techhub.spacegridapplication.exception.AccessDeniedException;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.NotFoundException;
import com.techhub.spacegridapplication.exception.ValidationException;
import com.techhub.spacegridapplication.model.LeaseContract;
import com.techhub.spacegridapplication.model.LeaseStatus;
import com.techhub.spacegridapplication.model.PaymentTerms;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.RentableUnit;
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

    /**
     * Unit must be the landlord's and AVAILABLE; renterUsername must be a RENTER account; unit -> OCCUPIED.
     * tenantName/email/phone are the contact details typed in the form (tenantName defaults to the account's name).
     */
    @Transactional
    public LeaseContract createLease(
            User landlord,
            int unitId,
            String renterUsername,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal monthlyRent,
            PaymentTerms paymentTerms,
            String tenantName,
            String tenantEmail,
            String tenantPhone) {
        RentableUnit unit = getOwnedUnit(unitId, landlord);
        User renter = findRenter(renterUsername);
        LeaseContract waiting = leaseDao.findAwaitingMoveOutByUnitId(unitId).orElse(null);
        if (waiting == null) {
            unit.markOccupied();                              // only from AVAILABLE
        } else if (waiting.getRenterId() == renter.getId()) {
            waiting.release(LocalDate.now());                 // the same renter signs again: they are staying
            leaseDao.update(waiting);
        } else {
            throw new ConflictException(unit.getName() + " is waiting for " + waiting.getTenantName()
                    + " to move out. Confirm the move-out first, then lease it to someone else.");
        }
        String name = (tenantName == null || tenantName.isBlank()) ? renter.getFullName() : tenantName;
        LeaseContract lease = new LeaseContract(unit.getId(), renter.getId(), startDate, endDate, monthlyRent,
                paymentTerms, name, tenantEmail, tenantPhone, null);
        leaseDao.save(lease);
        unitDao.update(unit);
        return reload(lease.getId());
    }

    /**
     * Old lease -> RENEWED (closedOn = day before newStartDate); new ACTIVE lease with previousLeaseId;
     * unit stays OCCUPIED. Same unit, renter and contact details; paymentTerms null = keep the old ones.
     */
    @Transactional
    public LeaseContract renewLease(
            int leaseId,
            User landlord,
            LocalDate newStartDate,
            LocalDate newEndDate,
            BigDecimal newMonthlyRent,
            PaymentTerms paymentTerms) {
        LeaseContract old = getLeaseFor(leaseId, landlord);
        if (newStartDate == null || !newStartDate.isAfter(old.getStartDate())) {
            throw new ValidationException("The renewal must start after " + old.getStartDate() + ".");
        }
        old.markRenewed(newStartDate.minusDays(1));          // only from ACTIVE
        leaseDao.update(old);                                 // first, so the unit has no other ACTIVE lease
        LeaseContract renewal = new LeaseContract(old.getUnitId(), old.getRenterId(), newStartDate, newEndDate,
                newMonthlyRent, paymentTerms != null ? paymentTerms : old.getPaymentTerms(),
                old.getTenantName(), old.getTenantEmail(), old.getTenantPhone(), old.getId());
        leaseDao.save(renewal);
        return reload(renewal.getId());
    }

    /** Normal end, from the end date on (use terminate before that). The unit stays OCCUPIED until confirmMoveOut. */
    @Transactional
    public void endLease(int leaseId, User landlord) {
        LeaseContract lease = getLeaseFor(leaseId, landlord);
        LocalDate today = LocalDate.now();
        if (lease.getStatus() == LeaseStatus.ACTIVE && today.isBefore(lease.getEndDate())) {
            throw new ConflictException("This lease runs until " + lease.getEndDate()
                    + ". To end it before then, terminate it.");
        }
        lease.end(today);
        leaseDao.update(lease);
    }

    /** Early end with a reason the renter will see. The unit stays OCCUPIED until confirmMoveOut. */
    @Transactional
    public void terminateLease(int leaseId, User landlord, String reason) {
        LeaseContract lease = getLeaseFor(leaseId, landlord);
        lease.terminate(LocalDate.now(), reason);
        leaseDao.update(lease);
    }

    /** The renter has left: an ENDED / TERMINATED lease releases its unit (OCCUPIED -> AVAILABLE). */
    @Transactional
    public void confirmMoveOut(int leaseId, User landlord) {
        LeaseContract lease = getLeaseFor(leaseId, landlord);
        lease.release(LocalDate.now());
        leaseDao.update(lease);
        freeUnit(lease.getUnitId());
    }

    /**
     * Automatic end (LeaseExpiryJob): every ACTIVE lease whose end date is before today becomes ENDED
     * (closedOn = its end date, endedAutomatically). Its unit stays OCCUPIED until the landlord confirms the
     * move-out (confirmMoveOut). Returns how many were ended.
     */
    @Transactional
    public int expireLeases(LocalDate today) {
        List<LeaseContract> due = leaseDao.findActiveEndedBefore(today);
        for (LeaseContract lease : due) {
            lease.expire();
            leaseDao.update(lease);
        }
        return due.size();
    }

    public List<LeaseContract> getLeasesForLandlord(User landlord) {
        return leaseDao.findByLandlordId(landlord.getId());
    }

    public List<LeaseContract> getLeasesForProperty(int propertyId, User landlord) {
        propertyService.getOwnedProperty(propertyId, landlord);
        return leaseDao.findByPropertyId(propertyId);
    }

    public List<LeaseContract> getLeasesForRenter(User renter) {
        return leaseDao.findByRenterId(renter.getId());
    }

    /** A renter may only open their own leases; a landlord only leases on their properties. */
    public LeaseContract getLeaseFor(int leaseId, User user) {
        LeaseContract lease = leaseDao.findById(leaseId)
                .orElseThrow(() -> new NotFoundException("Lease not found."));
        if (user.isRenter() && !lease.isRentedBy(user.getId())) {
            throw new AccessDeniedException("This lease doesn't belong to your account.");
        }
        if (user.isLandlord()) {
            propertyService.getOwnedProperty(lease.getPropertyId(), user);   // AccessDeniedException if not theirs
        }
        return lease;
    }

    /** The lease's property with its grid, for lease.html's "Unit Location" (the landlord or the lease's renter). */
    public Property getPropertyOfLease(int leaseId, User user) {
        LeaseContract lease = getLeaseFor(leaseId, user);
        return propertyService.getProperty(lease.getPropertyId());
    }

    /** Lease form's "pick an existing account": renter accounts matching the text. */
    public List<User> findRenters(String search) {
        return userDao.findRenters(search);
    }

    private User findRenter(String username) {
        if (username == null || username.isBlank()) {
            throw new ValidationException("Pick the renter's account.");
        }
        User renter = userDao.findByUsername(username.trim())
                .orElseThrow(() -> new NotFoundException("There is no account with the username \"" + username.trim() + "\"."));
        if (!renter.isRenter()) {
            throw new ValidationException(renter.getUsername() + " is a landlord account, not a renter.");
        }
        return renter;
    }

    /** NotFoundException if missing, AccessDeniedException (via getOwnedProperty) if not the landlord's. */
    private RentableUnit getOwnedUnit(int unitId, User landlord) {
        RentableUnit unit = unitDao.findById(unitId).orElseThrow(() -> new NotFoundException("Unit not found."));
        propertyService.getOwnedProperty(unit.getPropertyId(), landlord);
        return unit;
    }

    /** After the move-out is confirmed: OCCUPIED -> AVAILABLE (an archived unit stays archived). */
    private void freeUnit(int unitId) {
        unitDao.findById(unitId).ifPresent(unit -> {
            if (!unit.isArchived()) {
                unit.markAvailable();
                unitDao.update(unit);
            }
        });
    }

    /** Read it back from the lease_details view, so the display names are filled in. */
    private LeaseContract reload(int leaseId) {
        return leaseDao.findById(leaseId).orElseThrow(() -> new NotFoundException("Lease not found."));
    }
}
