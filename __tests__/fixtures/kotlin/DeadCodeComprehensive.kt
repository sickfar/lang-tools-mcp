package com.example.service

// --- DataService: tests many patterns in one class ---
class DataService(val name: String) {
    private val logger = Logger.getLogger("DataService")       // used in processItems -> NOT flagged
    private val unusedConfig = mapOf("key" to "value")         // never used -> FLAGGED
    private var initialized = false                            // set in init, used in isReady -> NOT flagged
    private var _cache: String? = null                         // used in custom getter below -> NOT flagged

    val cache: String get() = _cache ?: "default"

    init {
        initialized = true
    }

    fun isReady(): Boolean = initialized

    fun processItems(items: List<String>, unusedFlag: Boolean) {  // unusedFlag -> FLAGGED
        val validItems = items.filter { validate(it) }            // validate called from lambda -> NOT flagged
        val unusedCount = 0                                       // never used -> FLAGGED
        val transformed = validItems.map(::transform)             // transform via callable ref -> NOT flagged
        logger.info("Processed ${transformed.size} items")
    }

    fun iterateItems(items: List<String>) {
        items.forEach { item -> println("processing") }          // lambda param item -> NOT flagged (invisible)
    }

    private fun validate(value: String): Boolean {
        return value.isNotBlank()
    }

    private fun transform(value: String): String {
        return value.trim().uppercase()
    }

    private fun unusedHelper(): String {                          // never called -> FLAGGED
        return "help"
    }
}

// --- OuterWithInner: scope boundary tests ---
class OuterWithInner {
    private val outerData = "data"                               // used only in Inner -> FLAGGED
    private val sharedName = "shared"                            // used in outerMethod -> NOT flagged

    fun outerMethod() {
        println(sharedName)
    }

    private fun outerPrivateHelper() {                           // called only from Inner -> FLAGGED
        println("helper")
    }

    inner class Inner {
        private val unusedInnerProp = 123                        // never used -> FLAGGED

        fun innerWork() {
            println(outerData)
            outerPrivateHelper()
        }
    }
}

// --- WithCompanion: companion object scoping ---
class WithCompanion {
    companion object {
        private fun create(): WithCompanion {                    // called by build -> NOT flagged
            return WithCompanion()
        }

        private fun unusedCompanionFun() {}                      // never called -> FLAGGED

        fun build(): WithCompanion {
            return create()
        }
    }
}

// --- Data class: all properties skipped ---
data class UserDto(val id: Long, val username: String, val email: String)

// --- Delegated properties: skipped ---
class DelegatedProps {
    private val lazyValue by lazy { "computed" }
}
