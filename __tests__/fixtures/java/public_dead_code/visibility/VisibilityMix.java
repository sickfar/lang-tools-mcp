public class VisibilityMix {
    public int publicField = 1;
    protected int protectedField = 2;
    int packagePrivateField = 3;
    private int privateField = 4;

    public void publicMethod() {}
    protected void protectedMethod() {}
    void packagePrivateMethod() {}
    private void privateMethod() {}
}
