package com.example

import java.util.List
import java.util.ArrayList
import java.util.HashMap
import java.util.Set
import java.io.IOException

class UnusedImports {
    private val items: MutableList<String> = ArrayList()

    fun addItem(item: String) {
        items.add(item)
    }
}
