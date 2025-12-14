'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Phone, PhoneOff } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { wordpressClient } from '@/lib/wordpress-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function VoiceChat({ className = '' }: { className?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const voiceModeRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await wordpressClient.createSession();
        setSessionReady(true);
        if (session.has_memories) {
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: "Welcome back! I remember our previous conversations. How can I help you today?",
            timestamp: new Date(),
          }]);
        }
      } catch (err) {
        console.error('Failed to initialize session:', err);
        setSessionReady(true);
      }
    };
    initSession();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  const playAudio = useCallback(async (base64Audio: string, messageId?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setIsSpeaking(true);
      if (messageId) setCurrentSpeakingId(messageId);
      
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
          setIsSpeaking(false);
          setCurrentSpeakingId(null);
          resolve();
        };
        
        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          setCurrentSpeakingId(null);
          reject(e);
        };
        
        audio.play();
      } catch (error) {
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
        reject(error);
      }
    });
  }, []);

  const startListening = useCallback(async () => {
    if (!voiceModeRef.current) return;
    
    setIsListening(true);
    try {
      await startRecording();
    } catch (err) {
      setError('Microphone access denied');
      setVoiceMode(false);
      setIsListening(false);
    }
  }, [startRecording]);

  const processVoiceAndContinue = useCallback(async () => {
    if (!recorderState.isRecording) return;
    
    setIsListening(false);
    setIsLoading(true);
    setError(null);

    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) throw new Error('No audio recorded');

      const tempId = `user-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: tempId,
        role: 'user',
        content: '🎤 Processing...',
        timestamp: new Date(),
      }]);
      
const response = await wordpressClient.sendVoiceMessage(audioBlob, 'onyx');
      if (!response.success) throw new Error(response.error || 'Failed to process voice');

      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, content: response.user_message || '(Voice message)' }
            : msg
        )
      );

      const assistantId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: response.ai_response || '',
        timestamp: new Date(),
      }]);

      setIsLoading(false);

      if (response.audio && autoSpeak) {
        await playAudio(response.audio, assistantId);
      }
      
      if (voiceModeRef.current) {
        setTimeout(() => startListening(), 500);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Voice processing failed';
      setError(message);
      setMessages(prev => prev.filter(msg => !msg.content.includes('Processing')));
      setIsLoading(false);
      
      if (voiceModeRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    }
  }, [recorderState.isRecording, stopRecording, autoSpeak, playAudio, startListening]);

 const toggleVoiceMode = useCallback(async () => {
  if (voiceMode) {
    setVoiceMode(false);
    voiceModeRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);
    if (recorderState.isRecording) {
      cancelRecording();
    }
    // Stop any playing audio
    document.querySelectorAll('audio').forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  } else {
    setVoiceMode(true);
    voiceModeRef.current = true;
    await startListening();
  }
}, [voiceMode, recorderState.isRecording, cancelRecording, startListening]);

  const handleVoiceTap = useCallback(async () => {
    if (recorderState.isRecording) {
      await processVoiceAndContinue();
    }
  }, [recorderState.isRecording, processVoiceAndContinue]);

  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await wordpressClient.sendTextMessage(text);
      if (!response.success) throw new Error(response.error || 'Failed to get response');

      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: response.ai_response || '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (autoSpeak && response.ai_response) {
        try {
    const audioBlob = await wordpressClient.generateSpeech(response.ai_response, 'onyx');
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            playAudio(base64, assistantId);
          };
          reader.readAsDataURL(audioBlob);
        } catch (speechErr) {
          console.error('Speech generation failed:', speechErr);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, autoSpeak, playAudio]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendTextMessage(inputText);
  };

  const getVoiceBannerStyle = () => {
    if (isListening) return { background: 'linear-gradient(90deg, #dc2626 0%, #BE5103 100%)' };
    if (isSpeaking) return { background: 'linear-gradient(90deg, #111184 0%, #550000 100%)' };
    if (isLoading) return { background: 'linear-gradient(90deg, #BE5103 0%, #550000 100%)' };
    return { background: 'linear-gradient(90deg, #16a34a 0%, #15803d 100%)' };
  };

  return (
    <div className={`flex flex-col h-full relative overflow-hidden ${className}`}>
      {/* Luxury gradient background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at top left, rgba(17, 17, 132, 0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(190, 81, 3, 0.1) 0%, transparent 50%), linear-gradient(160deg, #0d0d0d 0%, #1a1209 25%, #1c1410 50%, #12101a 75%, #0d0d0d 100%)'
        }}
      />
      
      {/* Header */}
      <div 
        className="relative flex items-center justify-between p-4 backdrop-blur-md"
        style={{
          background: 'linear-gradient(90deg, rgba(85, 0, 0, 0.9) 0%, rgba(60, 20, 10, 0.85) 50%, rgba(17, 17, 132, 0.4) 100%)',
          borderBottom: '1px solid rgba(190, 81, 3, 0.3)'
        }}
      >
        <div className="flex items-center gap-3">
      <div 
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg overflow-hidden p-1"
            style={{
              background: 'linear-gradient(135deg, #550000 0%, #BE5103 100%)',
              boxShadow: '0 4px 15px rgba(190, 81, 3, 0.4)'
            }}
          >
            <img src="/images/icon-192.png" alt="BFC" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#F5E6D3' }}>Best Fit Coach</h2>
            <p className="text-xs" style={{ color: '#BE5103' }}>Be Better Than Yourself</p>
          </div>
        </div>
        <button
          onClick={() => setAutoSpeak(!autoSpeak)}
          className="flex items-center gap-2 px-4 py-2 text-xs rounded-full transition-all font-medium"
          style={{
            background: autoSpeak ? 'linear-gradient(135deg, #166534 0%, #15803d 100%)' : 'rgba(85, 0, 0, 0.6)',
            color: autoSpeak ? '#ffffff' : '#E8C4A0',
            boxShadow: autoSpeak ? '0 4px 15px rgba(22, 101, 52, 0.4)' : 'none'
          }}
        >
          {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
          {autoSpeak ? 'Sound ON' : 'Sound OFF'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="relative p-3 text-sm text-center backdrop-blur-sm" style={{ background: 'rgba(220, 38, 38, 0.9)', color: '#ffffff' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:opacity-80">Dismiss</button>
        </div>
      )}

      {/* Voice Mode Banner */}
      {voiceMode && (
        <div 
          className="relative p-4 text-center text-white backdrop-blur-sm flex items-center justify-center gap-3"
          style={getVoiceBannerStyle()}
        >
          <span className="font-medium">
            {isListening && '🎤 Listening... Tap when done speaking'}
            {isSpeaking && '🔊 Coach is speaking...'}
            {isLoading && '⏳ Processing your message...'}
            {!isListening && !isSpeaking && !isLoading && '✅ Ready - Tap to speak'}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
           <div 
              className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center overflow-hidden p-2"
              style={{
                background: 'linear-gradient(135deg, rgba(85, 0, 0, 0.4) 0%, rgba(190, 81, 3, 0.3) 100%)',
                border: '2px solid rgba(190, 81, 3, 0.4)',
                boxShadow: '0 8px 32px rgba(190, 81, 3, 0.2)'
              }}
            >
              <img src="/images/icon-192.png" alt="Best Fit Coach" className="w-full h-full object-contain" />
            </div>
            <p className="text-xl mb-2 font-semibold" style={{ color: '#F5E6D3' }}>Welcome to Best Fit Coach!</p>
            <p style={{ color: '#A89080' }}>Type a message or start a voice conversation</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className="max-w-[85%] rounded-2xl px-4 py-3"
              style={{
                background: message.role === 'user'
                  ? 'linear-gradient(135deg, #111184 0%, #1a1a9e 50%, #0d0d6b 100%)'
                  : 'linear-gradient(135deg, #F5F0EB 0%, #EDE5DC 100%)',
                color: message.role === 'user' ? '#E8E8FF' : '#2D2420',
                boxShadow: message.role === 'user'
                  ? '0 4px 20px rgba(17, 17, 132, 0.4)'
                  : '0 4px 20px rgba(0, 0, 0, 0.15)'
              }}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div 
              className="max-w-[85%] rounded-2xl px-6 py-4"
              style={{
                background: 'linear-gradient(135deg, #F5F0EB 0%, #EDE5DC 100%)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
              }}
            >
              <div className="flex flex-col items-center justify-center py-4">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full animate-bounce"
                      style={{ 
                        backgroundColor: '#BE5103',
                        animationDelay: `${i * 0.2}s`
                      }}
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm font-medium" style={{ color: '#6B5344' }}>Coach is thinking...</p>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div 
        className="relative p-4 backdrop-blur-md"
        style={{
          background: 'linear-gradient(90deg, rgba(85, 0, 0, 0.95) 0%, rgba(40, 20, 10, 0.9) 50%, rgba(17, 17, 132, 0.3) 100%)',
          borderTop: '1px solid rgba(190, 81, 3, 0.3)'
        }}
      >
        {/* Voice Mode Toggle Button */}
        <div className="flex justify-center mb-4">
          <button
            onClick={voiceMode ? (recorderState.isRecording ? handleVoiceTap : toggleVoiceMode) : toggleVoiceMode}
            disabled={isLoading && !voiceMode}
            className="flex items-center gap-3 px-8 py-4 rounded-full text-lg font-semibold transition-all transform active:scale-95"
            style={{
              background: voiceMode
                ? recorderState.isRecording
                  ? 'linear-gradient(135deg, #dc2626 0%, #BE5103 100%)'
                  : 'linear-gradient(135deg, #550000 0%, #7f1d1d 100%)'
                : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#ffffff',
              boxShadow: voiceMode
                ? recorderState.isRecording
                  ? '0 6px 25px rgba(220, 38, 38, 0.5)'
                  : '0 6px 25px rgba(85, 0, 0, 0.5)'
                : '0 6px 25px rgba(22, 163, 74, 0.5)'
            }}
          >
            {voiceMode ? (
              recorderState.isRecording ? (
                <>
                  <MicOff size={24} />
                  Tap to Send
                </>
              ) : (
                <>
                  <PhoneOff size={24} />
                  End Conversation
                </>
              )
            ) : (
              <>
                <Phone size={24} />
                Start Voice Chat
              </>
            )}
          </button>
        </div>

        {/* Text Input */}
        {!voiceMode && (
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1 px-5 py-3 rounded-full transition-all focus:outline-none focus:ring-2"
              style={{
                background: 'rgba(30, 20, 15, 0.8)',
                color: '#F5E6D3',
                border: '1px solid rgba(190, 81, 3, 0.4)'
              }}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3 rounded-full transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #BE5103 0%, #8B3A02 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 15px rgba(190, 81, 3, 0.4)'
              }}
            >
              <Send size={20} />
            </button>
          </form>
     )}
        
        {/* Disclaimer */}
        <p className="text-center text-xs mt-3 px-4" style={{ color: 'rgba(190, 81, 3, 0.6)' }}>
          🤖 BFC AI is very smart, not perfect — Please confirm important info.
        </p>
      </div>
    </div>
  );
}

export default VoiceChat;
