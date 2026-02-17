package com.example

class DeadCodeUnusedMethods {

    private fun usedMethod() {
        println("used")
    }

    private fun unusedMethod() {
        println("unused")
    }

    private fun usedViaReference() {
        println("ref")
    }

    fun publicMethod() {
        println("public")
    }

    fun process() {
        usedMethod()
        val ref = ::usedViaReference
    }
}
