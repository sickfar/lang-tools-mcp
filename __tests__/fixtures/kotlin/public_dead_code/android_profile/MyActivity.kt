class MyActivity {
    fun onCreate(savedInstanceState: Any?) {
        println("created")
    }

    fun onDestroy() {
        println("destroyed")
    }

    fun onResume() {
        println("resumed")
    }

    fun customHelper() {
        println("custom")
    }
}
