public class OverrideClass {
    @Override
    public String toString() { return "OverrideClass"; }

    @Override
    public boolean equals(Object obj) { return false; }

    public int compareTo(Object o) { return 0; }
}
