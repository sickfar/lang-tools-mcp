package com.example

class DeadCodeUnusedFields {

    private val usedField = "hello"
    private var unusedField = 42
    val publicField = "pub"

    fun process() {
        println(usedField)
    }
}

data class DataTest(val name: String, val age: Int)

class Delegated {
    private val lazyField by lazy { "value" }
}
