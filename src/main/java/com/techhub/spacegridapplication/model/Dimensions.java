package com.techhub.spacegridapplication.model;

import com.techhub.spacegridapplication.exception.ValidationException;

import java.math.BigDecimal;

/**
 * Value object: size of a property or unit. Either an exact area in sqm, or a description when not exact.
 * A record = immutable, with equals()/hashCode() generated from its values.
 */
public record Dimensions(boolean exact, String description, BigDecimal areaSqm) {

    public Dimensions {
        if (exact && (areaSqm == null || areaSqm.signum() <= 0)) {
            throw new ValidationException("An exact size needs an area greater than 0.");
        }
        if (!exact && (description == null || description.isBlank())) {
            throw new ValidationException("A size that is not exact needs a description.");
        }
    }

    /** Exact size, e.g. 36.00 sqm. */
    public static Dimensions exact(BigDecimal areaSqm) {
        return new Dimensions(true, null, areaSqm);
    }

    /** Approximate size, e.g. "Studio-size". */
    public static Dimensions approximate(String description) {
        return new Dimensions(false, description.trim(), null);
    }

    /** "36 sqm" or "Approx. Studio-size". */
    public String toDisplayString() {
        return exact ? areaSqm.stripTrailingZeros().toPlainString() + " sqm" : "Approx. " + description;
    }
}
