import { useEffect, useState, type ComponentType } from 'react';
import { Capacitor } from '@capacitor/core';

export default function WebUpdatePrompt() {
  const [Prompt, setPrompt] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (Capacitor.getPlatform() === 'ios') return;
    void import('./PWAUpdatePrompt').then((mod) => {
      setPrompt(() => mod.default);
    });
  }, []);

  if (!Prompt) return null;
  return <Prompt />;
}
