package com.example.app;

import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;

// @Component + implements Spring interface (ApplicationRunner from org.springframework.boot)
// → ALIVE via compound rule (annotatedBy=Component + implementsInterfaceFromPackage=org.springframework.*)
@Component
public class ComponentWithInterface implements ApplicationRunner {
    @Override
    public void run(ApplicationArguments args) {}

    // Method inside alive class → ALIVE via class cascade
    public void unusedButClassAlive() {}
}

// @Component alone (no Spring interface) → DEAD
@Component
public class ComponentAlone {
    // Method in dead class → DEAD
    public void doWork() {}
}

// @Service + implements ApplicationRunner → ALIVE via compound rule
@Service
public class ServiceWithInterface implements ApplicationRunner {
    @Override
    public void run(ApplicationArguments args) {}
}

// Unannotated class implements ApplicationRunner → DEAD (no annotation to satisfy compound rule)
public class UnannotatedWithInterface implements ApplicationRunner {
    @Override
    public void run(ApplicationArguments args) {}
}

// @Bean method in a @Configuration class → ALIVE (single-condition entrypoint for @Bean)
// @Configuration class itself → ALIVE (single-condition entrypoint for @Configuration)
@Configuration
public class MyConfig {
    @Bean
    public String myBean() {
        return "bean";
    }

    // Plain method in @Configuration class → class is alive, so cascade protects it
    public void unusedHelper() {}
}
