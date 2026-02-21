import java.io.Serializable;

public class SerializableImpl implements Serializable {
    private static final long serialVersionUID = 1L;

    public void readObject(java.io.ObjectInputStream in) throws Exception {}
    public void writeObject(java.io.ObjectOutputStream out) throws Exception {}
    public void unusedPublic() {}
}
