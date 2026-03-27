'use client';

import { useEffect } from 'react';

export function DevSyncProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const loadDevSync = () => {
      const script = document.createElement('script');
      script.src = '/scripts/browser-dev-tools.js';
      script.async = true;
      script.onload = () => {
        console.log('[DevSync] Browser tools loaded');
      };
      document.body.appendChild(script);
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      loadDevSync();
    } else {
      document.addEventListener('DOMContentLoaded', loadDevSync);
    }
  }, []);

  return null;
}

export default DevSyncProvider;
