public class HasFindings {
    public void unusedMethod() {}

    public void run() {
        // uses NoFindings.helper so that file has no dead code
        new NoFindings().helper();
    }
}
