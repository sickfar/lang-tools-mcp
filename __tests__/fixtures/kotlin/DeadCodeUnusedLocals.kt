package com.example

class DeadCodeUnusedLocals {

    val classField = "field"

    fun processData() {
        val used = "hello"
        var unused = 42
        println(used)
    }

    fun allUsed() {
        val a = 1
        val b = 2
        println(a + b)
    }

    fun multipleUnused() {
        val used = "hello"
        var unused1 = 1
        val unused2 = 2.0
        println(used)
    }

    fun withForLoop() {
        for (i in 0..10) {
            println(i)
        }
    }

    fun noLocals() {
        println("hello")
    }
}
