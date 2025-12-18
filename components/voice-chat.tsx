'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Phone, PhoneOff, Copy, Check, Trash2, Lightbulb, Target, Dumbbell, Heart, Flame, Award } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { wordpressClient } from '@/lib/wordpress-client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UsageStats {
  used: number;
  remaining: number;
  limit: number;
  is_premium: boolean;
}

interface UserStreak {
  currentStreak: number;
  lastVisit: string;
  totalVisits: number;
}

// Daily Fitness Tips
const DAILY_TIPS = [
  { icon: '💧', tip: "Drink a glass of water first thing in the morning to kickstart your metabolism!" },
  { icon: '🚶', tip: "A 10-minute walk after meals can help regulate blood sugar levels." },
  { icon: '😴', tip: "Aim for 7-9 hours of sleep. Recovery is when your muscles grow!" },
  { icon: '🥗', tip: "Fill half your plate with vegetables for easy portion control." },
  { icon: '💪', tip: "Consistency beats intensity. Small daily efforts lead to big results!" },
  { icon: '🧘', tip: "Take 5 deep breaths before eating to improve digestion." },
  { icon: '⏰', tip: "Try to eat within a 10-12 hour window for better metabolic health." },
  { icon: '🏃', tip: "Just 20 minutes of movement daily can boost your mood significantly!" },
  { icon: '🍎', tip: "Eating protein at breakfast helps control cravings throughout the day." },
  { icon: '🎯', tip: "Focus on one healthy habit at a time. Master it, then add another." },
  { icon: '💤', tip: "Avoid screens 1 hour before bed for better sleep quality." },
  { icon: '🥤', tip: "Replace one sugary drink with water today. Your body will thank you!" },
  { icon: '🧠', tip: "Exercise isn't just for your body - it boosts brain power too!" },
  { icon: '🌅', tip: "Morning sunlight exposure helps regulate your sleep-wake cycle." },
];

// Conversation Starters
const CONVERSATION_STARTERS = [
  { icon: <Target size={18} />, text: "Help me set a fitness goal", color: '#BE5103' },
  { icon: <Dumbbell size={18} />, text: "Create a workout plan", color: '#111184' },
  { icon: <Heart size={18} />, text: "Nutrition advice", color: '#dc2626' },
  { icon: <Flame size={18} />, text: "How to lose weight", color: '#ea580c' },
];

// Get today's tip based on date (called client-side only)
const getTodaysTip = (tipIndex: number) => {
  return DAILY_TIPS[tipIndex % DAILY_TIPS.length];
};

// Streak Management
const getStreakData = (): UserStreak => {
  if (typeof window === 'undefined') return { currentStreak: 0, lastVisit: '', totalVisits: 0 };
  
  const stored = localStorage.getItem('bfc_streak');
  if (!stored) return { currentStreak: 0, lastVisit: '', totalVisits: 0 };
  
  try {
    return JSON.parse(stored);
  } catch {
    return { currentStreak: 0, lastVisit: '', totalVisits: 0 };
  }
};

const updateStreak = (): UserStreak => {
  if (typeof window === 'undefined') return { currentStreak: 1, lastVisit: new Date().toDateString(), totalVisits: 1 };
  
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const current = getStreakData();
  
  // Already visited today
  if (current.lastVisit === today) {
    return current;
  }
  
  let newStreak: UserStreak;
  
  if (current.lastVisit === yesterday) {
    // Consecutive day - increase streak
    newStreak = {
      currentStreak: current.currentStreak + 1,
      lastVisit: today,
      totalVisits: current.totalVisits + 1
    };
  } else if (current.lastVisit === '') {
    // First visit ever
    newStreak = {
      currentStreak: 1,
      lastVisit: today,
      totalVisits: 1
    };
  } else {
    // Streak broken - reset to 1
    newStreak = {
      currentStreak: 1,
      lastVisit: today,
      totalVisits: current.totalVisits + 1
    };
  }
  
  localStorage.setItem('bfc_streak', JSON.stringify(newStreak));
  return newStreak;
};

// Futuristic Pulse Ring Animation Component
const PulseRingAnimation = ({ isActive, color = '#BE5103' }: { isActive: boolean; color?: string }) => {
  if (!isActive) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full border-2 animate-ping"
          style={{
            width: `${80 + i * 40}px`,
            height: `${80 + i * 40}px`,
            borderColor: color,
            opacity: 0.3 - i * 0.1,
            animationDelay: `${i * 0.3}s`,
            animationDuration: '1.5s',
          }}
        />
      ))}
    </div>
  );
};

// Heartbeat Line Animation Component
const HeartbeatLine = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  
  return (
    <div className="absolute bottom-0 left-0 right-0 h-16 overflow-hidden opacity-50">
      <svg viewBox="0 0 400 50" className="w-full h-full">
        <path
          d="M0,25 L50,25 L60,25 L70,10 L80,40 L90,5 L100,45 L110,25 L120,25 L400,25"
          fill="none"
          stroke="#BE5103"
          strokeWidth="2"
          className="animate-pulse"
          style={{
            strokeDasharray: '400',
            strokeDashoffset: '400',
            animation: 'heartbeat 2s linear infinite',
          }}
        />
      </svg>
      <style jsx>{`
        @keyframes heartbeat {
          0% { stroke-dashoffset: 400; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};

// Futuristic Fitness Loading Animation
const FitnessLoadingAnimation = ({ state, size = 'normal' }: { state: 'listening' | 'speaking' | 'loading' | 'idle'; size?: 'small' | 'normal' }) => {
  const getColors = () => {
    switch (state) {
      case 'listening': return { primary: '#dc2626', secondary: '#BE5103', glow: 'rgba(220, 38, 38, 0.4)' };
      case 'speaking': return { primary: '#111184', secondary: '#550000', glow: 'rgba(17, 17, 132, 0.4)' };
      case 'loading': return { primary: '#BE5103', secondary: '#550000', glow: 'rgba(190, 81, 3, 0.4)' };
      default: return { primary: '#16a34a', secondary: '#15803d', glow: 'rgba(22, 163, 74, 0.4)' };
    }
  };

  const colors = getColors();
  const isAnimating = state !== 'idle';
  const dimensions = size === 'small' ? { outer: 20, middle: 16, inner: 12, logo: 8 } : { outer: 32, middle: 24, inner: 20, logo: 14 };

  return (
    <div className={`relative flex items-center justify-center`} style={{ width: `${dimensions.outer * 4}px`, height: `${dimensions.outer * 4}px` }}>
      {/* Outer rotating ring */}
      <div
        className={`absolute rounded-full border-4 border-transparent ${isAnimating ? 'animate-spin' : ''}`}
        style={{
          width: `${dimensions.outer * 4}px`,
          height: `${dimensions.outer * 4}px`,
          borderTopColor: colors.primary,
          borderRightColor: colors.secondary,
          animationDuration: '3s',
          boxShadow: `0 0 20px ${colors.glow}`,
        }}
      />
      
      {/* Middle pulsing ring */}
      <div
        className={`absolute rounded-full border-2 ${isAnimating ? 'animate-pulse' : ''}`}
        style={{
          width: `${dimensions.middle * 4}px`,
          height: `${dimensions.middle * 4}px`,
          borderColor: colors.primary,
          opacity: 0.6,
          boxShadow: `0 0 15px ${colors.glow}, inset 0 0 15px ${colors.glow}`,
        }}
      />
      
      {/* Inner activity ring (Apple Watch style) */}
      <svg className="absolute" style={{ width: `${dimensions.inner * 4}px`, height: `${dimensions.inner * 4}px` }} viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgba(190, 81, 3, 0.2)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={colors.primary}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${isAnimating ? '200' : '0'} 283`}
          transform="rotate(-90 50 50)"
          style={{
            transition: 'stroke-dasharray 0.5s ease',
            filter: `drop-shadow(0 0 6px ${colors.glow})`,
          }}
        >
          {isAnimating && (
            <animate
              attributeName="stroke-dasharray"
              values="0 283;141 283;283 283;141 283;0 283"
              dur="2s"
              repeatCount="indefinite"
            />
          )}
        </circle>
      </svg>
      
      {/* Center logo container */}
      <div
        className={`relative rounded-full flex items-center justify-center overflow-hidden ${isAnimating ? 'animate-pulse' : ''}`}
        style={{
          width: `${dimensions.logo * 4}px`,
          height: `${dimensions.logo * 4}px`,
          background: `linear-gradient(135deg, ${colors.primary}40, ${colors.secondary}40)`,
          boxShadow: `0 0 20px ${colors.glow}`,
        }}
      >
        <img 
          src="/images/icon-192.png" 
          alt="BFC" 
          className="object-contain"
          style={{ width: `${dimensions.logo * 2.5}px`, height: `${dimensions.logo * 2.5}px` }}
        />
      </div>
      
      {/* Pulse rings */}
      <PulseRingAnimation isActive={isAnimating} color={colors.primary} />
    </div>
  );
};

// Sound Wave Animation for Speaking State
const SoundWaveAnimation = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-gradient-to-t from-blue-900 to-blue-600 rounded-full"
          style={{
            height: '100%',
            animation: `soundWave 0.5s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes soundWave {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
};

// Streak Badge Component
const StreakBadge = ({ streak }: { streak: UserStreak }) => {
  if (streak.currentStreak < 1) return null;
  
  const getBadgeColor = () => {
    if (streak.currentStreak >= 30) return { bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', text: '#78350f' }; // Gold
    if (streak.currentStreak >= 14) return { bg: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)', text: '#4c1d95' }; // Purple
    if (streak.currentStreak >= 7) return { bg: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)', text: '#1e3a8a' }; // Blue
    if (streak.currentStreak >= 3) return { bg: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)', text: '#064e3b' }; // Green
    return { bg: 'linear-gradient(135deg, #BE5103 0%, #8B3A02 100%)', text: '#ffffff' }; // Default copper
  };
  
  const colors = getBadgeColor();
  
  return (
    <div 
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold shadow-lg"
      style={{ background: colors.bg, color: colors.text }}
    >
      <Flame size={16} className="animate-pulse" />
      <span>{streak.currentStreak}-day streak!</span>
      {streak.currentStreak >= 7 && <Award size={16} />}
    </div>
  );
};

// Usage Limit Alert Component (only shows when limit reached)
const UsageLimitAlert = ({ usage }: { usage: UsageStats | null }) => {
  if (!usage || usage.remaining > 0) return null;
  
  return (
    <div 
      className="relative p-4 text-center backdrop-blur-sm"
      style={{ 
        background: 'linear-gradient(90deg, rgba(220, 38, 38, 0.95) 0%, rgba(190, 81, 3, 0.9) 100%)',
        borderBottom: '1px solid rgba(220, 38, 38, 0.5)'
      }}
    >
      <div className="flex items-center justify-center gap-3">
        <Flame size={20} className="text-yellow-300 animate-pulse" />
        <div>
          <p className="font-semibold text-white">Daily limit reached!</p>
          <p className="text-sm text-white/80">
            {usage.is_premium 
              ? "You've used all 3000 messages today. Limit resets at midnight."
              : "Upgrade to Premium for 3000 messages/day!"
            }
          </p>
        </div>
      </div>
      {!usage.is_premium && (
        <button 
          className="mt-3 px-6 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            color: '#78350f'
          }}
        >
          ⭐ Upgrade to Premium
        </button>
      )}
    </div>
  );
};

// Daily Tip Component
const DailyTip = () => {
  const [tipIndex, setTipIndex] = useState(0);
  
  useEffect(() => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    setTipIndex(dayOfYear);
  }, []);
  
  const tip = getTodaysTip(tipIndex);
  
  return (
    <div 
      className="flex items-start gap-3 p-4 rounded-xl mx-4 mb-4"
      style={{ 
        background: 'linear-gradient(135deg, rgba(190, 81, 3, 0.15) 0%, rgba(17, 17, 132, 0.1) 100%)',
        border: '1px solid rgba(190, 81, 3, 0.3)'
      }}
    >
      <div className="text-2xl">{tip.icon}</div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb size={14} style={{ color: '#BE5103' }} />
          <span className="text-xs font-semibold" style={{ color: '#BE5103' }}>Daily Tip</span>
        </div>
        <p className="text-sm" style={{ color: '#F5E6D3' }}>{tip.tip}</p>
      </div>
    </div>
  );
};

// Conversation Starters Component
const ConversationStarters = ({ onSelect }: { onSelect: (text: string) => void }) => {
  return (
    <div className="px-4 mb-4">
      <p className="text-xs mb-3" style={{ color: '#A89080' }}>Try asking:</p>
      <div className="grid grid-cols-2 gap-2">
        {CONVERSATION_STARTERS.map((starter, index) => (
          <button
            key={index}
            onClick={() => onSelect(starter.text)}
            className="flex items-center gap-2 p-3 rounded-xl text-left text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${starter.color}20 0%, ${starter.color}10 100%)`,
              border: `1px solid ${starter.color}40`,
              color: '#F5E6D3'
            }}
          >
            <span style={{ color: starter.color }}>{starter.icon}</span>
            <span>{starter.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Futuristic Typing Indicator - Holographic Fitness Tech Style
const TypingIndicator = () => {
  return (
    <div 
      className="flex flex-col items-center justify-center py-8 px-6 gap-5"
      style={{
        background: 'radial-gradient(ellipse at center, rgba(14, 165, 233, 0.08) 0%, transparent 70%)',
      }}
    >
      {/* Main Holographic Container */}
      <div className="relative flex items-center justify-center w-32 h-32">
        
        {/* Outer Hexagonal Glow Ring */}
        <div
          className="absolute w-32 h-32 animate-spin"
          style={{
            animationDuration: '8s',
            background: 'conic-gradient(from 0deg, transparent, #0EA5E9, transparent, #22D3EE, transparent)',
            mask: 'radial-gradient(circle, transparent 60%, black 61%, black 65%, transparent 66%)',
            WebkitMask: 'radial-gradient(circle, transparent 60%, black 61%, black 65%, transparent 66%)',
            filter: 'drop-shadow(0 0 10px rgba(14, 165, 233, 0.6))',
          }}
        />
        
        {/* Middle Tech Ring - Counter Rotation */}
        <div
          className="absolute w-24 h-24 rounded-full animate-spin"
          style={{
            animationDuration: '4s',
            animationDirection: 'reverse',
            border: '1px solid rgba(34, 211, 238, 0.4)',
            boxShadow: '0 0 20px rgba(34, 211, 238, 0.2), inset 0 0 20px rgba(34, 211, 238, 0.1)',
          }}
        />
        
        {/* Inner Pulsing Core */}
        <div
          className="absolute w-16 h-16 rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, transparent 70%)',
            boxShadow: '0 0 30px rgba(14, 165, 233, 0.4)',
          }}
        />
        
        {/* DNA Helix Animation */}
        <svg className="absolute w-20 h-20" viewBox="0 0 80 80">
          {/* Helix strand 1 */}
          <path
            d="M20,10 Q40,25 20,40 Q0,55 20,70"
            fill="none"
            stroke="url(#helixGradient1)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 0 4px #0EA5E9)',
              animation: 'helixRotate 2s ease-in-out infinite',
            }}
          />
          {/* Helix strand 2 */}
          <path
            d="M60,10 Q40,25 60,40 Q80,55 60,70"
            fill="none"
            stroke="url(#helixGradient2)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              filter: 'drop-shadow(0 0 4px #22D3EE)',
              animation: 'helixRotate 2s ease-in-out infinite reverse',
            }}
          />
          {/* Connecting bars */}
          {[18, 30, 42, 54].map((y, i) => (
            <line
              key={i}
              x1="28"
              y1={y}
              x2="52"
              y2={y}
              stroke="rgba(34, 211, 238, 0.6)"
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{
                animation: `barPulse 1.5s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
          <defs>
            <linearGradient id="helixGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="50%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#0EA5E9" />
            </linearGradient>
            <linearGradient id="helixGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="50%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Floating Hexagon Particles */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: '8px',
              height: '8px',
              background: i % 2 === 0 ? '#0EA5E9' : '#22D3EE',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              animation: `floatParticle 3s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
              top: `${15 + Math.sin(i * 60 * Math.PI / 180) * 40}%`,
              left: `${50 + Math.cos(i * 60 * Math.PI / 180) * 45}%`,
              filter: 'drop-shadow(0 0 4px currentColor)',
              opacity: 0.8,
            }}
          />
        ))}
        
        {/* Center Glowing Orb with Copper Accent */}
        <div
          className="absolute w-6 h-6 rounded-full"
          style={{
            background: 'radial-gradient(circle, #BE5103 0%, #0EA5E9 50%, transparent 70%)',
            boxShadow: '0 0 20px #BE5103, 0 0 40px rgba(14, 165, 233, 0.5)',
            animation: 'orbPulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
      
      {/* Holographic ECG Wave */}
      <div className="relative w-full h-10 overflow-hidden">
        <svg viewBox="0 0 300 40" className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines for tech feel */}
          {[...Array(15)].map((_, i) => (
            <line
              key={i}
              x1={i * 20}
              y1="0"
              x2={i * 20}
              y2="40"
              stroke="rgba(14, 165, 233, 0.1)"
              strokeWidth="0.5"
            />
          ))}
          <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(14, 165, 233, 0.15)" strokeWidth="0.5" />
          
          {/* Main ECG Wave */}
          <path
            d="M0,20 L60,20 L75,20 L85,8 L95,32 L105,3 L115,37 L125,20 L140,20 L300,20"
            fill="none"
            stroke="url(#ecgGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 0 6px #0EA5E9)',
            }}
          />
          
          {/* Scanning Line Effect */}
          <rect
            x="0"
            y="0"
            width="40"
            height="40"
            fill="url(#scanGradient)"
            style={{
              animation: 'scanLine 2.5s linear infinite',
            }}
          />
          
          {/* Traveling Energy Pulse */}
          <circle r="5" fill="#BE5103" style={{ filter: 'drop-shadow(0 0 8px #BE5103) drop-shadow(0 0 15px #0EA5E9)' }}>
            <animateMotion
              path="M0,20 L60,20 L75,20 L85,8 L95,32 L105,3 L115,37 L125,20 L140,20 L300,20"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </circle>
          
          {/* Secondary smaller pulse */}
          <circle r="3" fill="#22D3EE" opacity="0.7" style={{ filter: 'drop-shadow(0 0 4px #22D3EE)' }}>
            <animateMotion
              path="M0,20 L60,20 L75,20 L85,8 L95,32 L105,3 L115,37 L125,20 L140,20 L300,20"
              dur="2.5s"
              begin="0.3s"
              repeatCount="indefinite"
            />
          </circle>
          
          <defs>
            <linearGradient id="ecgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.3)" />
              <stop offset="30%" stopColor="#0EA5E9" />
              <stop offset="50%" stopColor="#22D3EE" />
              <stop offset="70%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="rgba(14, 165, 233, 0.3)" />
            </linearGradient>
            <linearGradient id="scanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="rgba(34, 211, 238, 0.3)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {/* Futuristic Sound Bars */}
      <div className="flex items-end justify-center gap-1.5 h-8">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full"
            style={{
              background: `linear-gradient(to top, #0C4A6E, ${i % 2 === 0 ? '#0EA5E9' : '#22D3EE'})`,
              height: '100%',
              animation: 'soundBarFloat 0.8s ease-in-out infinite',
              animationDelay: `${i * 0.08}s`,
              boxShadow: `0 0 8px ${i % 2 === 0 ? 'rgba(14, 165, 233, 0.6)' : 'rgba(34, 211, 238, 0.6)'}`,
            }}
          />
        ))}
      </div>
      
      {/* Holographic Text */}
      <div className="flex items-center gap-3">
        <span 
          className="text-sm font-semibold tracking-widest uppercase"
          style={{ 
            color: '#22D3EE',
            textShadow: '0 0 10px rgba(34, 211, 238, 0.5), 0 0 20px rgba(14, 165, 233, 0.3)',
            letterSpacing: '0.15em',
          }}
        >
          Analyzing
        </span>
        <span className="flex gap-1.5">
          {[...Array(3)].map((_, i) => (
            <span
              key={i}
              className="inline-block w-2 h-2"
              style={{
                background: '#0EA5E9',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                animation: 'hexPulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
                filter: 'drop-shadow(0 0 4px #0EA5E9)',
              }}
            />
          ))}
        </span>
      </div>
      
      <style jsx>{`
        @keyframes helixRotate {
          0%, 100% { transform: scaleX(1); opacity: 0.8; }
          50% { transform: scaleX(0.8); opacity: 1; }
        }
        @keyframes barPulse {
          0%, 100% { opacity: 0.3; transform: scaleX(0.8); }
          50% { opacity: 1; transform: scaleX(1); }
        }
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.8; }
          50% { transform: translateY(-8px) scale(1.2); opacity: 1; }
        }
        @keyframes orbPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.3); opacity: 1; }
        }
        @keyframes scanLine {
          0% { transform: translateX(-40px); }
          100% { transform: translateX(300px); }
        }
        @keyframes soundBarFloat {
          0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes hexPulse {
          0%, 100% { transform: scale(0.8) rotate(0deg); opacity: 0.4; }
          50% { transform: scale(1.2) rotate(30deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export function VoiceChat({ className = '' }: { className?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [streak, setStreak] = useState<UserStreak>({ currentStreak: 0, lastVisit: '', totalVisits: 0 });
  const [showWelcome, setShowWelcome] = useState(true);
  
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const voiceModeRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  // Determine animation state
  const getAnimationState = (): 'listening' | 'speaking' | 'loading' | 'idle' => {
    if (isListening || recorderState.isRecording) return 'listening';
    if (isSpeaking) return 'speaking';
    if (isLoading) return 'loading';
    return 'idle';
  };

  // Initialize session and streak
  useEffect(() => {
    const initSession = async () => {
      try {
        // Update streak
        const updatedStreak = updateStreak();
        setStreak(updatedStreak);
        
        // Create session
        const session = await wordpressClient.createSession();
        setSessionReady(true);
        
        // Fetch usage stats
        try {
          const usageResponse = await fetch(`${process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://bestfitcoach.com'}/wp-json/voice-chat/v1/usage`, {
            credentials: 'include'
          });
          if (usageResponse.ok) {
            const usageData = await usageResponse.json();
            if (usageData.success) {
              setUsage(usageData.usage);
            }
          }
        } catch (e) {
          console.log('Could not fetch usage stats');
        }
        
        // Show personalized welcome for returning users
        if (session.has_memories) {
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: `Good to have you back! I remember our previous conversations. How can I help you today?`,
            timestamp: new Date(),
          }]);
          setShowWelcome(false);
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

  const copyMessage = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const stopAllAudio = useCallback(() => {
    document.querySelectorAll('audio').forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setShowWelcome(true);
    setError(null);
  }, []);

  const playAudio = useCallback(async (base64Audio: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setIsSpeaking(true);
      
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          resolve();
        };
        
        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          reject(e);
        };
        
        audio.play();
      } catch (error) {
        setIsSpeaking(false);
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
    setShowWelcome(false);

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

      // Update usage counter
      if (usage) {
        setUsage(prev => prev ? { ...prev, remaining: Math.max(0, prev.remaining - 1) } : null);
      }

      setIsLoading(false);

      if (response.audio && autoSpeak && voiceModeRef.current) {
        await playAudio(response.audio);
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
  }, [recorderState.isRecording, stopRecording, autoSpeak, playAudio, startListening, usage]);

  const toggleVoiceMode = useCallback(async () => {
    if (voiceMode) {
      setVoiceMode(false);
      voiceModeRef.current = false;
      setIsListening(false);
      if (recorderState.isRecording) {
        cancelRecording();
      }
      stopAllAudio();
    } else {
      setVoiceMode(true);
      voiceModeRef.current = true;
      setShowWelcome(false);
      await startListening();
    }
  }, [voiceMode, recorderState.isRecording, cancelRecording, startListening, stopAllAudio]);

  const handleVoiceTap = useCallback(async () => {
    if (recorderState.isRecording) {
      await processVoiceAndContinue();
    }
  }, [recorderState.isRecording, processVoiceAndContinue]);

  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    setShowWelcome(false);

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

      // Update usage counter
      if (usage) {
        setUsage(prev => prev ? { ...prev, remaining: Math.max(0, prev.remaining - 1) } : null);
      }

      if (autoSpeak && response.ai_response) {
        try {
          const audioBlob = await wordpressClient.generateSpeech(response.ai_response, 'onyx');
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            playAudio(base64);
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
  }, [isLoading, autoSpeak, playAudio, usage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendTextMessage(inputText);
  };

  const handleStarterSelect = (text: string) => {
    sendTextMessage(text);
  };

  const getVoiceBannerStyle = () => {
    if (isListening) return { background: 'linear-gradient(90deg, #dc2626 0%, #BE5103 100%)' };
    if (isSpeaking) return { background: 'linear-gradient(90deg, #111184 0%, #550000 100%)' };
    if (isLoading) return { background: 'linear-gradient(90deg, #BE5103 0%, #550000 100%)' };
    return { background: 'linear-gradient(90deg, #16a34a 0%, #15803d 100%)' };
  };

  const animationState = getAnimationState();

  return (
    <div className={`flex flex-col h-full relative overflow-hidden ${className}`}>
      {/* Luxury gradient background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at top left, rgba(17, 17, 132, 0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(190, 81, 3, 0.1) 0%, transparent 50%), linear-gradient(160deg, #0d0d0d 0%, #1a1209 25%, #1c1410 50%, #12101a 75%, #0d0d0d 100%)'
        }}
      />
      
      {/* Heartbeat line at bottom */}
      <HeartbeatLine isActive={voiceMode && (isListening || isSpeaking || isLoading)} />
      
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
        <div className="flex items-center gap-2">
          {/* Streak Badge */}
          <StreakBadge streak={streak} />
          {/* Clear Chat Button */}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2 rounded-full transition-all hover:scale-110"
              style={{
                background: 'rgba(85, 0, 0, 0.6)',
                color: '#E8C4A0'
              }}
              title="Clear chat"
            >
              <Trash2 size={18} />
            </button>
          )}
          {/* Sound Toggle */}
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
      </div>

      {/* Usage Limit Alert - Only shows when limit reached */}
      <UsageLimitAlert usage={usage} />

      {/* Error display */}
      {error && (
        <div className="relative p-3 text-sm text-center backdrop-blur-sm" style={{ background: 'rgba(220, 38, 38, 0.9)', color: '#ffffff' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:opacity-80">Dismiss</button>
        </div>
      )}

      {/* Voice Mode Banner with Animation */}
      {voiceMode && (
        <div 
          className="relative p-6 text-center text-white backdrop-blur-sm flex flex-col items-center justify-center gap-4"
          style={getVoiceBannerStyle()}
        >
          {/* Futuristic Animation */}
          <FitnessLoadingAnimation state={animationState} />
          
          {/* Sound Wave for Speaking */}
          {isSpeaking && <SoundWaveAnimation isActive={true} />}
          
          {/* Status Text */}
          <span className="font-medium text-lg">
            {isListening && '🎤 Listening... Tap when done speaking'}
            {isSpeaking && '🔊 Coach is speaking...'}
            {isLoading && '⏳ Processing your message...'}
            {!isListening && !isSpeaking && !isLoading && '✅ Ready - Tap to speak'}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome Screen */}
        {showWelcome && messages.length === 0 && !voiceMode && (
          <div className="text-center py-6">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <FitnessLoadingAnimation state="idle" />
            </div>
            <p className="text-xl mb-1 font-semibold" style={{ color: '#F5E6D3' }}>Hey there! I'm Coach BFC</p>
            <p className="mb-6" style={{ color: '#A89080' }}>Your personal AI fitness coach. What's your goal today?</p>
            
            {/* Streak celebration for returning users */}
            {streak.currentStreak > 1 && (
              <div className="mb-6">
                <StreakBadge streak={streak} />
                <p className="text-sm mt-2" style={{ color: '#A89080' }}>Keep it up! Consistency is key! 🔥</p>
              </div>
            )}
            
            {/* Daily Tip */}
            <DailyTip />
            
            {/* Conversation Starters */}
            <ConversationStarters onSelect={handleStarterSelect} />
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className="max-w-[85%] rounded-2xl px-4 py-3 relative group"
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
              
              {/* Copy button */}
              <button
                onClick={() => copyMessage(message.id, message.content)}
                className="absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: message.role === 'user' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                }}
                title="Copy message"
              >
                {copiedId === message.id ? (
                  <Check size={14} className={message.role === 'user' ? 'text-green-300' : 'text-green-600'} />
                ) : (
                  <Copy size={14} className={message.role === 'user' ? 'text-white/70' : 'text-gray-500'} />
                )}
              </button>
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isLoading && !voiceMode && (
          <div className="flex justify-start">
            <div 
              className="max-w-[85%] rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #F5F0EB 0%, #EDE5DC 100%)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
              }}
            >
              <TypingIndicator />
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
