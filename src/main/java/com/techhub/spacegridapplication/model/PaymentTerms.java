package com.techhub.spacegridapplication.model;

/**
 * How often the renter pays, and whether before or after the period (lease_contracts.payment_terms).
 *   monthsPerPeriod = how many months one payment covers (1, 3, 6 or 12)
 *   inAdvance       = true: due at the START of the period; false (arrears): due at the start of the NEXT period
 */
public enum PaymentTerms {
    MONTHLY_ADVANCE("Monthly in advance", 1, true),
    MONTHLY_ARREARS("Monthly in arrears", 1, false),
    QUARTERLY_ADVANCE("Quarterly in advance", 3, true),
    SEMI_ANNUAL_ADVANCE("Semi-annual in advance", 6, true),
    ANNUAL_ADVANCE("Annual in advance", 12, true);

    private final String label;
    private final int monthsPerPeriod;
    private final boolean inAdvance;

    PaymentTerms(String label, int monthsPerPeriod, boolean inAdvance) {
        this.label = label;
        this.monthsPerPeriod = monthsPerPeriod;
        this.inAdvance = inAdvance;
    }

    public String getLabel() { return label; }
    public int getMonthsPerPeriod() { return monthsPerPeriod; }
    public boolean isInAdvance() { return inAdvance; }
}
