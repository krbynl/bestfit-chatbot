'use client';

import { useEffect } from 'react';
import { VoiceChat } from '@/components/voice-chat';

export default function VoiceChatPage() {
  useEffect(() => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    }
  }, []);

  return (
    <div className="h-screen w-full">
      <VoiceChat className="h-full" />
    </div>
  );
}
