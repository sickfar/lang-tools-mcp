package com.example;

import com.acme.framework.BaseController;
import com.acme.other.BaseService;

public class UserController extends BaseController {
    public String handle() { return ""; }
}

public class UserService extends BaseService {
    public String process() { return ""; }
    public String unusedServiceMethod() { return ""; }
}

class PlainClass {
    public String doNothing() { return ""; }
}
