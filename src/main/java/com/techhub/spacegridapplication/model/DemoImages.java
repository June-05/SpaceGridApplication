package com.techhub.spacegridapplication.model;

import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Demo photos that ship with the project (src/main/resources/static/images/properties and /units).
 * They are found by file name, so they need no database row:
 *   property-06-some-slug-cover.jpg  is the cover of property 6
 *   unit-021-some-slug-01.jpg        is the first photo of unit 21
 * A photo uploaded through the app always wins; these are only the fallback.
 */
public final class DemoImages {

    private static Map<Integer, String> propertyCovers;
    private static Map<Integer, String> unitPhotos;

    private DemoImages() {
    }

    /** "/images/properties/property-06-...-cover.jpg", or null when there is no demo cover. */
    public static synchronized String coverOfProperty(int propertyId) {
        if (propertyCovers == null) {
            propertyCovers = scan("property", "-cover.jpg");
        }
        return propertyCovers.get(propertyId);
    }

    /** "/images/units/unit-021-...-01.jpg", or null when there is no demo photo. */
    public static synchronized String photoOfUnit(int unitId) {
        if (unitPhotos == null) {
            unitPhotos = scan("unit", "-01.jpg");
        }
        return unitPhotos.get(unitId);
    }

    /** Reads the folder once: id (the number after the first dash) -> web path. */
    private static Map<Integer, String> scan(String prefix, String suffix) {
        Map<Integer, String> found = new HashMap<>();
        String folder = prefix.equals("property") ? "properties" : "units";
        try {
            Resource[] files = new PathMatchingResourcePatternResolver()
                    .getResources("classpath:/static/images/" + folder + "/" + prefix + "-*" + suffix);
            for (Resource file : files) {
                String name = file.getFilename();
                String[] parts = (name == null) ? new String[0] : name.split("-");
                if (parts.length > 1 && parts[1].matches("[0-9]+")) {
                    found.put(Integer.parseInt(parts[1]), "/images/" + folder + "/" + name);
                }
            }
        } catch (IOException e) {
            // no demo images in this build: the pages show the usual placeholder
        }
        return found;
    }
}
