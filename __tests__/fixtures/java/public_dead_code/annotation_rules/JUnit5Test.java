import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.platform.suite.api.Suite;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.TestFactory;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Tag;

public class JUnit5Test {
    @BeforeEach
    public void setup() {}

    @Test
    public void testSomething() {}

    @AfterEach
    public void teardown() {}

    @BeforeAll
    public static void setupAll() {}

    @AfterAll
    public static void teardownAll() {}

    @ParameterizedTest
    public void parameterizedTest() {}

    @TestFactory
    public void testFactory() {}

    @RepeatedTest(3)
    public void repeatedTest() {}

    @Tag("unit")
    public void taggedTest() {}

    @ExtendWith(Object.class)
    public void withExtension() {}

    @Nested
    public class NestedTests {}

    public void unusedHelper() {}
}

@Suite
class JUnit5Suite {}
