package com.paysonic.tollops.security;

import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enterprise Rate Limiter Service
 * Implements a high-precision sliding-window rate limiter per client IP.
 * Enforces strict thresholds on sensitive authentication routes while allowing
 * standard operational throughput on general API endpoints.
 */
@Service
public class RateLimiterService {

    // Rate limit configuration constants
    public static final int AUTH_LIMIT_PER_MINUTE = 15;     // 15 req/min for /api/auth/** & sensitive routes
    public static final int GENERAL_LIMIT_PER_MINUTE = 120; // 120 req/min for general /api/** routes
    public static final long WINDOW_MS = 60_000L;          // 60-second sliding window

    // IP -> Deque of timestamps (epoch millis)
    private final Map<String, Deque<Long>> authRequestWindows = new ConcurrentHashMap<>();
    private final Map<String, Deque<Long>> generalRequestWindows = new ConcurrentHashMap<>();

    private long lastCleanupTime = System.currentTimeMillis();

    /**
     * Rate limit inspection result
     */
    public static class RateLimitResult {
        private final boolean allowed;
        private final int limit;
        private final int remaining;
        private final long resetSeconds;
        private final long retryAfterSeconds;

        public RateLimitResult(boolean allowed, int limit, int remaining, long resetSeconds, long retryAfterSeconds) {
            this.allowed = allowed;
            this.limit = limit;
            this.remaining = remaining;
            this.resetSeconds = resetSeconds;
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public boolean isAllowed() { return allowed; }
        public int getLimit() { return limit; }
        public int getRemaining() { return remaining; }
        public long getResetSeconds() { return resetSeconds; }
        public long getRetryAfterSeconds() { return retryAfterSeconds; }
    }

    /**
     * Checks if a request from the given client IP to the given path is allowed.
     */
    public synchronized RateLimitResult checkLimit(String clientIp, String path) {
        long now = System.currentTimeMillis();
        maybeCleanupExpiredRecords(now);

        boolean isAuthRoute = isSensitiveAuthRoute(path);
        int maxLimit = isAuthRoute ? AUTH_LIMIT_PER_MINUTE : GENERAL_LIMIT_PER_MINUTE;
        Map<String, Deque<Long>> targetMap = isAuthRoute ? authRequestWindows : generalRequestWindows;

        Deque<Long> timestamps = targetMap.computeIfAbsent(clientIp, k -> new ArrayDeque<>());

        // Evict timestamps older than the 60-second window
        long windowStart = now - WINDOW_MS;
        while (!timestamps.isEmpty() && timestamps.peekFirst() <= windowStart) {
            timestamps.pollFirst();
        }

        int currentCount = timestamps.size();
        if (currentCount >= maxLimit) {
            // Rate limit exceeded!
            Long oldestTimestamp = timestamps.peekFirst();
            long retryAfterMs = (oldestTimestamp != null) ? Math.max(1000L, (oldestTimestamp + WINDOW_MS) - now) : 1000L;
            long retryAfterSec = (long) Math.ceil((double) retryAfterMs / 1000.0);
            long resetSec = retryAfterSec;

            return new RateLimitResult(false, maxLimit, 0, resetSec, retryAfterSec);
        }

        // Allowed - record current timestamp
        timestamps.addLast(now);
        int remaining = maxLimit - (currentCount + 1);

        Long oldestTimestamp = timestamps.peekFirst();
        long resetMs = (oldestTimestamp != null) ? Math.max(1000L, (oldestTimestamp + WINDOW_MS) - now) : 60000L;
        long resetSec = (long) Math.ceil((double) resetMs / 1000.0);

        return new RateLimitResult(true, maxLimit, remaining, resetSec, 0);
    }

    /**
     * Identifies high-risk / sensitive authentication paths.
     */
    public boolean isSensitiveAuthRoute(String path) {
        if (path == null) return false;
        String lower = path.toLowerCase();
        return lower.startsWith("/api/auth") ||
               lower.contains("change-password") ||
               lower.contains("login") ||
               lower.endsWith("/lock");
    }

    /**
     * Clean up inactive IPs periodically (every 5 minutes) to prevent memory leak.
     */
    private void maybeCleanupExpiredRecords(long now) {
        if (now - lastCleanupTime < 300_000L) {
            return;
        }
        lastCleanupTime = now;
        long windowStart = now - WINDOW_MS;

        authRequestWindows.entrySet().removeIf(entry -> {
            Deque<Long> deque = entry.getValue();
            while (!deque.isEmpty() && deque.peekFirst() <= windowStart) {
                deque.pollFirst();
            }
            return deque.isEmpty();
        });

        generalRequestWindows.entrySet().removeIf(entry -> {
            Deque<Long> deque = entry.getValue();
            while (!deque.isEmpty() && deque.peekFirst() <= windowStart) {
                deque.pollFirst();
            }
            return deque.isEmpty();
        });
    }

    /**
     * Clear limits for testing or admin whitelisting.
     */
    public synchronized void resetLimitsForIp(String clientIp) {
        authRequestWindows.remove(clientIp);
        generalRequestWindows.remove(clientIp);
    }
}
