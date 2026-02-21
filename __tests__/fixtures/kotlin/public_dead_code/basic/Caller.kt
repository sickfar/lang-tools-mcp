class Caller {
    fun run() {
        val callee = Callee()
        callee.usedFun()
        val x = callee.usedProp
    }
}
