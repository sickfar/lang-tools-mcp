package com.example;

import java.io.Serializable;

public class ImplementsSerializable implements Serializable {
    public String getData() { return "data"; }
}

public class ImplementsRunnable implements Runnable {
    public void run() {}
    public String unusedMethod() { return ""; }
}

class PlainClass {
    public String doNothing() { return ""; }
}
