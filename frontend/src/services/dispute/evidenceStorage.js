/**
 * Evidence Storage Vault for Paysonic Toll Ops Platform
 *
 * Persistently stores and retrieves attached evidence files (images, PDFs, documents)
 * for both Plaza Counter-Evidence and Acquirer Evidence.
 *
 * Features:
 * - Supports single and multiple file attachments per dispute
 * - Preserves full file payloads (dataUrl base64, size, type, timestamp)
 * - Safe URL validation (prevents '[object Object]' or corrupted URLs from breaking previews)
 * - Multi-key indexing (by disputeId, acqTxnId, and rowId)
 * - Automatic parsing of comma-separated or JSON file names from database records
 */

const STORAGE_VAULT_KEY = 'paysonic_evidence_vault_v1';

/**
 * Checks if a string is a valid media/data URL
 */
export const isValidMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (
    trimmed === '[object Object]' ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === ''
  ) {
    return false;
  }
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:application/pdf') ||
    trimmed.startsWith('data:text/') ||
    trimmed.startsWith('data:application/octet-stream') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  );
};

class EvidenceStorageService {
  constructor() {
    this.memoryCache = new Map();
    this.db = null;
    this.init();
    this.initIndexedDb();
  }

  init() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_VAULT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([key, val]) => {
            this.memoryCache.set(key, val);
          });
        }
      }
    } catch (e) {
      console.warn('[EvidenceStorage] Vault init error:', e);
    }
  }

  initIndexedDb() {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    try {
      const request = window.indexedDB.open('paysonic_evidence_db', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('evidence_files')) {
          db.createObjectStore('evidence_files');
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        // Load all saved files from IndexedDB into memoryCache for fast synchronous lookups
        try {
          const tx = this.db.transaction('evidence_files', 'readonly');
          const store = tx.objectStore('evidence_files');
          const getAllReq = store.openCursor();
          getAllReq.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
              this.memoryCache.set(cursor.key, cursor.value);
              cursor.continue();
            }
          };
        } catch {}
      };
      request.onerror = () => {
        // Fallback silently to memoryCache
      };
    } catch {}
  }

  saveVault() {
    if (typeof window === 'undefined') return;

    // 1. Persist to IndexedDB (virtually unlimited quota for large base64 images)
    if (this.db) {
      try {
        const tx = this.db.transaction('evidence_files', 'readwrite');
        const store = tx.objectStore('evidence_files');
        this.memoryCache.forEach((val, key) => {
          store.put(val, key);
        });
      } catch {}
    }

    // 2. Also attempt localStorage for quick sync, gracefully handling quota limits
    try {
      const obj = {};
      this.memoryCache.forEach((val, key) => {
        obj[key] = val;
      });
      localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(obj));
    } catch {
      // If localStorage is full, IndexedDB + memoryCache safely hold the files
    }
  }

  normalizeKey(key) {
    if (!key) return '';
    return String(key).trim().toLowerCase();
  }

  /**
   * Sanitizes a file item into a uniform structure
   */
  sanitizeFile(item) {
    if (!item) return null;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed || trimmed === '[object Object]') return null;
      return {
        name: trimmed,
        size: 0,
        type: this.guessMimeType(trimmed),
        dataUrl: null,
        url: null,
        uploadedAt: new Date().toISOString(),
      };
    }

    const name = item.name || 'attachment';
    if (name === '[object Object]') return null;

    let validUrl = null;
    if (isValidMediaUrl(item.dataUrl)) {
      validUrl = item.dataUrl;
    } else if (isValidMediaUrl(item.url)) {
      validUrl = item.url;
    }

    return {
      name,
      size: Number(item.size) || 0,
      type: item.type || this.guessMimeType(name),
      dataUrl: validUrl,
      url: validUrl,
      uploadedAt: item.uploadedAt || new Date().toISOString(),
    };
  }

  guessMimeType(name) {
    const lower = String(name || '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.txt') || lower.endsWith('.log')) return 'text/plain';
    if (lower.endsWith('.csv')) return 'text/csv';
    return 'application/octet-stream';
  }

  /**
   * Saves Plaza Counter-Evidence files
   */
  savePlazaEvidence(disputeId, acqTxnId, fileList = []) {
    if (!Array.isArray(fileList)) return;
    const sanitized = fileList.map((f) => this.sanitizeFile(f)).filter(Boolean);

    const keys = [
      this.normalizeKey(disputeId),
      this.normalizeKey(acqTxnId),
    ].filter(Boolean);

    keys.forEach((k) => {
      const existing = this.memoryCache.get(`plaza_${k}`) || [];
      // Merge by file name so existing items are updated/preserved
      const mergedMap = new Map();
      existing.forEach((f) => f && f.name && mergedMap.set(f.name.toLowerCase(), f));
      sanitized.forEach((f) => {
        if (f && f.name) {
          const prev = mergedMap.get(f.name.toLowerCase());
          // Keep previous dataUrl if new one is missing
          if (prev && prev.dataUrl && !f.dataUrl) {
            f.dataUrl = prev.dataUrl;
            f.url = prev.url;
          }
          mergedMap.set(f.name.toLowerCase(), f);
        }
      });
      this.memoryCache.set(`plaza_${k}`, Array.from(mergedMap.values()));
    });

    this.saveVault();
  }

  /**
   * Retrieves Plaza Counter-Evidence files
   */
  getPlazaEvidence(disputeId, acqTxnId) {
    const k1 = this.normalizeKey(disputeId);
    const k2 = this.normalizeKey(acqTxnId);

    if (k1 && this.memoryCache.has(`plaza_${k1}`)) {
      return this.memoryCache.get(`plaza_${k1}`);
    }
    if (k2 && this.memoryCache.has(`plaza_${k2}`)) {
      return this.memoryCache.get(`plaza_${k2}`);
    }
    return null;
  }

  /**
   * Saves Acquirer Admin Evidence files
   */
  saveAdminEvidence(disputeId, acqTxnId, fileList = []) {
    if (!Array.isArray(fileList)) return;
    const sanitized = fileList.map((f) => this.sanitizeFile(f)).filter(Boolean);

    const keys = [
      this.normalizeKey(disputeId),
      this.normalizeKey(acqTxnId),
    ].filter(Boolean);

    keys.forEach((k) => {
      this.memoryCache.set(`admin_${k}`, sanitized);
    });

    this.saveVault();
  }

  /**
   * Retrieves Acquirer Admin Evidence files
   */
  getAdminEvidence(disputeId, acqTxnId) {
    const k1 = this.normalizeKey(disputeId);
    const k2 = this.normalizeKey(acqTxnId);

    if (k1 && this.memoryCache.has(`admin_${k1}`)) {
      return this.memoryCache.get(`admin_${k1}`);
    }
    if (k2 && this.memoryCache.has(`admin_${k2}`)) {
      return this.memoryCache.get(`admin_${k2}`);
    }
    return null;
  }

  /**
   * Looks up a specific file by name in the vault for a given dispute
   */
  findFile(disputeId, acqTxnId, fileName) {
    if (!fileName) return null;
    const lowerTarget = fileName.trim().toLowerCase();

    const plazaList = this.getPlazaEvidence(disputeId, acqTxnId) || [];
    const foundPlaza = plazaList.find((f) => f.name && f.name.toLowerCase() === lowerTarget);
    if (foundPlaza) return foundPlaza;

    const adminList = this.getAdminEvidence(disputeId, acqTxnId) || [];
    const foundAdmin = adminList.find((f) => f.name && f.name.toLowerCase() === lowerTarget);
    if (foundAdmin) return foundAdmin;

    return null;
  }

  /**
   * Parses backend raw database string into an array of file objects.
   * Handles:
   * - Single file name: "Screenshot 2026-06-24 154319.png"
   * - Comma-separated names: "file1.png, file2.jpg, doc.pdf"
   * - JSON array string: '["file1.png", "file2.jpg"]'
   */
  parseEvidenceString(nameField, urlField, disputeId = null, acqTxnId = null) {
    // 1. Check if we already have full files with dataUrl in the vault
    const fromVault = this.getPlazaEvidence(disputeId, acqTxnId);
    if (fromVault && fromVault.length > 0) {
      return fromVault;
    }

    if (!nameField) return [];

    let rawStr = String(nameField).trim();
    if (rawStr === '[object Object]' || rawStr === 'null' || rawStr === 'undefined' || !rawStr) {
      return [];
    }

    // Try parsing as JSON array
    let names = [];
    if (rawStr.startsWith('[') && rawStr.endsWith(']')) {
      try {
        const parsed = JSON.parse(rawStr);
        if (Array.isArray(parsed)) {
          names = parsed.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean);
        }
      } catch {
        // Fall back to comma splitting
      }
    }

    if (names.length === 0) {
      // Split by comma
      names = rawStr.split(',').map((s) => s.trim()).filter((s) => s && s !== '[object Object]');
    }

    const cleanUrl = isValidMediaUrl(urlField) ? urlField : null;

    return names.map((name) => {
      // Check if this specific file exists in vault
      const stored = this.findFile(disputeId, acqTxnId, name);
      if (stored) return stored;

      return {
        name,
        size: 0,
        type: this.guessMimeType(name),
        dataUrl: cleanUrl,
        url: cleanUrl,
        uploadedAt: new Date().toISOString(),
      };
    });
  }
}

export const evidenceStorage = new EvidenceStorageService();
export default evidenceStorage;
