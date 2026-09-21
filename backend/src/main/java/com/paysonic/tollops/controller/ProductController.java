package com.paysonic.tollops.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.paysonic.tollops.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@CrossOrigin(origins = "*")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<JsonNode> getProductDetails(@PathVariable String id) {
        return ResponseEntity.ok(productService.getProductDetails(id));
    }
}
