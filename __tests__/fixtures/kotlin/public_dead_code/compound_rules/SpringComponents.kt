package com.example.app

import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.ApplicationArguments

// @Component + implements Spring interface (ApplicationRunner from org.springframework.boot)
// → ALIVE via compound rule (annotatedBy=Component + implementsInterfaceFromPackage=org.springframework.*)
@Component
class ComponentWithInterface : ApplicationRunner {
    override fun run(args: ApplicationArguments) {}

    // Method inside alive class → ALIVE via class cascade
    fun unusedButClassAlive() {}
}

// @Component alone (no Spring interface) → DEAD
@Component
class ComponentAlone {
    // Method in dead class → DEAD
    fun doWork() {}
}

// @Service + implements ApplicationRunner → ALIVE via compound rule
@Service
class ServiceWithInterface : ApplicationRunner {
    override fun run(args: ApplicationArguments) {}
}

// Unannotated class implements ApplicationRunner → DEAD (no annotation to satisfy compound rule)
class UnannotatedWithInterface : ApplicationRunner {
    override fun run(args: ApplicationArguments) {}
}

// @Configuration class → ALIVE (single-condition entrypoint for @Configuration)
@Configuration
class MyConfig {
    @Bean
    fun myBean(): String = "bean"

    // Plain method in @Configuration class → class is alive, cascade protects it
    fun unusedHelper() {}
}
