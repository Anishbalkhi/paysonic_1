package com.paysonic.tollops.aspect;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Set;

public class SecretFilterUtil {

    private static final Set<String> SENSITIVE_KEYS = Set.of(
        "password", "secret", "token", "apikey", "pin", "cvv", "accesstoken", "refreshtoken"
    );

    public static String sanitizeJson(String json, ObjectMapper objectMapper) {
        if (json == null || json.isBlank()) return null;
        try {
            JsonNode root = objectMapper.readTree(json);
            if (root.isObject()) {
                sanitizeNode((ObjectNode) root);
                return objectMapper.writeValueAsString(root);
            }
            return json;
        } catch (Exception e) {
            return json;
        }
    }

    private static void sanitizeNode(ObjectNode node) {
        node.fieldNames().forEachRemaining(field -> {
            if (SENSITIVE_KEYS.contains(field.toLowerCase())) {
                node.put(field, "********");
            } else if (node.get(field).isObject()) {
                sanitizeNode((ObjectNode) node.get(field));
            }
        });
    }
}
