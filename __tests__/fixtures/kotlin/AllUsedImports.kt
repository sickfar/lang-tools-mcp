package com.example

import java.util.List
import java.util.ArrayList
import java.util.Map
import java.util.HashMap

class AllUsedImports {
    private val items: MutableList<String> = ArrayList()
    private val config: MutableMap<String, String> = HashMap()

    fun configure(key: String, value: String) {
        config[key] = value
    }
}
