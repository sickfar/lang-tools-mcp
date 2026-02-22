package com.example;

import jakarta.inject.Singleton;
import jakarta.inject.Inject;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.context.RequestScoped;
import jakarta.enterprise.context.SessionScoped;
import jakarta.enterprise.inject.Produces;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ejb.Stateless;
import jakarta.ejb.Stateful;
import jakarta.ejb.Schedule;
import jakarta.persistence.Entity;

@Singleton
public class UserService {
    @Inject
    public UserRepository repo;

    public User findUser(Long id) { return null; }
}

@ApplicationScoped
public class OrderService {}

@RequestScoped
public class RequestHandler {}

@SessionScoped
public class SessionData {}

@Path("/users")
public class UserResource {
    @GET
    public String getAll() { return ""; }

    @POST
    public String create() { return ""; }
}

@Stateless
public class StatelessBean {
    public void process() {}
}

@Stateful
public class StatefulBean {
    public void process() {}
}

public class BeanProducer {
    @Produces
    public UserService produce() { return null; }
}

@Entity
public class User {
    public Long id;
    public String name;
}

public class UnusedClass {
    public void nothing() {}
}
