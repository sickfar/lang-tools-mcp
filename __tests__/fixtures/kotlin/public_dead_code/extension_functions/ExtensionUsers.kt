package extensionfunctions

class ExtensionUser {
    fun demo() {
        val title = "hello world".toTitleCase()
        val words = title.wordCount
        println("$title has $words words")
    }
}
