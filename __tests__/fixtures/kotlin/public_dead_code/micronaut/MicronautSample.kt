package com.example

import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import io.micronaut.scheduling.annotation.Scheduled
import io.micronaut.runtime.event.annotation.EventListener
import io.micronaut.context.annotation.Factory
import io.micronaut.context.annotation.Bean
import io.micronaut.context.annotation.ConfigurationProperties

@Controller
class UserController {
    @Get("/users")
    fun getUsers(): String = ""

    @Get("/items")
    fun getItems(): String = ""

    fun helperMethod(): String = ""
}

@Factory
class ServiceFactory {
    @Bean
    fun createService(): UserService = UserService()
}

class UserService {
    @Scheduled(fixedDelay = "1s")
    fun doWork() {}

    @EventListener
    fun onEvent(event: Any) {}

    fun deadMethod(): String = ""
}

@ConfigurationProperties("app")
class AppConfig {
    var host: String = ""
}

class UnusedClass {
    fun nothing() {}
}
