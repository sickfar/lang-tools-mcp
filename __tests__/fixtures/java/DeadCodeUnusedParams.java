package com.example;

import java.util.List;
import java.util.ArrayList;

public class DeadCodeUnusedParams {

    // Normal method with unused parameter
    public void processData(String data, int unusedParam) {
        System.out.println(data);
    }

    // All parameters used
    public int add(int a, int b) {
        return a + b;
    }

    // Multiple unused parameters
    public void multipleUnused(String used, int unused1, double unused2) {
        System.out.println(used);
    }

    // No parameters
    public void noParams() {
        System.out.println("hello");
    }

    // Abstract method in non-abstract class (interface-like) - should skip
    // We'll test with @Override instead

    // Override method - should skip
    @Override
    public String toString() {
        return "DeadCodeUnusedParams";
    }

    // main method - should skip
    public static void main(String[] args) {
        System.out.println("main");
    }

    // Constructor with unused parameter
    public DeadCodeUnusedParams(String name, int unusedConstructorParam) {
        System.out.println(name);
    }

    // Parameter used in nested expression
    public List<String> wrapInList(String item) {
        List<String> list = new ArrayList<>();
        list.add(item);
        return list;
    }

    // Parameter shadowed by local variable - the parameter itself is unused
    public void shadowedParam(String value) {
        String value2 = "local";
        System.out.println(value2);
    }
}
