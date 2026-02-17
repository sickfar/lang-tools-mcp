import java.util.List;
import java.util.ArrayList;
import java.util.function.Function;
import java.util.logging.Logger;

class ServiceProcessor {
    private static final Logger logger = Logger.getLogger("ServiceProcessor");
    private String unusedConfig = "default";
    private static int count;

    static {
        count = 0;
    }

    private boolean validate(String item) {
        return item != null && !item.isEmpty();
    }

    private void unusedHelper() {
        System.out.println("never called");
    }

    private String transform(String input) {
        return input.toUpperCase();
    }

    public void processItems(List<String> items, int mode) {
        logger.info("Processing");
        count++;

        List<String> valid = items.stream().filter(x -> validate(x)).toList();

        Function<String, String> fn = this::transform;

        String unusedLocal = "temp";

        int a = 1;
        int b = 2;
        System.out.println(a);

        try {
            fn.apply(valid.get(0));
        } catch (Exception e) {
            logger.warning("error");
        }

        items.forEach(item -> {});
    }

    public void compute(String data, int unusedMode) {
        System.out.println(data);
    }
}

class OuterWithInner {
    private String outerData = "data";
    private String sharedName = "shared";

    public void outerMethod() {
        System.out.println(sharedName);
    }

    private void outerPrivateHelper() {
        System.out.println("outer helper");
    }

    class InnerWorker {
        private int innerUnused = 0;

        public void doWork() {
            System.out.println(outerData);
            outerPrivateHelper();
        }
    }
}

class OverloadedMethods {
    private String process(String s) {
        return s.trim();
    }

    private int process(int n) {
        return n * 2;
    }

    public void run() {
        System.out.println(process("hello"));
    }
}
