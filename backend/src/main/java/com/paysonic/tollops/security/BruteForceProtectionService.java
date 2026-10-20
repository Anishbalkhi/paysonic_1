package com.paysonic.tollops.security;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enterprise Brute-Force Attack Protection Service
 * Defends authentication endpoints against credential stuffing, dictionary attacks,
 * and distributed brute-force attacks.
 * Tracks failed login attempts per account identifier (email/username) and per client IP.
 * Enforces a strict 5-attempt limit with a 15-minute security lockout.
 */
@Service
public class BruteForceProtectionService {

    public static final int MAX_FAILED_ATTEMPTS = 5;
    public static final long LOCKOUT_DURATION_MS = 15 * 60 * 1000L; // 15 minutes in milliseconds
    public static final long ATTEMPT_WINDOW_MS = 15 * 60 * 1000L;   // Window for tracking attempts

    public static class AttemptTracker {
        private int count = 0;
        private long firstAttemptTime = 0;
        private long lastAttemptTime = 0;
        private long lockedUntil = 0;

        public synchronized void increment(long now) {
            // Reset if past the attempt window and not currently locked
            if (lockedUntil == 0 && (now - lastAttemptTime > ATTEMPT_WINDOW_MS)) {
                count = 0;
                firstAttemptTime = now;
            }
            if (count == 0) {
                firstAttemptTime = now;
            }
            count++;
            lastAttemptTime = now;

            if (count >= MAX_FAILED_ATTEMPTS) {
                lockedUntil = now + LOCKOUT_DURATION_MS;
            }
        }

        public synchronized boolean isLocked(long now) {
            if (lockedUntil == 0) {
                return false;
            }
            if (now > lockedUntil) {
                // Lockout period expired - reset
                count = 0;
                lockedUntil = 0;
                return false;
            }
            return true;
        }

        public synchronized long getRemainingLockoutSeconds(long now) {
            if (lockedUntil <= now) {
                return 0;
            }
            return (long) Math.ceil((double) (lockedUntil - now) / 1000.0);
        }

        public synchronized int getCount(long now) {
            if (lockedUntil == 0 && (now - lastAttemptTime > ATTEMPT_WINDOW_MS)) {
                count = 0;
            }
            return count;
        }

        public synchronized void reset() {
            count = 0;
            firstAttemptTime = 0;
            lastAttemptTime = 0;
            lockedUntil = 0;
        }
    }

    public static class AttemptStatus {
        private final boolean locked;
        private final int attempts;
        private final int remainingAttempts;
        private final long lockoutSeconds;
        private final String message;

        public AttemptStatus(boolean locked, int attempts, int remainingAttempts, long lockoutSeconds, String message) {
            this.locked = locked;
            this.attempts = attempts;
            this.remainingAttempts = remainingAttempts;
            this.lockoutSeconds = lockoutSeconds;
            this.message = message;
        }

        public boolean isLocked() { return locked; }
        public int getAttempts() { return attempts; }
        public int getRemainingAttempts() { return remainingAttempts; }
        public long getLockoutSeconds() { return lockoutSeconds; }
        public String getMessage() { return message; }
    }

    private final Map<String, AttemptTracker> accountTrackers = new ConcurrentHashMap<>();
    private final Map<String, AttemptTracker> ipTrackers = new ConcurrentHashMap<>();

    private String normalizeIdentifier(String identifier) {
        return (identifier != null) ? identifier.trim().toLowerCase() : "unknown";
    }

    /**
     * Checks if the account identifier or client IP is currently locked out.
     */
    public boolean isLockedOut(String identifier, String clientIp) {
        long now = System.currentTimeMillis();
        String idKey = normalizeIdentifier(identifier);

        AttemptTracker accountTracker = accountTrackers.get(idKey);
        if (accountTracker != null && accountTracker.isLocked(now)) {
            return true;
        }

        if (clientIp != null) {
            AttemptTracker ipTracker = ipTrackers.get(clientIp);
            if (ipTracker != null && ipTracker.isLocked(now)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns remaining lockout seconds across account and client IP.
     */
    public long getRemainingLockoutSeconds(String identifier, String clientIp) {
        long now = System.currentTimeMillis();
        String idKey = normalizeIdentifier(identifier);
        long accountRemaining = 0;
        long ipRemaining = 0;

        AttemptTracker accountTracker = accountTrackers.get(idKey);
        if (accountTracker != null) {
            accountRemaining = accountTracker.getRemainingLockoutSeconds(now);
        }

        if (clientIp != null) {
            AttemptTracker ipTracker = ipTrackers.get(clientIp);
            if (ipTracker != null) {
                ipRemaining = ipTracker.getRemainingLockoutSeconds(now);
            }
        }

        return Math.max(accountRemaining, ipRemaining);
    }

    /**
     * Returns the remaining attempts before lockout (minimum between account and IP).
     */
    public int getRemainingAttempts(String identifier, String clientIp) {
        long now = System.currentTimeMillis();
        String idKey = normalizeIdentifier(identifier);

        int accountCount = 0;
        AttemptTracker accountTracker = accountTrackers.get(idKey);
        if (accountTracker != null) {
            accountCount = accountTracker.getCount(now);
        }

        int ipCount = 0;
        if (clientIp != null) {
            AttemptTracker ipTracker = ipTrackers.get(clientIp);
            if (ipTracker != null) {
                ipCount = ipTracker.getCount(now);
            }
        }

        int maxUsed = Math.max(accountCount, ipCount);
        return Math.max(0, MAX_FAILED_ATTEMPTS - maxUsed);
    }

    /**
     * Records a failed login attempt and calculates lockout status.
     */
    public AttemptStatus recordFailedAttempt(String identifier, String clientIp) {
        long now = System.currentTimeMillis();
        String idKey = normalizeIdentifier(identifier);

        AttemptTracker accTracker = accountTrackers.computeIfAbsent(idKey, k -> new AttemptTracker());
        accTracker.increment(now);

        AttemptTracker ipTracker = null;
        if (clientIp != null && !clientIp.isBlank()) {
            ipTracker = ipTrackers.computeIfAbsent(clientIp, k -> new AttemptTracker());
            ipTracker.increment(now);
        }

        boolean isLocked = accTracker.isLocked(now) || (ipTracker != null && ipTracker.isLocked(now));
        long lockoutSec = Math.max(
                accTracker.getRemainingLockoutSeconds(now),
                ipTracker != null ? ipTracker.getRemainingLockoutSeconds(now) : 0
        );

        int used = Math.max(accTracker.getCount(now), ipTracker != null ? ipTracker.getCount(now) : 0);
        int remaining = Math.max(0, MAX_FAILED_ATTEMPTS - used);

        String message;
        if (isLocked) {
            long mins = (lockoutSec + 59) / 60;
            message = "Account locked due to " + MAX_FAILED_ATTEMPTS + " consecutive failed login attempts. Please try again in " + mins + " minutes.";
        } else {
            message = "Invalid credentials. " + remaining + " attempt" + (remaining == 1 ? "" : "s") + " remaining before security lockout.";
        }

        return new AttemptStatus(isLocked, used, remaining, lockoutSec, message);
    }

    /**
     * Clears failed attempt counters upon a successful authentication.
     */
    public void recordSuccess(String identifier, String clientIp) {
        String idKey = normalizeIdentifier(identifier);
        AttemptTracker accTracker = accountTrackers.get(idKey);
        if (accTracker != null) {
            accTracker.reset();
        }

        if (clientIp != null) {
            AttemptTracker ipTracker = ipTrackers.get(clientIp);
            if (ipTracker != null) {
                ipTracker.reset();
            }
        }
    }

    /**
     * Explicit unlock by an administrator.
     */
    public void unlock(String identifier) {
        String idKey = normalizeIdentifier(identifier);
        accountTrackers.remove(idKey);
    }

    /**
     * Unlock by client IP.
     */
    public void unlockIp(String clientIp) {
        if (clientIp != null) {
            ipTrackers.remove(clientIp);
        }
    }
}
