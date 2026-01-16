'use client';

import { VoiceChat } from '@/components/voice-chat';

export default function VoiceChatPage() {
  // Service Worker removed - not needed yet
  
  return (
    <div className="h-screen w-full">
      <VoiceChat className="h-full" />
    </div>
  );
}
