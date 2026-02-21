import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;

@Service
public class SpringService {
    @Autowired
    private String dependency;

    @Bean
    public String configuredBean() {
        return "bean";
    }

    public void unusedMethod() {}
}
