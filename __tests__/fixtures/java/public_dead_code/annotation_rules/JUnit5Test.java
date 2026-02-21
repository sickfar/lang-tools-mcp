import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;

public class JUnit5Test {
    @BeforeEach
    public void setup() {}

    @Test
    public void testSomething() {}

    @AfterEach
    public void teardown() {}

    public void unusedHelper() {}
}
