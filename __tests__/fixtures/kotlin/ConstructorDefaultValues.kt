// Fixture: Constructor default values and inner class companion access patterns
// These patterns should NOT be flagged as dead code

package test.fixtures

import java.time.Duration

// Pattern 1: Companion constants as constructor default values
class HttpClientConfig(
    private val baseUrl: String = DEFAULT_URL,
    private val timeout: Duration = REQUEST_TIMEOUT
) {
    fun getConfig(): String = "$baseUrl:$timeout"

    companion object {
        private const val DEFAULT_URL = "https://api.service.io"
        private val REQUEST_TIMEOUT: Duration = Duration.ofSeconds(30)
    }
}

// Pattern 2: Inner class accessing companion object members
class TestSuite {
    companion object {
        private const val TEST_TABLE_DDL = "CREATE TABLE test(id INT)"
        private fun setupDatabase() = println("Setting up database")
    }

    fun runAll() = Unit

    inner class TableTests {
        fun setup() {
            execute(TEST_TABLE_DDL)
            setupDatabase()
        }
        private fun execute(sql: String) = println(sql)
    }
}

// Pattern 3: Private method called in constructor default value
class ConfigFactory(
    private val config: Map<String, String> = createDefaultConfig()
) {
    companion object {
        private fun createDefaultConfig(): Map<String, String> = mapOf("key" to "value")
    }
}

// Negative case: unused companion member (SHOULD be flagged)
class UnusedCompanionMember {
    companion object {
        private const val TRULY_UNUSED = "never_referenced"
    }

    fun process() = println("working")
}
