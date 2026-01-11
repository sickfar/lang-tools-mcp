package com.example

import java.util.ArrayList as MyList
import java.util.HashMap as MyMap
import java.util.Set as MySet

class AliasedImports {
    private val items = MyList<String>()

    fun addItem(item: String) {
        items.add(item)
    }
}
