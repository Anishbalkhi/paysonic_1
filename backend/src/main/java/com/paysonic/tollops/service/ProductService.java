package com.paysonic.tollops.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;

@Service
public class ProductService {

    private final ObjectMapper objectMapper;

    public ProductService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public JsonNode getProductDetails(String id) {
        try {
            ClassPathResource resource = new ClassPathResource("data/productDetail.json");
            if (resource.exists()) {
                try (InputStream is = resource.getInputStream()) {
                    return objectMapper.readTree(is);
                }
            }
        } catch (Exception ignored) {}

        return objectMapper.createObjectNode()
                .put("productId", id)
                .put("status", "Active");
    }
}
