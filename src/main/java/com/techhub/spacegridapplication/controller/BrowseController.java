package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.GridPreview;
import com.techhub.spacegridapplication.model.PropertyListing;
import com.techhub.spacegridapplication.service.PropertyService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public endpoints for the homepage (homepage.html): browse the spaces that can be rented.
 * Unlike the other controllers these take NO HttpSession: anyone can look without logging in.
 * Searching, filtering and sorting happen in the browser (js/pages/homepage.js).
 */
@RestController
@RequestMapping("/api/browse")
public class BrowseController {

    private final PropertyService propertyService;

    public BrowseController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    /** Every ACTIVE property with at least one AVAILABLE unit, newest first, each with its available units. */
    @GetMapping
    public List<PropertyListing> list() {
        return propertyService.getListings();
    }

    /** One listing, for the details window. 404 if it isn't ACTIVE or has no available unit. */
    @GetMapping("/{id}")
    public PropertyListing get(@PathVariable int id) {
        return propertyService.getListing(id);
    }

    /** The listing's grid (thumbnail on the card, map in the details window): layout + which units are free. 404 like get. */
    @GetMapping("/{id}/layout")
    public GridPreview layout(@PathVariable int id) {
        return propertyService.getListingLayout(id);
    }
}
