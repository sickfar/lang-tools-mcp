package com.example;

import io.micronaut.context.annotation.Singleton;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Post;
import io.micronaut.http.annotation.Put;
import io.micronaut.http.annotation.Delete;
import io.micronaut.http.annotation.Patch;
import io.micronaut.http.annotation.Options;
import io.micronaut.http.annotation.Head;
import io.micronaut.scheduling.annotation.Scheduled;
import io.micronaut.runtime.event.annotation.EventListener;
import io.micronaut.context.annotation.Factory;
import io.micronaut.context.annotation.Bean;
import io.micronaut.http.annotation.Filter;
import io.micronaut.http.client.annotation.Client;
import io.micronaut.context.annotation.ConfigurationProperties;
import io.micronaut.websocket.annotation.ServerWebSocket;
import io.micronaut.websocket.annotation.ClientWebSocket;
import jakarta.inject.Inject;

@Controller
public class UserController {
    @Get("/users")
    public String getUsers() { return ""; }

    @Post("/users")
    public String createUser() { return ""; }

    @Put("/users/{id}")
    public String updateUser() { return ""; }

    @Delete("/users/{id}")
    public String deleteUser() { return ""; }

    @Patch("/users/{id}")
    public String patchUser() { return ""; }

    @Options("/users")
    public String optionsUsers() { return ""; }

    @Head("/users")
    public String headUsers() { return ""; }

    public String helperMethod() { return ""; }
}

@Singleton
public class AppSingleton {
    @Inject
    public UserService userService;
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

@ClientWebSocket("/ws")
public interface WsClient {
    void onMessage(String msg);
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
