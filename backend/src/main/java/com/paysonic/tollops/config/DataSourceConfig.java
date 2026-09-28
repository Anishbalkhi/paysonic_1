package com.paysonic.tollops.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
@Profile("mysql")
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Bean
    @Primary
    public DataSource dataSource(Environment env) {
        String rawUrl = env.getProperty("SPRING_DATASOURCE_URL");
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = env.getProperty("MYSQL_URL");
        }
        if (rawUrl == null || rawUrl.isBlank()) {
            rawUrl = env.getProperty("DATABASE_URL");
        }

        String username = env.getProperty("SPRING_DATASOURCE_USERNAME");
        if (username == null || username.isBlank()) {
            username = env.getProperty("MYSQLUSER", env.getProperty("MYSQL_USER"));
        }

        String password = env.getProperty("SPRING_DATASOURCE_PASSWORD");
        if (password == null || password.isBlank()) {
            password = env.getProperty("MYSQLPASSWORD", env.getProperty("MYSQL_PASSWORD"));
        }

        String jdbcUrl;

        if (rawUrl != null && !rawUrl.isBlank()) {
            rawUrl = rawUrl.trim();
            if (rawUrl.startsWith("mysql://")) {
                try {
                    URI uri = new URI(rawUrl);
                    String host = uri.getHost();
                    int port = uri.getPort() > 0 ? uri.getPort() : 3306;
                    String path = uri.getPath();
                    String db = (path != null && path.length() > 1) ? path.substring(1) : "paysonic_tollops";

                    if (uri.getUserInfo() != null && (username == null || username.isBlank())) {
                        String[] parts = uri.getUserInfo().split(":", 2);
                        username = parts[0];
                        if (parts.length > 1 && (password == null || password.isBlank())) {
                            password = parts[1];
                        }
                    }

                    jdbcUrl = String.format("jdbc:mysql://%s:%d/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                            host, port, db);
                } catch (Exception e) {
                    log.warn("Could not parse mysql:// URI, falling back to prefix: {}", e.getMessage());
                    jdbcUrl = "jdbc:" + rawUrl;
                }
            } else if (!rawUrl.startsWith("jdbc:")) {
                jdbcUrl = "jdbc:" + rawUrl;
            } else {
                jdbcUrl = rawUrl;
            }
        } else {
            String host = env.getProperty("MYSQLHOST", env.getProperty("MYSQL_HOST", "localhost"));
            String port = env.getProperty("MYSQLPORT", env.getProperty("MYSQL_PORT", "3306"));
            String db = env.getProperty("MYSQLDATABASE", env.getProperty("MYSQL_DATABASE", "paysonic_tollops"));

            jdbcUrl = String.format("jdbc:mysql://%s:%s/%s?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC",
                    host, port, db);
        }

        if (username == null || username.isBlank()) username = "root";
        if (password == null) password = "";

        log.info("Configured MySQL DataSource pointing to: {}", jdbcUrl.replaceAll("(?i)(password=)[^&;]*", "$1****"));

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        config.setDriverClassName("com.mysql.cj.jdbc.Driver");
        config.setMaximumPoolSize(15);
        config.setMinimumIdle(3);
        config.setConnectionTimeout(20000);
        config.setIdleTimeout(300000);

        return new HikariDataSource(config);
    }
}
