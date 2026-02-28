package extensionfunctions

// Used extension function - called in ExtensionUsers.kt
fun String.toTitleCase(): String {
    return this.split(" ").joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
}

// Unused extension function - never called anywhere
fun String.toSnakeCase(): String {
    return this.replace(" ", "_").lowercase()
}

// Used extension property - accessed in ExtensionUsers.kt
val String.wordCount: Int
    get() = this.split(" ").size

// Unused extension property - never accessed anywhere
val String.isBlankOrEmpty: Boolean
    get() = this.isBlank() || this.isEmpty()
