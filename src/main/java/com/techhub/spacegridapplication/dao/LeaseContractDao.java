package com.techhub.spacegridapplication.dao;

import com.techhub.spacegridapplication.model.LeaseContract;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface LeaseContractDao extends CrudDao<LeaseContract> {

List<LeaseContract> findByRenterId(int renterId);

List<LeaseContract> findByLandlordId(int landlordId);

List<LeaseContract> findByPropertyId(int propertyId);

Optional<LeaseContract> findActiveByUnitId(int unitId);

/** ACTIVE leases whose end date is before the given day (LeaseExpiryJob ends them). */
List<LeaseContract> findActiveEndedBefore(LocalDate day);

/** True if the unit has ever been leased (then it can only be archived, not deleted). */
boolean existsByUnitId(int unitId);
}
