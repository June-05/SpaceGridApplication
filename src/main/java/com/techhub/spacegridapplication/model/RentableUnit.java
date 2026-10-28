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
        if (isArchived()) {
            throw new ConflictException(getName() + " is archived and can't be edited.");
        }
        rename(name);
        this.dimensions = dimensions;
        this.includesElectricity = includesElectricity;
        this.includesWater = includesWater;
    }

    /** New monthly rate. Existing leases keep their own rent; it applies to new leases. */
    public void changeRate(BigDecimal rate) {
        if (rate == null || rate.signum() < 0) {
            throw new ValidationException("Rental rate can't be negative.");
        }
        if (isArchived()) {
            throw new ConflictException(getName() + " is archived and can't be edited.");
        }
        this.rentalRate = rate;
    }

    @JsonIgnore
    public boolean isAvailable() {
        return status == UnitStatus.AVAILABLE;
    }

    /** A lease starts: AVAILABLE -> OCCUPIED. */
    public void markOccupied() {
        if (!isAvailable()) {
            throw new ConflictException(getName() + " is " + status.getLabel().toLowerCase()
                    + ", so it can't be leased right now.");
        }
        this.status = UnitStatus.OCCUPIED;
    }

    public void markAvailable() {
        if (isArchived()) {
            throw new ConflictException(getName() + " is archived.");
        }
        this.status = UnitStatus.AVAILABLE;
    }

    public void markUnderMaintenance() {
        if (status == UnitStatus.OCCUPIED) {
            throw new ConflictException(getName() + " is occupied, so it can't go under maintenance.");
        }
        if (isArchived()) {
            throw new ConflictException(getName() + " is archived.");
        }
        this.status = UnitStatus.UNDER_MAINTENANCE;
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
