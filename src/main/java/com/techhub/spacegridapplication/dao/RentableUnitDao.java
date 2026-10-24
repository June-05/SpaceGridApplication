package com.techhub.spacegridapplication.dao;

import com.techhub.spacegridapplication.model.RentableUnit;
import java.util.List;

public interface RentableUnitDao extends CrudDao<RentableUnit> {

List<RentableUnit> findByPropertyId(int propertyId);
}
