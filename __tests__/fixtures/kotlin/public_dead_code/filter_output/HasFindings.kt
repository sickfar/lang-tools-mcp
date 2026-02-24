class HasFindings {
    fun unusedFun() {}

    fun run() {
        // uses NoFindings.helper so that file has no dead code
        NoFindings().helper()
    }
}
