public class Callee {
    public int usedField = 1;
    public int unusedField = 2;

    public void usedMethod() {
        System.out.println("used");
    }

    public void unusedMethod() {
        System.out.println("unused");
    }
}
