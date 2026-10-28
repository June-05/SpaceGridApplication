package com.techhub.spacegridapplication.model;

/**
 * Value object: what the plotter's View mode shows for a selected unit (GET /api/units/{id}/details).
 *   unit         = the unit itself (name, status, rate, size, utilities, spots)
 *   currentLease = its ACTIVE lease (running or not started yet), or null
 *   openRequests = PENDING + APPROVED lease requests for it
 */
public record UnitDetails(RentableUnit unit, LeaseContract currentLease, int openRequests) {
}
