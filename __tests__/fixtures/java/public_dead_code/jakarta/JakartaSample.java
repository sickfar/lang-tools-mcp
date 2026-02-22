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
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.HEAD;
import jakarta.ws.rs.OPTIONS;
import jakarta.ejb.Stateless;
import jakarta.ejb.Stateful;
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

    @PUT
    public String update() { return ""; }

    @DELETE
    public String remove() { return ""; }

    @PATCH
    public String patch() { return ""; }

    @HEAD
    public void head() {}

    @OPTIONS
    public void options() {}
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
