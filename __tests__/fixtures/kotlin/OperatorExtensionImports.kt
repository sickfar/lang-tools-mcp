package com.example

// Imports used implicitly through operator conventions — never appear as identifiers

// by delegation
import com.example.delegates.getValue
import com.example.delegates.setValue
import com.example.delegates.provideDelegate

// for-loop iteration
import com.example.collections.iterator
import com.example.collections.hasNext
import com.example.collections.next

// destructuring
import com.example.pairs.component1
import com.example.pairs.component2

// indexed access
import com.example.maps.get
import com.example.maps.set

// arithmetic operators
import com.example.math.plus
import com.example.math.minus

// --- Explicit import used normally (should still be kept) ---
import java.util.ArrayList

class OperatorExtensionImportsExample {

    // by delegation — calls getValue / setValue implicitly
    var delegated: String by SomeDelegateClass()

    fun useAll() {
        val items = ArrayList<String>()

        // for loop — calls iterator() / hasNext() / next() implicitly
        for (item in items) {
            println(item)
        }

        // destructuring — calls component1() / component2() implicitly
        val pair = Pair("a", 1)
        val (first, second) = pair
        println("$first $second")

        // indexed access — calls get() / set() implicitly
        val map = mutableMapOf<String, Int>()
        val value = map["key"]
        map["key"] = 42

        // arithmetic — calls plus() / minus() implicitly
        val a = SomeClass()
        val b = SomeClass()
        val c = a + b
        val d = a - b
        println("$c $d $value")
    }
}
