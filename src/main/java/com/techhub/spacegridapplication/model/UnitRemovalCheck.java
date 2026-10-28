package com.techhub.spacegridapplication.model;

/**
 * Value object: what the landlord may do to take a unit off the grid (GET /api/units/{id}/removal-check).
 *   canDelete    = never leased: it can be deleted for good
 *   canArchive   = leased before but not now: it can only be archived (its history is kept)
 *   openRequests = PENDING / APPROVED lease requests that will be declined
 *   reason       = why it can't be deleted (null when it can)
 * A unit with an ACTIVE lease can be neither deleted nor archived.
 */
public record UnitRemovalCheck(boolean canDelete, boolean canArchive, int openRequests, String reason) {
}
