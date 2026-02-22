package com.example

import jakarta.inject.Singleton
import jakarta.inject.Inject
import jakarta.enterprise.context.ApplicationScoped
import jakarta.ws.rs.Path
import jakarta.ws.rs.GET
import jakarta.ejb.Stateless
import jakarta.persistence.Entity

@Singleton
class UserService {
    @Inject
    lateinit var repo: Any

    fun findUser(id: Long): Any? = null
}

@ApplicationScoped
class OrderService

@Path("/users")
class UserResource {
    @GET
    fun getAll(): String = ""
}

@Stateless
class StatelessBean {
    fun process() {}
}

@Entity
class User(val id: Long, val name: String)

class UnusedClass {
    fun nothing() {}
}
