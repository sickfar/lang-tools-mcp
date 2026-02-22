package com.example;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.context.event.EventListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;

@RestController
@RequestMapping("/api")
public class UserRestController {
    @Autowired
    public UserRestController(UserService svc) {}

    @Value("${app.name}")
    public String appName;

    @GetMapping("/users")
    public String listUsers() { return ""; }

    @PostMapping("/users")
    public String createUser() { return ""; }

    @PutMapping("/users/{id}")
    public String updateUser() { return ""; }

    @DeleteMapping("/users/{id}")
    public String deleteUser() { return ""; }

    @PatchMapping("/users/{id}")
    public String patchUser() { return ""; }
}

public class UserService {
    @Scheduled(fixedDelay = 5000)
    public void doScheduledWork() {}

    @EventListener
    public void handleEvent(Object event) {}

    public String unusedServiceMethod() { return ""; }
}

@ConfigurationProperties("app")
public class AppProperties {
    public String name;
    public String host;
}

@Controller
public class UserMvcController {
    public String show() { return ""; }
}

public class UnusedService {
    public void unused() {}
}
