package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.CommonAreaDao;
import com.techhub.spacegridapplication.exception.ConflictException;
import com.techhub.spacegridapplication.exception.NotFoundException;
import com.techhub.spacegridapplication.model.CommonArea;
import com.techhub.spacegridapplication.model.CommonAreaType;
import com.techhub.spacegridapplication.model.Property;
import com.techhub.spacegridapplication.model.UnitStatus;
import com.techhub.spacegridapplication.model.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Common areas of a property (walkways, grass, shared rooms...). */
@Service
public class CommonAreaService {

    private final CommonAreaDao commonAreaDao;
    private final PropertyService propertyService;

    public CommonAreaService(CommonAreaDao commonAreaDao, PropertyService propertyService) {
        this.commonAreaDao = commonAreaDao;
        this.propertyService = propertyService;
    }

    public List<CommonArea> getCommonAreas(int propertyId, User landlord) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    /** color is optional ("#rrggbb"); when given it must not be used by another common area of the property. */
    @Transactional
    public CommonArea addCommonArea(int propertyId, User landlord, String name, CommonAreaType areaType, String color) {
        Property property = propertyService.getOwnedProperty(propertyId, landlord);
        CommonArea area = new CommonArea(property.getId(), name, areaType, color);
        if (area.getCustomColor() != null) {
            checkColorFree(property, null, area.getCustomColor());
        }
        return commonAreaDao.save(area);
    }

    /** Picks a new color for one common area of the landlord's property. */
    @Transactional
    public CommonArea changeColor(int propertyId, int areaId, User landlord, String color) {
        Property property = propertyService.getOwnedProperty(propertyId, landlord);
        CommonArea area = property.getCommonAreas().stream()
                .filter(a -> a.getId() == areaId)
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Common area not found."));
        area.changeColor(color);
        checkColorFree(property, area, area.getCustomColor());
        commonAreaDao.updateColor(area.getId(), area.getCustomColor());
        return area;
    }

    /**
     * A common area's color must differ from every other common area of the property, so each one can be told apart,
     * and from the unit status colors, so the grid still shows which units are free or taken.
     */
    private void checkColorFree(Property property, CommonArea self, String color) {
        for (UnitStatus status : UnitStatus.values()) {
            if (status.getDefaultColor().equalsIgnoreCase(color)) {
                throw new ConflictException("That color is kept for units that are " + status.getLabel().toLowerCase() + ".");
            }
        }
        for (CommonArea other : property.getCommonAreas()) {
            if (other != self && other.getColor().equalsIgnoreCase(color)) {
                throw new ConflictException("That color is already used by " + other.getName() + ".");
            }
        }
    }

    /** Rename and/or change the type (its color stays; change it with changeColor). */
    @Transactional
    public CommonArea updateCommonArea(int areaId, User landlord, String name, CommonAreaType areaType) {
        CommonArea area = commonAreaDao.findById(areaId)
                .orElseThrow(() -> new NotFoundException("Common area not found."));
        propertyService.getOwnedProperty(area.getPropertyId(), landlord);
        area.rename(name);
        area.changeType(areaType);
        commonAreaDao.update(area);
        return area;
    }

    /** Deletes a common area of the landlord's property; its spots are cleared with it. Nothing else refers to it. */
    @Transactional
    public void deleteCommonArea(int areaId, User landlord) {
        CommonArea area = commonAreaDao.findById(areaId)
                .orElseThrow(() -> new NotFoundException("Common area not found."));
        propertyService.getOwnedProperty(area.getPropertyId(), landlord);
        commonAreaDao.deleteById(areaId);
    }
}
