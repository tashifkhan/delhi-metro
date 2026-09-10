import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * The Chromium install prompt. Not in the DOM lib, since it is not a standard
 * event. The event object itself is the only way to open the install dialog,
 * which is why `public/index.html` stashes it the moment it fires.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Set by the inline script in `public/index.html`. */
const STASH_KEY = '__ncrMetroInstallPrompt';
const STASH_EVENT = 'ncr-metro-installable';

interface PwaInstall {
  /** The browser has an install prompt to open. */
  canInstall: boolean;
  /** Already running from the home screen, so there is nothing to offer. */
  isInstalled: boolean;
  /**
   * iOS has no prompt API. Safari installs only through its own share sheet,
   * so the app has to say what to tap rather than offer a button.
   */
  needsManualInstall: boolean;
  /** Opens the browser's install dialog. */
  install: () => void;
}

const IDLE: PwaInstall = {
  canInstall: false,
  isInstalled: false,
  needsManualInstall: false,
  install: () => {},
};

function readStash(): BeforeInstallPromptEvent | null {
  return (window as unknown as Record<string, BeforeInstallPromptEvent | null>)[STASH_KEY] ?? null;
}

function clearStash() {
  (window as unknown as Record<string, BeforeInstallPromptEvent | null>)[STASH_KEY] = null;
}

/** Standalone display mode, or Safari's own pre-standard flag for it. */
function readInstalled(): boolean {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

function readIsIos(): boolean {
  const ua = window.navigator.userAgent;
  // An iPad on iPadOS 13+ reports itself as a Mac, and only the touch point
  // count gives it away.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1);
}

/**
 * Whether this page can be installed to the home screen, and how.
 *
 * Inert everywhere but the web build, so a screen can render the same row on
 * every platform and get nothing on native.
 */
export function usePwaInstall(): PwaInstall {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // The event usually fires before this bundle has parsed, so read what is
    // already there once. The listener only catches later ones.
    setPrompt(readStash());
    setIsInstalled(readInstalled());
    setIsIos(readIsIos());

    const onInstallable = () => setPrompt(readStash());
    const onInstalled = () => {
      clearStash();
      setPrompt(null);
      setIsInstalled(true);
    };

    const standalone = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (event: MediaQueryListEvent) => setIsInstalled(event.matches);
    // Safari only grew `addEventListener` on a media query list in 14.
    // Missing the update costs a stale row. Throwing here blanks the app.
    const watchable = typeof standalone.addEventListener === 'function';

    window.addEventListener(STASH_EVENT, onInstallable);
    window.addEventListener('appinstalled', onInstalled);
    if (watchable) standalone.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener(STASH_EVENT, onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
      if (watchable) standalone.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  const install = useCallback(() => {
    if (!prompt) return;

    // The browser allows one dialog per event. Drop it either way, so a
    // dismissed prompt does not leave a button that opens nothing.
    clearStash();
    setPrompt(null);
    void prompt.prompt().catch(() => {});
  }, [prompt]);

  if (Platform.OS !== 'web') return IDLE;

  return {
    canInstall: Boolean(prompt) && !isInstalled,
    isInstalled,
    needsManualInstall: isIos && !isInstalled && !prompt,
    install,
  };
}
