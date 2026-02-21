class Callee {
    val usedProp: String = "used"
    val unusedProp: String = "unused"

    fun usedFun() {
        println("used")
    }

    fun unusedFun() {
        println("unused")
    }
}
