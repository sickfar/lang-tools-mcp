class InternalDeclarations {
    internal fun usedInternal() {
        println("used")
    }

    internal fun unusedInternal() {
        println("unused")
    }

    internal val unusedProp: String = "unused"

    private fun privateMethod() {}
}
