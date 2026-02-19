package com.example

class DeadCodeUnusedParams {

    // Normal method with unused parameter
    fun processData(data: String, unusedParam: Int) {
        println(data)
    }

    // All parameters used
    fun add(a: Int, b: Int): Int {
        return a + b
    }

    // Multiple unused parameters
    fun multipleUnused(used: String, unused1: Int, unused2: Double) {
        println(used)
    }

    // Override method - should skip
    override fun toString(): String {
        return "DeadCodeUnusedParams"
    }

    // _ parameter name - should skip
    fun handleEvent(_: String, data: Int) {
        println(data)
    }

    // No parameters
    fun noParams() {
        println("hello")
    }

    // Constructor with unused parameter - tested via class with primary constructor
}

// Extension function with unused parameter
fun String.process(unusedExtParam: Int) {
    println(this)
}

// Top-level function with unused parameter
fun topLevel(used: String, unusedTop: Int) {
    println(used)
}

// Class with primary constructor unused parameter
class WithConstructor(val name: String, unusedCtorParam: Int) {
    fun greet() {
        println(name)
    }
}

// Parameter used only in $name string template - should NOT be flagged
fun greetWithTemplate(greeting: String) {
    println("$greeting World")
}
