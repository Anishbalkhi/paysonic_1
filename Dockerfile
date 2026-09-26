# ─── Stage 1: Build JAR with Maven ─────────────────────────
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Cache Maven dependencies
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy source code and package application
COPY backend/src ./src
RUN mvn clean package -DskipTests -B

# ─── Stage 2: Minimal Runtime Image ────────────────────────
FROM eclipse-temurin:21-jre-alpine

LABEL maintainer="Paysonic Technologies Pvt. Ltd."
LABEL description="Paysonic Toll Ops Platform - Backend API"

WORKDIR /app

# Copy the built JAR from builder stage to both app.jar and target/ directory
RUN mkdir -p /app/target
COPY --from=builder /build/target/paysonic-tollops-backend-1.0.0-enterprise.jar /app/app.jar
COPY --from=builder /build/target/paysonic-tollops-backend-1.0.0-enterprise.jar /app/target/paysonic-tollops-backend-1.0.0-enterprise.jar

# Expose Spring Boot port
EXPOSE 8080

# Run Spring Boot
ENTRYPOINT ["java", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
