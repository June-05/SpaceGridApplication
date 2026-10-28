package com.techhub.spacegridapplication.dao;

import com.techhub.spacegridapplication.model.LeaseRequest;
import java.util.List;

/** findById / findBy... read the lease_request_details view, so the display names are filled in. */
public interface LeaseRequestDao extends CrudDao<LeaseRequest> {

/** The renter's own requests, newest first. */
List<LeaseRequest> findByRenterId(int renterId);

/** Requests for units in the landlord's properties, newest first. */
List<LeaseRequest> findByLandlordId(int landlordId);

/** True if this renter already has a PENDING request for this unit. */
boolean existsPendingByUnitAndRenter(int unitId, int renterId);

/** PENDING + APPROVED requests for the unit (they are declined when the unit is deleted or archived). */
int countOpenByUnitId(int unitId);

/** Declines every PENDING / APPROVED request for the unit; returns how many. */
int declineOpenByUnitId(int unitId);
}
