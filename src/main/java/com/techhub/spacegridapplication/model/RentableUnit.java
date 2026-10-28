package com.techhub.spacegridapplication.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.ValidationException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;

/** A space that can be leased. */
public class RentableUnit extends GridZone {

    private BigDecimal rentalRate;
    private Dimensions dimensions;          // null = no size given
    private boolean includesElectricity;
    private boolean includesWater;
    private UnitStatus status;

    /** New unit: starts as AVAILABLE. */
    public RentableUnit(int propertyId, String name, BigDecimal rentalRate, Dimensions dimensions,
                        boolean includesElectricity, boolean includesWater) {
        super(propertyId, name);
        if (rentalRate == null || rentalRate.signum() < 0) {
            throw new ValidationException("Rental rate can't be negative.");
        }
        this.rentalRate = rentalRate;
        this.dimensions = dimensions;
        this.includesElectricity = includesElectricity;
        this.includesWater = includesWater;
        this.status = UnitStatus.AVAILABLE;
    }

    /** From database. */
    public RentableUnit(int id, LocalDateTime createdAt, int propertyId, String name, Set<GridPosition> positions,
                        BigDecimal rentalRate, Dimensions dimensions, boolean includesElectricity,
                        boolean includesWater, UnitStatus status) {
        super(id, createdAt, propertyId, name, positions);
        this.rentalRate = rentalRate;
        this.dimensions = dimensions;
        this.includesElectricity = includesElectricity;
        this.includesWater = includesWater;
        this.status = status;
    }

    public BigDecimal getRentalRate() { return rentalRate; }
    public Dimensions getDimensions() { return dimensions; }
    public boolean isIncludesElectricity() { return includesElectricity; }
    public boolean isIncludesWater() { return includesWater; }
    public UnitStatus getStatus() { return status; }

    public void updateDetails(
            String name,
            Dimensions dimensions,
            boolean includesElectricity,
            boolean includesWater) {
        // TODO: not allowed when ARCHIVED; rename(name) and replace the other fields
    }

    public void changeRate(BigDecimal rate) {
        // TODO: reject null or negative
    }

    @JsonIgnore
    public boolean isAvailable() {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    public void markOccupied() {
        // TODO: only from AVAILABLE
    }

    public void markAvailable() {
        // TODO: not allowed when ARCHIVED
    }

    public void markUnderMaintenance() {
        // TODO: not allowed while OCCUPIED or ARCHIVED
    }

    @JsonIgnore
    public boolean isArchived() {
        return status == UnitStatus.ARCHIVED;
    }

    /** Package-private: call Property.archiveUnit(unit) so the spots are cleared too. */
    void archive() {
        if (status == UnitStatus.OCCUPIED) {
            throw new ConflictException(getName() + " is occupied. End or terminate its lease first.");
        }
        this.status = UnitStatus.ARCHIVED;
    }

    @Override
    public boolean isRentable() {
        return true;
    }

    @Override
    public boolean isEnclosed() {
        return true;
    }

    @Override
    public String getCssClasses() {
        return "zone zone-unit " + status.getCssClass();
    }

    @Override
    public String getColor() {
        return status.getDefaultColor();
    }
}
