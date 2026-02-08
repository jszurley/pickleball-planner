import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="install-prompt">
      <img
        src="/icons/icon-72x72.png"
        alt="Pickleball"
        className="install-prompt-icon"
      />
      <div className="install-prompt-content">
        <div className="install-prompt-title">Install Pickleball App</div>
        <div className="install-prompt-text">
          Add to your home screen for quick access
        </div>
      </div>
      <div className="install-prompt-actions">
        <button className="btn btn-outline btn-sm" onClick={handleDismiss}>
          Not now
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleInstall}>
          Install
        </button>
      </div>
    </div>
  );
}
