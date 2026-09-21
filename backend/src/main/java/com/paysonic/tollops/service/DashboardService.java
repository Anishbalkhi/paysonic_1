package com.paysonic.tollops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

@Service
public class DashboardService {

    private final ObjectMapper objectMapper;

    public DashboardService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public JsonNode getDashboardData() {
        try {
            ClassPathResource resource = new ClassPathResource("data/home.json");
            if (resource.exists()) {
                try (InputStream is = resource.getInputStream()) {
                    return objectMapper.readTree(is);
                }
            }
        } catch (Exception ignored) {}

        // Fallback default structure
        return objectMapper.createObjectNode()
                .put("status", "healthy")
                .put("uptime", "99.98%");
    }
}
