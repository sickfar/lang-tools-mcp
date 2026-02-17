package com.example;

public class DeadCodeUnusedMethods {

    private void usedMethod() {
        System.out.println("used");
    }

    private void unusedMethod() {
        System.out.println("unused");
    }

    private void usedViaReference() {
        System.out.println("ref");
    }

    public void publicMethod() {
        System.out.println("public");
    }

    protected void protectedMethod() {
        System.out.println("protected");
    }

    public void process() {
        usedMethod();
        Runnable r = this::usedViaReference;
    }
}
