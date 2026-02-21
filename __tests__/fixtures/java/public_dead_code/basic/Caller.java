public class Caller {
    public void run() {
        Callee callee = new Callee();
        callee.usedMethod();
        int x = callee.usedField;
    }
}
