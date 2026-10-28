package com.techhub.spacegridapplication.dao;

import com.techhub.spacegridapplication.model.CommonArea;
import java.util.List;

public interface CommonAreaDao extends CrudDao<CommonArea> {

List<CommonArea> findByPropertyId(int propertyId);

/** Saves only the picked color (null = back to the type's default). */
void updateColor(int zoneId, String color);
}
