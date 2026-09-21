import React, { useState } from 'react';
import Button from '../../../components/Button/Button';

export const ApiKeysSection = ({ apiConfig, onSaveWebhook }) => {
  const [webhookUrl, setWebhookUrl] = useState(apiConfig?.webhookUrl || '');
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="card api-keys-section mb-6">
      <h3 className="section-title mb-2">Developer & Webhook Integration</h3>
      <p className="text-muted text-sm mb-6">
        Authenticate API calls and dispatch real-time events to your server endpoints.
      </p>

      <div className="form-group mb-4">
        <label className="form-label">Production Public Key</label>
        <div className="key-input-row">
          <input
            type="text"
            readOnly
            value={apiConfig?.publicKey || ''}
            className="code-input"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCopy(apiConfig?.publicKey)}
          >
            {copiedKey ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="form-group mb-4">
        <label className="form-label">Restricted Secret Key</label>
        <div className="key-input-row">
          <input
            type="text"
            readOnly
            value={apiConfig?.secretKeyMasked || ''}
            className="code-input"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => alert('Secret key regeneration requires 2FA confirmation.')}
          >
            Roll Key
          </Button>
        </div>
      </div>

      <div className="form-group mb-4">
        <label className="form-label">Live Webhook Listener URL</label>
        <div className="key-input-row">
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="code-input"
            placeholder="https://yourdomain.com/webhooks/paysonic"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => onSaveWebhook && onSaveWebhook(webhookUrl)}
          >
            Save Endpoint
          </Button>
        </div>
      </div>

      <div className="supported-protocols mt-4">
        <span className="text-xs text-muted">Enabled transport protocols: </span>
        {apiConfig?.supportedProtocols?.map((proto) => (
          <span key={proto} className="badge badge--neutral mr-2">
            {proto}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ApiKeysSection;
