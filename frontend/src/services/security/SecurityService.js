import httpClient from '../api/httpClient';

const SECURITY_STORAGE_KEY = 'paysonic_login_security_status';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class SecurityService {
  _getStorage() {
    try {
      const data = localStorage.getItem(SECURITY_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  _setStorage(data) {
    try {
      localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }

  /**
   * Checks client-side and server-side lockout status.
   */
  async checkLockout(identifier) {
    const key = (identifier || 'global').trim().toLowerCase();
    const store = this._getStorage();
    const now = Date.now();
    const entry = store[key] || {};

    let isLocalLocked = false;
    let localRemainingSec = 0;

    if (entry.lockedUntil && entry.lockedUntil > now) {
      isLocalLocked = true;
      localRemainingSec = Math.ceil((entry.lockedUntil - now) / 1000);
    } else if (entry.lockedUntil && entry.lockedUntil <= now) {
      // Cooldown completed - reset local lock
      delete entry.lockedUntil;
      entry.attempts = 0;
      store[key] = entry;
      this._setStorage(store);
    }

    // Attempt live server status check
    try {
      const res = await httpClient.get('/api/auth/lockout-status', {
        params: { identifier: key },
        timeout: 4000,
      });

      if (res && res.data) {
        const serverLocked = Boolean(res.data.locked);
        const serverRemainingSec = parseInt(res.data.remainingSeconds, 10) || 0;
        const remainingAttempts =
          res.data.remainingAttempts !== undefined
            ? res.data.remainingAttempts
            : Math.max(0, MAX_ATTEMPTS - (entry.attempts || 0));

        const isLocked = isLocalLocked || serverLocked;
        const remainingSec = Math.max(localRemainingSec, serverRemainingSec);

        if (serverLocked && (!entry.lockedUntil || entry.lockedUntil < now + serverRemainingSec * 1000)) {
          entry.lockedUntil = now + serverRemainingSec * 1000;
          entry.attempts = MAX_ATTEMPTS;
          store[key] = entry;
          this._setStorage(store);
        }

        return {
          isLocked,
          remainingSeconds: remainingSec,
          remainingAttempts: isLocked ? 0 : remainingAttempts,
          attempts: entry.attempts || 0,
        };
      }
    } catch (err) {
      // If server unreachable, use local security state
    }

    const remainingAttempts = isLocalLocked ? 0 : Math.max(0, MAX_ATTEMPTS - (entry.attempts || 0));
    return {
      isLocked: isLocalLocked,
      remainingSeconds: localRemainingSec,
      remainingAttempts,
      attempts: entry.attempts || 0,
    };
  }

  /**
   * Records a failed login attempt on client side.
   */
  recordFailedAttempt(identifier) {
    const key = (identifier || 'global').trim().toLowerCase();
    const store = this._getStorage();
    const now = Date.now();
    const entry = store[key] || { attempts: 0 };

    // Reset attempts if previous attempt was older than 15 minutes and not locked
    if (!entry.lockedUntil && entry.lastAttempt && now - entry.lastAttempt > LOCKOUT_DURATION_MS) {
      entry.attempts = 0;
    }

    entry.attempts = (entry.attempts || 0) + 1;
    entry.lastAttempt = now;

    if (entry.attempts >= MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    }

    store[key] = entry;
    this._setStorage(store);

    const isLocked = Boolean(entry.lockedUntil && entry.lockedUntil > now);
    const remainingSeconds = isLocked ? Math.ceil((entry.lockedUntil - now) / 1000) : 0;
    const remainingAttempts = Math.max(0, MAX_ATTEMPTS - entry.attempts);

    return {
      isLocked,
      remainingSeconds,
      remainingAttempts,
      attempts: entry.attempts,
    };
  }

  /**
   * Resets failed attempt counter upon successful login.
   */
  recordSuccess(identifier) {
    const key = (identifier || 'global').trim().toLowerCase();
    const store = this._getStorage();
    if (store[key]) {
      delete store[key];
      this._setStorage(store);
    }
    // Also clear general key
    if (store['global']) {
      delete store['global'];
      this._setStorage(store);
    }
  }

  /**
   * Explicitly unlocks an account.
   */
  async unlock(identifier) {
    const key = (identifier || '').trim().toLowerCase();
    const store = this._getStorage();
    if (key && store[key]) {
      delete store[key];
      this._setStorage(store);
    }

    try {
      await httpClient.post('/api/auth/unlock', { identifier: key });
    } catch {}
  }

  /**
   * Formats seconds into MM:SS format.
   */
  formatCooldown(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '00:00';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

export default new SecurityService();
