package com.techhub.spacegridapplication.controller;

import com.techhub.spacegridapplication.model.CommonArea;
import com.techhub.spacegridapplication.model.CommonAreaType;
import com.techhub.spacegridapplication.model.Role;
import com.techhub.spacegridapplication.model.User;
import com.techhub.spacegridapplication.security.SessionManager;
import com.techhub.spacegridapplication.service.CommonAreaService;

import jakarta.servlet.http.HttpSession;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Common areas (walkways, grass, shared rooms) on the grid page.
 * Every method gets the logged-in user from SessionManager (never from the browser).
 */
@RestController
@RequestMapping("/api")
public class CommonAreaController {

    private final CommonAreaService commonAreaService;
    private final SessionManager sessionManager;

    public CommonAreaController(CommonAreaService commonAreaService, SessionManager sessionManager) {
        this.commonAreaService = commonAreaService;
        this.sessionManager = sessionManager;
    }

    @GetMapping("/properties/{propertyId}/common-areas")
    public List<CommonArea> list(@PathVariable int propertyId, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    /** Form fields: name, areaType (e.g. WALKWAY). */
    @PostMapping("/properties/{propertyId}/common-areas")
    public CommonArea create(
            @PathVariable int propertyId,
            @RequestParam String name,
            @RequestParam CommonAreaType areaType,
            HttpSession session) {
        User landlord = sessionManager.requireRole(session, Role.LANDLORD);
        return commonAreaService.addCommonArea(propertyId, landlord, name, areaType);
    }

    @PutMapping("/common-areas/{id}")
    public CommonArea update(
            @PathVariable int id,
            @RequestParam String name,
            @RequestParam CommonAreaType areaType,
            HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
        throw new UnsupportedOperationException("TODO");
    }

    @DeleteMapping("/common-areas/{id}")
    public void delete(@PathVariable int id, HttpSession session) {
        // TODO: get the user from sessionManager, call the service, return the result
    }
}
