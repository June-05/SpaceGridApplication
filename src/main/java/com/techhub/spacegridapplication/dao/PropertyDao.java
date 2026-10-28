package com.techhub.spacegridapplication.dao;

import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.PropertyListing;
import java.util.List;
import java.util.Optional;

public interface PropertyDao extends CrudDao<Property> {

/** findById(id) also loads the property's zones (with their spots) and edge overrides. */
List<Property> findByLandlordId(int landlordId);

/** Saves grid_rows / grid_columns and every zone's spots (zone_cells), in one transaction. */
void saveGridLayout(Property property);

/** Replaces the property's rows in edge_overrides. */
void saveEdgeOverrides(Property property);

/** Homepage: every ACTIVE property that has at least one AVAILABLE unit, newest first. */
List<PropertyListing> findActiveListings();

/** Homepage details: one ACTIVE property with its AVAILABLE units (empty if it isn't ACTIVE or has none). */
Optional<PropertyListing> findActiveListingById(int propertyId);
}
