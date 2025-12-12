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

// Animated Wave Component
const AnimatedWave = ({ isActive, color = '#BE5103' }: { isActive: boolean; color?: string }) => (
  <div className="flex items-center gap-1">
    {[...Array(4)].map((_, i) => (
      <div
        key={i}
        className={`w-1 rounded-full transition-all duration-150 ${isActive ? 'animate-wave' : 'h-2'}`}
        style={{
          backgroundColor: color,
          height: isActive ? '16px' : '8px',
          animationDelay: `${i * 0.15}s`,
        }}
      />
    ))}
    <style jsx>{`
      @keyframes wave {
        0%, 100% { height: 8px; }
        50% { height: 20px; }
      }
      .animate-wave {
        animation: wave 0.8s ease-in-out infinite;
      }
    `}</style>
  </div>
);

// Loading Animation - Luxury Gold/Copper
const LoadingAnimation = () => (
  <div className="flex flex-col items-center justify-center py-6">
    <div className="relative w-20 h-20">
      <div className="absolute inset-0 rounded-full border-4 animate-ping" style={{ borderColor: 'rgba(190, 81, 3, 0.3)' }} />
      <div className="absolute inset-2 rounded-full border-4 animate-pulse" style={{ borderColor: 'rgba(190, 81, 3, 0.5)' }} />
      <div className="absolute inset-4 rounded-full animate-pulse flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #BE5103, #8B3A02)' }}>
        <div className="flex items-center gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
    <p className="mt-4 text-sm font-medium animate-pulse" style={{ color: '#E8C4A0' }}>Coach is thinking...</p>
  </div>
);

// Speaking Wave Animation
const SpeakingWave = () => (
  <div className="flex items-center gap-0.5 ml-2">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className="w-1 rounded-full animate-speaking"
        style={{ backgroundColor: '#BE5103', animationDelay: `${i * 0.1}s` }}
      />
    ))}
    <style jsx>{`
      @keyframes speaking {
        0%, 100% { height: 4px; }
        50% { height: 16px; }
      }
      .animate-speaking {
        animation: speaking 0.5s ease-in-out infinite;
      }
    `}</style>
  </div>
);

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

      const response = await wordpressClient.sendVoiceMessage(audioBlob, 'nova');
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
      if (recorderState.isRecording) {
        cancelRecording();
      }
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
          const audioBlob = await wordpressClient.generateSpeech(response.ai_response, 'nova');
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

  return (
    <div className={`flex flex-col h-full relative overflow-hidden ${className}`}>
      {/* Luxury gradient background - easy on eyes */}
      <div className="absolute inset-0" style={{
        background: `
          radial-gradient(ellipse at top left, rgba(17, 17, 132, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at bottom right, rgba(190, 81, 3, 0.1) 0%, transparent 50%),
          linear-gradient(160deg, #0d0d0d 0%, #1a1209 25%, #1c1410 50%, #12101a 75%, #0d0d0d 100%)
        `,
      }} />
      
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23BE5103' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
      }} />
      
      {/* Header - Luxury Dark with Copper Accent */}
      <div className="relative flex items-center justify-between p-4 backdrop-blur-md" style={{
        background: 'linear-gradient(90deg, rgba(85, 0, 0, 0.9) 0%, rgba(60, 20, 10, 0.85) 50%, rgba(17, 17, 132, 0.4) 100%)',
        borderBottom: '1px solid rgba(190, 81, 3, 0.3)',
      }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg" style={{
            background: 'linear-gradient(135deg, #550000 0%, #BE5103 100%)',
            boxShadow: '0 4px 15px rgba(190, 81, 3, 0.4)',
          }}>
            <span className="text-xl">🏃</span>
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
            background: autoSpeak 
              ? 'linear-gradient(135deg, #166534 0%, #15803d 100%)' 
              : 'rgba(85, 0, 0, 0.6)',
            color: autoSpeak ? '#ffffff' : '#E8C4A0',
            boxShadow: autoSpeak ? '0 4px 15px rgba(22, 101, 52, 0.4)' : 'none',
          }}
        >
          {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
          {autoSpeak ? 'Sound ON' : 'Sound OFF'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="relative p-3 text-sm text-center backdrop-blur-sm" style={{
          background: 'rgba(220, 38, 38, 0.9)',
          color: '#ffffff',
        }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:opacity-80">Dismiss</button>
        </div>
      )}

      {/* Voice Mode Banner */}
      {voiceMode && (
        <div className="relative p-4 text-center text-white backdrop-blur-sm flex items-center justify-center gap-3" style={{
          background: isListening 
            ? 'linear-gradient(90deg, rgba(220, 38, 38, 0.9) 0%, rgba(190, 81, 3, 0.9) 100%)'
            : isSpeaking 
            ? 'linear-gradient(90deg, rgba(17, 17, 132, 0.9) 0%, rgba(85, 0, 0, 0.9) 100%)'
            : isLoading 
            ? 'linear-gradient(90deg, rgba(190, 81, 3, 0.9) 0%, rgba(85, 0, 0, 0.9) 100%)'
            : 'linear-gradient(90deg, rgba(22, 101, 52, 0.9) 0%, rgba(21, 128, 61, 0.9) 100%)',
        }}>
          <AnimatedWave isActive={isListening || isSpeaking} color="white" />
          <span className="font-medium">
            {isListening && '🎤 Listening... Tap when done speaking'}
            {isSpeaking && '🔊 Coach is speaking...'}
            {isLoading && '⏳ Processing your message...'}
            {!isListening && !isSpeaking && !isLoading && '✅ Ready - Tap to speak'}
          </span>
          <AnimatedWave isActive={isListening || isSpeaking} color="white" />
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, rgba(85, 0, 0, 0.4) 0%, rgba(190, 81, 3, 0.3) 100%)',
              border: '2px solid rgba(190, 81, 3, 0.4)',
              boxShadow: '0 8px 32px rgba(190, 81, 3, 0.2)',
            }}>
              <span className="text-5xl">🏃</span>
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
                  : '0 4px 20px rgba(0, 0, 0, 0.15)',
              }}
            >
              <div className="flex items-start gap-2">
                <p className="whitespace-pre-wrap leading-relaxed flex-1">{message.content}</p>
                {message.role === 'assistant' && currentSpeakingId === message.id && (
