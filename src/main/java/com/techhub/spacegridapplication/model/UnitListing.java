package com.techhub.spacegridapplication.model;

import java.math.BigDecimal;

/**
 * Value object: one AVAILABLE unit ("block") shown on the homepage.
 * Read-only data for browsing; it has no rules of its own.
 */
public record UnitListing(
        int id,
        String name,
        BigDecimal rentalRate,
        Dimensions dimensions,          // null = no size given
        boolean includesElectricity,
        boolean includesWater) {
}
