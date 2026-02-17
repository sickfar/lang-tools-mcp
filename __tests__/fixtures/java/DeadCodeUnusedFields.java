package com.example;

public class DeadCodeUnusedFields {

    private String usedField = "hello";
    private int unusedField = 42;
    private static final long serialVersionUID = 1L;
    public String publicField = "pub";

    public void process() {
        System.out.println(usedField);
    }
}
