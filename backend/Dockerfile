FROM eclipse-temurin:21-jre-alpine
LABEL maintainer="Paysonic Technologies Pvt. Ltd."
LABEL description="Paysonic Toll Ops Platform - Backend API"

WORKDIR /app

# Copy the built JAR
COPY target/paysonic-tollops-backend-1.0.0-enterprise.jar app.jar

# Expose Spring Boot port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/dashboard || exit 1

# Run with mysql profile by default; override with -e SPRING_PROFILES_ACTIVE=h2
ENTRYPOINT ["java", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-jar", "app.jar"]
