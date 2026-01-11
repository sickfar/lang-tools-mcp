package com.example;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

public class AllUsedImports {
    private List<String> items = new ArrayList<>();
    private Map<String, String> config = new HashMap<>();

    public void configure(String key, String value) {
        config.put(key, value);
    }
}
