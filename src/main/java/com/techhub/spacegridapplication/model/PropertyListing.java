package com.techhub.spacegridapplication.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Value object: an ACTIVE property as shown on the public homepage. Only AVAILABLE units are included,
 * and availableBlocks is how many there are (one unit = one block). Nothing private is in here.
 */
public record PropertyListing(
        int id,
        String name,
        String address,
        PropertyType propertyType,
        String description,
        String landlordName,
        LocalDateTime createdAt,
        List<UnitListing> units) {

    /** Number of AVAILABLE units: the homepage calls them blocks. */
    public int getAvailableBlocks() {
        return units.size();
    }

    public BigDecimal getMinRate() {
        return units.stream().map(UnitListing::rentalRate).min(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
    }

    public BigDecimal getMaxRate() {
        return units.stream().map(UnitListing::rentalRate).max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
    }

    /** True if at least one available unit includes electricity (the "Power included" filter). */
    public boolean isPowerIncluded() {
        return units.stream().anyMatch(UnitListing::includesElectricity);
    }

    public boolean isWaterIncluded() {
        return units.stream().anyMatch(UnitListing::includesWater);
    }
}
