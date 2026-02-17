package com.example;

import java.util.List;
import java.util.ArrayList;

public class DeadCodeUnusedLocals {

    public void processData() {
        String used = "hello";
        int unused = 42;
        System.out.println(used);
    }

    public void allUsed() {
        int a = 1;
        int b = 2;
        System.out.println(a + b);
    }

    public void multipleUnused() {
        String used = "hello";
        int unused1 = 1;
        double unused2 = 2.0;
        System.out.println(used);
    }

    public void withForLoop() {
        for (int i = 0; i < 10; i++) {
            System.out.println(i);
        }
    }

    public void withEnhancedFor() {
        List<String> items = new ArrayList<>();
        for (String item : items) {
            System.out.println(item);
        }
    }

    public void noLocals() {
        System.out.println("hello");
    }
}
