package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.LeaseRequestDao;
import com.techhub.spacegridapplication.dao.PropertyDao;
import com.techhub.spacegridapplication.dao.RentableUnitDao;
import com.techhub.spacegridapplication.exception.AccessDeniedException;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.NotFoundException;
import com.techhub.spacegridapplication.exception.ValidationException;
import com.techhub.spacegridapplication.model.LeaseRequest;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.PropertyStatus;
import com.techhub.spacegridapplication.model.RentableUnit;
import com.techhub.spacegridapplication.model.UnitStatus;
import com.techhub.spacegridapplication.model.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * Lease requests: a renter asks for an AVAILABLE unit from the homepage, the landlord approves or declines.
 * Approving does not create the lease: the landlord does that with the lease form (LeaseService).
 */
@Service
public class LeaseRequestService {

    private final LeaseRequestDao leaseRequestDao;
    private final RentableUnitDao rentableUnitDao;
    private final PropertyDao propertyDao;

    public LeaseRequestService(LeaseRequestDao leaseRequestDao, RentableUnitDao rentableUnitDao, PropertyDao propertyDao) {
        this.leaseRequestDao = leaseRequestDao;
        this.rentableUnitDao = rentableUnitDao;
        this.propertyDao = propertyDao;
    }

    /**
     * The renter must have an email and a phone on their account. The unit must be AVAILABLE in an ACTIVE property,
     * and the renter can't already have a PENDING request for it.
     */
    @Transactional
    public LeaseRequest createRequest(User renter, int unitId, LocalDate desiredStart, int months, String message) {
        if (!renter.hasContact()) {
            throw new ValidationException("Add your email and phone number first, so the owner can reach you.");
        }
        RentableUnit unit = rentableUnitDao.findById(unitId)
                .orElseThrow(() -> new NotFoundException("Unit not found."));
        Property property = propertyDao.findById(unit.getPropertyId())
                .orElseThrow(() -> new NotFoundException("Property not found."));
        if (property.getStatus() != PropertyStatus.ACTIVE || unit.getStatus() != UnitStatus.AVAILABLE) {
            throw new ConflictException("This unit isn't available for rent right now.");
        }
        if (leaseRequestDao.existsPendingByUnitAndRenter(unitId, renter.getId())) {
            throw new ConflictException("You already have a pending request for this unit.");
        }

        LeaseRequest request = new LeaseRequest(unitId, renter.getId(), desiredStart, months, message);
        leaseRequestDao.save(request);
        return getRequest(request.getId());
    }

    /** A renter sees their own requests; a landlord sees the requests for their properties. Newest first. */
    public List<LeaseRequest> getRequestsFor(User user) {
        return user.isLandlord()
                ? leaseRequestDao.findByLandlordId(user.getId())
                : leaseRequestDao.findByRenterId(user.getId());
    }

    /** Landlord accepts. The unit must still be AVAILABLE. */
    @Transactional
    public LeaseRequest approve(int requestId, User landlord) {
        LeaseRequest request = getRequestForLandlord(requestId, landlord);
        if (request.isUnitRemoved()) {
            throw new ConflictException("This unit was removed.");
        }
        RentableUnit unit = rentableUnitDao.findById(request.getUnitId())
                .orElseThrow(() -> new NotFoundException("Unit not found."));
        if (unit.getStatus() != UnitStatus.AVAILABLE) {
            throw new ConflictException("This unit is no longer available.");
        }
        request.approve();
        leaseRequestDao.update(request);
        return request;
    }

    @Transactional
    public LeaseRequest decline(int requestId, User landlord) {
        LeaseRequest request = getRequestForLandlord(requestId, landlord);
        request.decline();
        leaseRequestDao.update(request);
        return request;
    }

    /** The renter withdraws their own PENDING request. */
    @Transactional
    public LeaseRequest cancel(int requestId, User renter) {
        LeaseRequest request = getRequest(requestId);
        if (!request.isFromRenter(renter.getId())) {
            throw new AccessDeniedException("This request doesn't belong to your account.");
        }
        request.cancel();
        leaseRequestDao.update(request);
        return request;
    }

    private LeaseRequest getRequest(int requestId) {
        return leaseRequestDao.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Request not found."));
    }

    private LeaseRequest getRequestForLandlord(int requestId, User landlord) {
        LeaseRequest request = getRequest(requestId);
        if (!request.isForLandlord(landlord.getId())) {
            throw new AccessDeniedException("This request isn't for one of your properties.");
        }
        return request;
    }
}
