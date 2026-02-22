package com.example;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Post;
import io.micronaut.scheduling.annotation.Scheduled;
import io.micronaut.runtime.event.annotation.EventListener;
import io.micronaut.context.annotation.Factory;
import io.micronaut.context.annotation.Bean;
import io.micronaut.http.annotation.Filter;
import io.micronaut.http.client.annotation.Client;
import io.micronaut.context.annotation.ConfigurationProperties;
import io.micronaut.websocket.annotation.ServerWebSocket;

@Controller
public class UserController {
    @Get("/users")
    public String getUsers() { return ""; }

    @Post("/users")
    public String createUser() { return ""; }

    public String helperMethod() { return ""; }
}

@Factory
class ServiceFactory {
    @Bean
    public UserService createService() { return null; }
}

@Filter("/**")
class LogFilter {}

@Client("/api")
interface ApiClient {
    @Get("/data")
    String getData();
}

class UserService {
    @Scheduled(fixedDelay = "1s")
    public void doWork() {}

    @EventListener
    public void onEvent(Object event) {}

    public String deadMethod() { return ""; }
}

@ConfigurationProperties("app")
class AppConfig {
    public String host;
}

@ServerWebSocket("/ws")
class WsServer {}

public class UnusedClass {
    public void nothing() {}
}
