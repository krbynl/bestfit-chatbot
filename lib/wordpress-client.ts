/**
 * WordPress Voice Chat API Client
 * Connects Vercel AI Chatbot to WordPress backend
 * 
 * File: lib/wordpress-client.ts
 */

export interface VoiceSession {
  user_id: string;
  system_prompt: string;
  has_memories: boolean;
  created_at: string;
}

export interface VoiceMessageResponse {
  success: boolean;
  user_message?: string;
  ai_response?: string;
  audio?: string;
  audio_format?: string;
  error?: string;
  workouts_logged?: number;  // NEW: Track workout logging
}

export interface TextMessageResponse {
  success: boolean;
  user_id?: string;
  ai_response?: string;
  has_memory?: boolean;
  error?: string;
  workouts_logged?: number;  // NEW: Track workout logging
}

export interface MemoriesResponse {
  success: boolean;
  user_id?: string;
  memories?: string;
  error?: string;
}

class WordPressVoiceClient {
  private baseUrl: string;
  private userId: string | null = null;

  constructor(baseUrl: string) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Get or set user ID for memory persistence
   */
  getUserId(): string | null {
    if (this.userId) return this.userId;
    
    // Check localStorage for existing ID
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vc_user_id');
      if (stored) {
        this.userId = stored;
        return stored;
      }
    }
    return null;
  }

  setUserId(id: string): void {
    this.userId = id;
    if (typeof window !== 'undefined') {
      localStorage.setItem('vc_user_id', id);
    }
  }

  /**
   * Create a voice chat session with memory context
   */
  async createSession(query: string = 'Hello'): Promise<VoiceSession> {
    const params = new URLSearchParams({ query });
    const userId = this.getUserId();
    if (userId) params.append('user_id', userId);

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.session?.user_id) {
      this.setUserId(data.session.user_id);
    }

    return data.session;
  }

  /**
   * Send voice message (audio file) - Full pipeline
   */
  async sendVoiceMessage(
    audioBlob: Blob,
    voice: string = 'alloy'
  ): Promise<VoiceMessageResponse> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('voice', voice);
    
    const userId = this.getUserId();
    if (userId) formData.append('user_id', userId);

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/message`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Voice message failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send text message with memory
   */
  async sendTextMessage(message: string): Promise<TextMessageResponse> {
    const params = new URLSearchParams({ message });
    const userId = this.getUserId();
    if (userId) params.append('user_id', userId);

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Text message failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.user_id) {
      this.setUserId(data.user_id);
    }

    return data;
  }

  /**
   * Transcribe audio only (Whisper)
   */
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/transcribe`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text;
  }

  /**
   * Generate speech from text (TTS)
   */
  async generateSpeech(text: string, voice: string = 'alloy'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/wp-json/voice-chat/v1/speak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Speech generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.audio) {
      throw new Error(data.error || 'No audio returned');
    }

    // Convert base64 to Blob
    const binaryString = atob(data.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: 'audio/mpeg' });
  }

  /**
   * Get user memories
   */
  async getMemories(query: string = 'recent', limit: number = 10): Promise<string> {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
    });
    
    const userId = this.getUserId();
    if (userId) params.append('user_id', userId);

    const response = await fetch(
      `${this.baseUrl}/wp-json/voice-chat/v1/memories?${params}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get memories: ${response.statusText}`);
    }

    const data = await response.json();
    return data.memories || '';
  }

  /**
   * Play audio from base64 string
   */
  playAudio(base64Audio: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        
        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        
        audio.play();
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Export singleton instance
const wordpressUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://bestfitcoach.com';
export const wordpressClient = new WordPressVoiceClient(wordpressUrl);

export default WordPressVoiceClient;
