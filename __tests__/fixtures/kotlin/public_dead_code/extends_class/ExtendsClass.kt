package com.example

import com.acme.framework.BaseController
import com.acme.other.BaseService

class UserController : BaseController() {
    fun handle(): String = ""
}

class UserService : BaseService() {
    fun process(): String = ""
    fun unusedServiceMethod(): String = ""
}
