package com.example

import java.io.Serializable

class ImplementsSerializable : Serializable {
    fun getData(): String = "data"
}

class ImplementsRunnable : Runnable {
    override fun run() {}
    fun unusedMethod(): String = ""
}
