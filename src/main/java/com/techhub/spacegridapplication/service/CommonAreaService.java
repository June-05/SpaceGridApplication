package com.techhub.spacegridapplication.service;

import com.techhub.spacegridapplication.dao.CommonAreaDao;
import com.techhub.spacegridapplication.model.CommonArea;
import com.techhub.spacegridapplication.model.CommonAreaType;
import com.techhub.spacegridapplication.model.Property;
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

    @Transactional
    public CommonArea addCommonArea(int propertyId, User landlord, String name, CommonAreaType areaType) {
        Property property = propertyService.getOwnedProperty(propertyId, landlord);
        return commonAreaDao.save(new CommonArea(property.getId(), name, areaType));
    }

    public CommonArea updateCommonArea(int areaId, User landlord, String name, CommonAreaType areaType) {
        // TODO
        throw new UnsupportedOperationException("TODO");
    }

    public void deleteCommonArea(int areaId, User landlord) {
        // TODO
    }
}
