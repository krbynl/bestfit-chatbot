'use client';

import { useEffect } from 'react';
import { VoiceChat } from '@/components/voice-chat';

'use client';

export default function VoiceChatPage() {
  // Service Worker removed - not needed yet
  
  return (
    <div className="h-screen w-full">
      <VoiceChat className="h-full" />
    </div>
  );
}
