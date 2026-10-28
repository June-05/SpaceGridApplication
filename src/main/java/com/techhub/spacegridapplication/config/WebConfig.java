package com.techhub.spacegridapplication.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Page routes. The HTML files in static/ are already served under their file name
 * (e.g. /login.html); this adds the short addresses and makes the homepage the front door.
 *   /  /home  /browse  →  homepage.html   (browse spaces to rent; public)
 *   /login  /register  /requests  →  the page with the same name
 * /index.html still works: it is the old welcome page.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/homepage.html");
        registry.addViewController("/home").setViewName("forward:/homepage.html");
        registry.addViewController("/browse").setViewName("forward:/homepage.html");
        registry.addViewController("/login").setViewName("forward:/login.html");
        registry.addViewController("/register").setViewName("forward:/register.html");
        registry.addViewController("/requests").setViewName("forward:/requests.html");
    }
}
