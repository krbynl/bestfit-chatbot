'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Phone, PhoneOff, Copy, Check, Trash2, Lightbulb, Target, Dumbbell, Heart, Flame, Award, ChevronDown, X, Plus } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { wordpressClient } from '@/lib/wordpress-client';
import { useAuth } from '@/hooks/useAuth';

// =============================================================================
// TYPES
// =============================================================================

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

// Better Self Types
interface BetterSelfData {
  id: number;
  better_self_name: string;
  why_statement: string;
  program_weeks: number;
  start_date: string;
  target_date: string;
  status: string;
  total_workouts: number;
  current_streak: number;
}

interface GapMetric {
  current: number;
  projected: number;
  goal: number;
  diff: number;
  status: 'ahead' | 'behind' | 'on_track';
  unit: string;
}

interface GapData {
  week: number;
  total_weeks: number;
  progress_percent: number;
  days_remaining: number;
  overall_status: 'ahead' | 'on_track' | 'slightly_behind' | 'behind';
  better_self_name: string;
  why_statement: string;
  metrics: Record<string, GapMetric>;
}

// Chat component props (for compatibility with pages expecting Chat)
interface ChatProps {
  id?: string;
  autoResume?: boolean;
  initialChatModel?: string;
  initialMessages?: any[];
  initialVisibilityType?: string;
  isReadonly?: boolean;
  className?: string;
  initialLastContext?: any;
  key?: string;
  [key: string]: any;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_WORDPRESS_URL || 'https://bestfitcoach.com';

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
  { icon: <Target size={16} />, text: "Help me set a fitness goal", color: '#BE5103' },
  { icon: <Dumbbell size={16} />, text: "Create a workout plan", color: '#111184' },
  { icon: <Heart size={16} />, text: "Nutrition advice", color: '#dc2626' },
  { icon: <Flame size={16} />, text: "How to lose weight", color: '#ea580c' },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getTodaysTip = (tipIndex: number) => {
  return DAILY_TIPS[tipIndex % DAILY_TIPS.length];
};

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
  if (current.lastVisit === today) return current;
  let newStreak: UserStreak;
  if (current.lastVisit === yesterday) {
    newStreak = { currentStreak: current.currentStreak + 1, lastVisit: today, totalVisits: current.totalVisits + 1 };
  } else if (current.lastVisit === '') {
    newStreak = { currentStreak: 1, lastVisit: today, totalVisits: 1 };
  } else {
    newStreak = { currentStreak: 1, lastVisit: today, totalVisits: current.totalVisits + 1 };
  }
  localStorage.setItem('bfc_streak', JSON.stringify(newStreak));
  return newStreak;
};

// Better Self Helpers
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    ahead: '#22c55e',
    on_track: '#3b82f6',
    slightly_behind: '#f59e0b',
    behind: '#ef4444',
  };
  return colors[status] || '#6b7280';
};

const getStatusEmoji = (status: string) => {
  const emojis: Record<string, string> = {
    ahead: '🚀',
    on_track: '✅',
    slightly_behind: '⚡',
    behind: '💪',
  };
  return emojis[status] || '🎯';
};

const getStatusText = (status: string, name = 'Better Self') => {
  const texts: Record<string, string> = {
    ahead: `Ahead of ${name}!`,
    on_track: `On track`,
    slightly_behind: `Catching up`,
    behind: `Keep going`,
  };
  return texts[status] || 'In progress';
};

// =============================================================================
// ANIMATION COMPONENTS
// =============================================================================

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

const HeartbeatLine = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  return (
    <div className="absolute bottom-0 left-0 right-0 h-12 sm:h-16 overflow-hidden opacity-50">
      <svg viewBox="0 0 400 50" className="w-full h-full">
        <path
          d="M0,25 L50,25 L60,25 L70,10 L80,40 L90,5 L100,45 L110,25 L120,25 L400,25"
          fill="none"
          stroke="#BE5103"
          strokeWidth="2"
          className="animate-pulse"
          style={{ strokeDasharray: '400', strokeDashoffset: '400', animation: 'heartbeat 2s linear infinite' }}
        />
      </svg>
      <style jsx>{`@keyframes heartbeat { 0% { stroke-dashoffset: 400; } 100% { stroke-dashoffset: 0; } }`}</style>
    </div>
  );
};

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
  const dimensions = size === 'small' ? { outer: 20, middle: 16, inner: 12, logo: 8 } : { outer: 28, middle: 20, inner: 16, logo: 12 };

  return (
    <div className="relative flex items-center justify-center" style={{ width: `${dimensions.outer * 4}px`, height: `${dimensions.outer * 4}px` }}>
      <div
        className={`absolute rounded-full border-4 border-transparent ${isAnimating ? 'animate-spin' : ''}`}
        style={{ width: `${dimensions.outer * 4}px`, height: `${dimensions.outer * 4}px`, borderTopColor: colors.primary, borderRightColor: colors.secondary, animationDuration: '3s', boxShadow: `0 0 20px ${colors.glow}` }}
      />
      <div
        className={`absolute rounded-full border-2 ${isAnimating ? 'animate-pulse' : ''}`}
        style={{ width: `${dimensions.middle * 4}px`, height: `${dimensions.middle * 4}px`, borderColor: colors.primary, opacity: 0.6, boxShadow: `0 0 15px ${colors.glow}, inset 0 0 15px ${colors.glow}` }}
      />
      <svg className="absolute" style={{ width: `${dimensions.inner * 4}px`, height: `${dimensions.inner * 4}px` }} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(190, 81, 3, 0.2)" strokeWidth="8" />
        <circle cx="50" cy="50" r="45" fill="none" stroke={colors.primary} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${isAnimating ? '200' : '0'} 283`} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 0.5s ease', filter: `drop-shadow(0 0 6px ${colors.glow})` }}>
          {isAnimating && <animate attributeName="stroke-dasharray" values="0 283;141 283;283 283;141 283;0 283" dur="2s" repeatCount="indefinite" />}
        </circle>
      </svg>
      <div className={`relative rounded-full flex items-center justify-center overflow-hidden ${isAnimating ? 'animate-pulse' : ''}`} style={{ width: `${dimensions.logo * 4}px`, height: `${dimensions.logo * 4}px`, background: `linear-gradient(135deg, ${colors.primary}40, ${colors.secondary}40)`, boxShadow: `0 0 20px ${colors.glow}` }}>
        <img src="/images/icon-192.png" alt="BFC" className="object-contain" style={{ width: `${dimensions.logo * 2.5}px`, height: `${dimensions.logo * 2.5}px` }} />
      </div>
      <PulseRingAnimation isActive={isAnimating} color={colors.primary} />
    </div>
  );
};

const SoundWaveAnimation = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  return (
    <div className="flex items-center justify-center gap-1 h-6 sm:h-8">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="w-1 bg-gradient-to-t from-blue-900 to-blue-600 rounded-full" style={{ height: '100%', animation: `soundWave 0.5s ease-in-out infinite alternate`, animationDelay: `${i * 0.1}s` }} />
      ))}
      <style jsx>{`@keyframes soundWave { 0% { transform: scaleY(0.3); } 100% { transform: scaleY(1); } }`}</style>
    </div>
  );
};

// =============================================================================
// COMBINED STREAK + BETTER SELF BADGE (Always Visible)
// =============================================================================

const CombinedProgressBadge = ({ 
  streak, 
  gap, 
  loading,
  hasChallenge,
  onClick 
}: { 
  streak: UserStreak;
  gap: GapData | null; 
  loading: boolean;
  hasChallenge: boolean;
  onClick: () => void;
}) => {
  const statusLabels: Record<string, string> = {
    ahead: 'Ahead!',
    on_track: 'On Track',
    slightly_behind: 'Catching Up',
    behind: 'Keep Going',
  };

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        background: 'linear-gradient(135deg, rgba(190, 81, 3, 0.3) 0%, rgba(85, 0, 0, 0.4) 100%)',
        border: '1px solid rgba(190, 81, 3, 0.5)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      }}
      title={hasChallenge ? `View your Better Self progress` : 'Start your Better Self challenge!'}
    >
      {/* Streak Section */}
      <span className="flex items-center gap-1 text-orange-400">
        <Flame size={14} className={streak.currentStreak >= 3 ? 'animate-pulse' : ''} />
        <span className="font-bold">{streak.currentStreak}d</span>
      </span>
      
      {/* Divider */}
      <span className="text-white/30">|</span>
      
      {/* Better Self Section */}
      {loading ? (
        <span className="flex items-center gap-1 text-white/60">
          <span>🎯</span>
          <span>...</span>
        </span>
      ) : hasChallenge && gap ? (
        <span className="flex items-center gap-1">
          <span>🎯</span>
          <span className="text-white/80">W{gap.week}/{gap.total_weeks}</span>
          <span>{getStatusEmoji(gap.overall_status)}</span>
          <span style={{ color: getStatusColor(gap.overall_status) }}>
            {statusLabels[gap.overall_status] || 'In Progress'}
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300">
          <span>🎯</span>
          <Plus size={12} />
          <span>Challenge</span>
        </span>
      )}
      
      {/* Expand indicator */}
      <ChevronDown size={12} className="text-white/40 ml-0.5" />
    </button>
  );
};

// =============================================================================
// BETTER SELF COMPONENTS
// =============================================================================

// Expandable Panel (Layer 2)
const BetterSelfPanel = ({ 
  gap, 
  data,
  hasChallenge,
  isOpen, 
  onClose,
  onRecalibrate,
  onStartChallenge
}: { 
  gap: GapData | null;
  data: BetterSelfData | null;
  hasChallenge: boolean;
  isOpen: boolean; 
  onClose: () => void;
  onRecalibrate: () => void;
  onStartChallenge: () => void;
}) => {
  if (!isOpen) return null;

  // No challenge - show "Start Challenge" prompt
  if (!hasChallenge || !gap) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-[999]" onClick={onClose} />
        <div className="fixed bottom-0 left-0 right-0 z-[1000] p-3 sm:p-4 flex justify-center">
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border border-white/10 text-white overflow-hidden max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-black/20">
              <h3 className="text-sm font-bold tracking-wide">🎯 BETTER SELF CHALLENGER</h3>
              <button onClick={onClose} className="text-white/60 hover:text-white text-lg p-1"><X size={18} /></button>
            </div>

            {/* Content */}
            <div className="p-6 text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h4 className="text-xl font-bold mb-2">Start Your Transformation</h4>
              <p className="text-white/70 text-sm mb-6">
                Compete against your future self! Set goals, track progress, and become the person you want to be.
              </p>
              
              <div className="space-y-3 text-left bg-white/5 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-2xl">👤</span>
                  <span className="text-white/80">Create your "Better Self" - the you in 12 weeks</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-2xl">📊</span>
                  <span className="text-white/80">Track weekly progress & compete with projections</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-2xl">🏆</span>
                  <span className="text-white/80">Unlock milestones & celebrate achievements</span>
                </div>
              </div>
              
              <button 
                onClick={onStartChallenge}
                className="w-full py-3 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  boxShadow: '0 4px 15px rgba(34, 197, 94, 0.4)',
                }}
              >
                🎯 Start My Challenge
              </button>
              
              <p className="text-white/40 text-xs mt-4">
                Just tell Coach BFC your goals and we'll set it up together!
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const statusColor = getStatusColor(gap.overall_status);
  const statusEmoji = getStatusEmoji(gap.overall_status);
  const statusText = getStatusText(gap.overall_status, gap.better_self_name);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[999]" onClick={onClose} />
      
      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-[1000] p-3 sm:p-4 flex justify-center">
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border border-white/10 text-white overflow-hidden max-w-md w-full shadow-2xl">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-black/20">
            <h3 className="text-sm font-bold tracking-wide">🎯 BETTER SELF CHALLENGER</h3>
            <button onClick={onClose} className="text-white/60 hover:text-white text-lg p-1"><X size={18} /></button>
          </div>

          {/* Progress */}
          <div className="p-4">
            <div className="flex justify-between text-xs text-white/60 mb-2">
              <span>👤 You</span>
              <span>🌟 {gap.better_self_name}</span>
            </div>
            <div className="relative h-2 bg-white/10 rounded-full overflow-visible">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${gap.progress_percent}%`, backgroundColor: statusColor }}
              />
              <div className="absolute -top-4 transition-all duration-500 text-sm" style={{ left: `${Math.min(gap.progress_percent, 90)}%` }}>👤</div>
              <div className="absolute -top-4 right-0 text-sm">🌟</div>
            </div>
            <div className="flex justify-between text-xs text-white/50 mt-3">
              <span>Week {gap.week} of {gap.total_weeks}</span>
              <span>{gap.progress_percent}%</span>
              <span>{gap.days_remaining} days left</span>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-2 mx-4 py-2 rounded-lg border" style={{ borderColor: statusColor, background: 'rgba(255,255,255,0.05)' }}>
            <span className="text-lg">{statusEmoji}</span>
            <span className="font-bold text-sm" style={{ color: statusColor }}>{statusText}</span>
          </div>

          {/* Metrics */}
          <div className="p-4">
            <h4 className="text-xs text-white/50 mb-2 tracking-wide">📊 YOUR METRICS vs {gap.better_self_name.toUpperCase()}</h4>
            <div className="space-y-1.5">
              {Object.entries(gap.metrics).map(([key, metric]) => (
                <div key={key} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-xs">
                  <span className="capitalize">{key}</span>
                  <span>
                    <span className="font-semibold">{metric.current}</span>
                    <span className="text-white/50 mx-1">vs</span>
                    <span className="text-white/50">{metric.projected}</span>
                  </span>
                  <span style={{ color: metric.status === 'ahead' ? '#22c55e' : metric.status === 'behind' ? '#ef4444' : '#6b7280' }}>
                    {metric.status === 'ahead' ? '✅' : metric.status === 'behind' ? '⚠️' : '➖'}
                    {metric.diff >= 0 ? '+' : ''}{metric.diff}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-4 pb-4">
            <button onClick={onRecalibrate} className="flex-1 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg font-semibold text-xs transition-colors">
              🔄 Recalibrate
            </button>
          </div>

          {/* Why */}
          {gap.why_statement && (
            <div className="px-4 py-3 bg-black/20 border-t border-white/10">
              <p className="text-xs text-white/50 mb-1">💭 Your WHY:</p>
              <p className="text-xs italic text-white/80">"{gap.why_statement}"</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// Celebration Modal
const CelebrationModal = ({ celebration, onClose }: { celebration: string; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const lines = celebration.split('\n').filter(l => l.trim() && !l.includes('━'));
  const title = lines[1] || 'Milestone Unlocked!';
  const description = lines[2] || '';
  const emoji = celebration.match(/[🏆🔥💪📅🎯✅⭐👑🚀⚡🌟]/)?.[0] || '🏆';

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[9999]">
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2.5 h-2.5 -top-2.5 rounded-sm"
            style={{
              left: `${Math.random() * 100}%`,
              animation: `confettiFall 3s linear forwards`,
              animationDelay: `${Math.random() * 2}s`,
              backgroundColor: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6'][i % 5],
            }}
          />
        ))}
      </div>

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl p-8 text-center max-w-sm w-11/12 border-2 border-yellow-500/30 shadow-2xl animate-bounce-in">
        <button onClick={onClose} className="absolute top-3 right-3 text-white/50 hover:text-white text-xl">✕</button>
        <div className="text-5xl mb-4 animate-bounce">🏆</div>
        <h2 className="text-yellow-400 text-base font-extrabold tracking-widest mb-4">MILESTONE UNLOCKED!</h2>
        <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center text-3xl shadow-lg">{emoji}</div>
        <h3 className="text-lg font-bold text-white mb-2">{title.replace(/[🏆🔥💪📅🎯✅⭐👑🚀⚡🌟]/g, '').trim()}</h3>
        <p className="text-white/70 text-sm mb-5">{description}</p>
        <button onClick={onClose} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full font-bold text-sm hover:scale-105 transition-transform">
          Keep Going! 💪
        </button>
      </div>

      <style jsx>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotateZ(0); opacity: 1; }
          100% { transform: translateY(100vh) rotateZ(720deg); opacity: 0; }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounce-in { animation: bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>
    </div>
  );
};

// =============================================================================
// OTHER UI COMPONENTS
// =============================================================================

const UsageLimitAlert = ({ usage }: { usage: UsageStats | null }) => {
  if (!usage || usage.remaining > 0) return null;
  return (
    <div className="relative p-3 sm:p-4 text-center backdrop-blur-sm" style={{ background: 'linear-gradient(90deg, rgba(220, 38, 38, 0.95) 0%, rgba(190, 81, 3, 0.9) 100%)', borderBottom: '1px solid rgba(220, 38, 38, 0.5)' }}>
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        <Flame size={18} className="text-yellow-300 animate-pulse" />
        <div>
          <p className="font-semibold text-white text-sm sm:text-base">Daily limit reached!</p>
          <p className="text-xs sm:text-sm text-white/80">{usage.is_premium ? "You've used all 3000 messages today." : "Upgrade to Premium for 3000 messages/day!"}</p>
        </div>
      </div>
    </div>
  );
};

const DailyTip = () => {
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    setTipIndex(dayOfYear);
  }, []);
  const tip = getTodaysTip(tipIndex);
  return (
    <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl mx-2 sm:mx-4 mb-3 sm:mb-4" style={{ background: 'linear-gradient(135deg, rgba(190, 81, 3, 0.15) 0%, rgba(17, 17, 132, 0.1) 100%)', border: '1px solid rgba(190, 81, 3, 0.3)' }}>
      <div className="text-xl sm:text-2xl">{tip.icon}</div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb size={12} style={{ color: '#BE5103' }} />
          <span className="text-xs font-semibold" style={{ color: '#BE5103' }}>Daily Tip</span>
        </div>
        <p className="text-xs sm:text-sm" style={{ color: '#F5E6D3' }}>{tip.tip}</p>
      </div>
    </div>
  );
};

const ConversationStarters = ({ onSelect }: { onSelect: (text: string) => void }) => {
  return (
    <div className="px-2 sm:px-4 mb-3 sm:mb-4">
      <p className="text-xs mb-2 sm:mb-3" style={{ color: '#A89080' }}>Try asking:</p>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {CONVERSATION_STARTERS.map((starter, index) => (
          <button key={index} onClick={() => onSelect(starter.text)} className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg sm:rounded-xl text-left text-xs sm:text-sm transition-all hover:scale-[1.02] active:scale-[0.98]" style={{ background: `linear-gradient(135deg, ${starter.color}20 0%, ${starter.color}10 100%)`, border: `1px solid ${starter.color}40`, color: '#F5E6D3' }}>
            <span style={{ color: starter.color }}>{starter.icon}</span>
            <span className="line-clamp-2">{starter.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const TypingIndicator = () => {
  return (
    <div className="flex items-center justify-center py-3 sm:py-4 px-3 sm:px-4 gap-3 sm:gap-4" style={{ background: 'linear-gradient(135deg, rgba(13, 13, 13, 0.95) 0%, rgba(20, 15, 10, 0.95) 50%, rgba(12, 10, 18, 0.95) 100%)', borderRadius: '12px' }}>
      <div className="relative flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14">
        <div className="absolute w-10 h-10 sm:w-14 sm:h-14 animate-spin" style={{ animationDuration: '6s', background: 'conic-gradient(from 0deg, transparent, #0EA5E9, transparent, #22D3EE, transparent)', mask: 'radial-gradient(circle, transparent 55%, black 56%, black 62%, transparent 63%)', WebkitMask: 'radial-gradient(circle, transparent 55%, black 56%, black 62%, transparent 63%)', filter: 'drop-shadow(0 0 6px rgba(14, 165, 233, 0.5))' }} />
        <div className="absolute w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{ background: 'radial-gradient(circle, #BE5103 0%, #0EA5E9 60%, transparent 80%)', boxShadow: '0 0 8px #BE5103, 0 0 15px rgba(14, 165, 233, 0.4)', animation: 'orbPulse 1.5s ease-in-out infinite' }} />
      </div>
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <span className="text-[10px] sm:text-xs font-medium tracking-wider" style={{ color: '#22D3EE', textShadow: '0 0 8px rgba(34, 211, 238, 0.4)' }}>Coach BFC is thinking</span>
      </div>
      <style jsx>{`@keyframes orbPulse { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.4); opacity: 1; } }`}</style>
    </div>
  );
};

// =============================================================================
// AUTH LOADING SCREEN
// =============================================================================

const AuthLoadingScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full" style={{ background: 'radial-gradient(ellipse at center, rgba(17, 17, 132, 0.15) 0%, transparent 50%), linear-gradient(160deg, #0d0d0d 0%, #1a1209 25%, #1c1410 50%, #12101a 75%, #0d0d0d 100%)' }}>
      <FitnessLoadingAnimation state="loading" />
      <p className="mt-6 text-sm" style={{ color: '#A89080' }}>Authenticating...</p>
    </div>
  );
};

// =============================================================================
// LOGIN REQUIRED SCREEN
// =============================================================================

const LoginRequiredScreen = ({ loginUrl }: { loginUrl: string }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6" style={{ background: 'radial-gradient(ellipse at center, rgba(17, 17, 132, 0.15) 0%, transparent 50%), linear-gradient(160deg, #0d0d0d 0%, #1a1209 25%, #1c1410 50%, #12101a 75%, #0d0d0d 100%)' }}>
      <div className="w-24 h-24 sm:w-32 sm:h-32 mb-6">
        <FitnessLoadingAnimation state="idle" />
      </div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: '#F5E6D3' }}>Welcome to Best Fit Coach</h1>
      <p className="text-center mb-8 max-w-md" style={{ color: '#A89080' }}>
        Your AI-powered fitness coach is ready to help you reach your goals. Please log in to start your journey.
      </p>
      <a 
        href={loginUrl}
        className="px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          color: '#ffffff',
          boxShadow: '0 6px 25px rgba(22, 163, 74, 0.5)',
        }}
      >
        🔐 Log In to Continue
      </a>
      <p className="mt-6 text-xs" style={{ color: '#6b6b6b' }}>
        Don't have an account? <a href="https://bestfitcoach.com/register" className="underline hover:text-white">Sign up here</a>
      </p>
    </div>
  );
};

// =============================================================================
// AUTH ERROR SCREEN
// =============================================================================

const AuthErrorScreen = ({ error, loginUrl }: { error: string; loginUrl: string }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6" style={{ background: 'radial-gradient(ellipse at center, rgba(220, 38, 38, 0.1) 0%, transparent 50%), linear-gradient(160deg, #0d0d0d 0%, #1a1209 25%, #1c1410 50%, #12101a 75%, #0d0d0d 100%)' }}>
      <div className="text-6xl mb-6">⚠️</div>
      <h1 className="text-xl font-bold mb-2" style={{ color: '#F5E6D3' }}>Authentication Error</h1>
      <p className="text-center mb-8 max-w-md" style={{ color: '#ef4444' }}>
        {error}
      </p>
      <a 
        href={loginUrl}
        className="px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #BE5103 0%, #8B3A02 100%)',
          color: '#ffffff',
          boxShadow: '0 6px 25px rgba(190, 81, 3, 0.5)',
        }}
      >
        🔄 Try Logging In Again
      </a>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function ChatComponent({ className = '' }: ChatProps) {
  // =========================================================================
  // AUTH HOOK - MUST BE FIRST
  // =========================================================================
  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    error: authError,
    userId: authUserId, 
    userName: authUserName,
    loginUrl 
  } = useAuth();

  // Existing state
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

  // Better Self state
  const [betterSelfData, setBetterSelfData] = useState<BetterSelfData | null>(null);
  const [betterSelfGap, setBetterSelfGap] = useState<GapData | null>(null);
  const [betterSelfLoading, setBetterSelfLoading] = useState(true);
  const [betterSelfHasChallenge, setBetterSelfHasChallenge] = useState(false);
  const [betterSelfPanelOpen, setBetterSelfPanelOpen] = useState(false);
  const [celebrations, setCelebrations] = useState<string[]>([]);
  const [currentCelebrationIndex, setCurrentCelebrationIndex] = useState(0);

  const voiceModeRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

  // =========================================================================
  // AUTH STATE SCREENS
  // =========================================================================
  
  // Show loading while auth is checking
  if (authLoading) {
    return <AuthLoadingScreen />;
  }

  // Show error if auth failed
  if (authError) {
    return <AuthErrorScreen error={authError} loginUrl={loginUrl} />;
  }

  // Require authentication - uncomment to enforce login
  // if (!isAuthenticated) {
  //   return <LoginRequiredScreen loginUrl={loginUrl} />;
  // }

  // =========================================================================
  // REST OF COMPONENT (only renders when auth is complete)
  // =========================================================================

  // Fetch Better Self data
  const fetchBetterSelf = async () => {
    try {
      setBetterSelfLoading(true);
      const response = await wordpressClient.getBetterSelf();
      setBetterSelfHasChallenge(response.success && response.has_challenge);
      if (response.success && response.has_challenge) {
        setBetterSelfData(response.better_self || null);
        setBetterSelfGap(response.gap || null);
      } else {
        setBetterSelfData(null);
        setBetterSelfGap(null);
      }
    } catch (err) {
      console.log('Could not fetch Better Self data');
      setBetterSelfHasChallenge(false);
    } finally {
      setBetterSelfLoading(false);
    }
  };

  // Check for celebrations
  const checkCelebrations = async () => {
    try {
      const response = await wordpressClient.checkCelebrations();
      if (response.success && response.has_celebrations) {
        setCelebrations(response.celebrations);
      }
    } catch (err) {
      console.log('Could not check celebrations');
    }
  };

  // Refresh gap after workout
  const refreshBetterSelfGap = async () => {
    try {
      const response = await wordpressClient.getBetterSelfGap();
      if (response.success) {
        setBetterSelfGap(response.gap || null);
      }
      await checkCelebrations();
    } catch (err) {
      console.log('Could not refresh gap');
    }
  };

  // Recalibrate Better Self
  const handleRecalibrate = async () => {
    if (!confirm('Fresh start with the same goals?')) return;
    try {
      await wordpressClient.recalibrateBetterSelf();
      await fetchBetterSelf();
      setBetterSelfPanelOpen(false);
    } catch (err) {
      console.error('Recalibrate failed:', err);
    }
  };

  // Start Challenge - sends message to coach
  const handleStartChallenge = () => {
    setBetterSelfPanelOpen(false);
    setShowWelcome(false);
    const starterMessage = "I want to start a Better Self challenge! Help me set up my goals and create my future self to compete against.";
    setInputText('');
    
    const userMessage: Message = { 
      id: `user-${Date.now()}`, 
      role: 'user', 
      content: starterMessage, 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMessage]);
    
    setTimeout(() => {
      sendTextMessageDirect(starterMessage);
    }, 100);
  };

  // Play audio helper
  const playAudio = async (base64Audio: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsSpeaking(true);
      try {
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = document.createElement('audio');
        audio.setAttribute('playsinline', 'true');
        audio.src = url;
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); setIsSpeaking(false); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); setIsSpeaking(false); resolve(); };
        audio.play().catch(() => { setIsSpeaking(false); resolve(); });
      } catch (error) { setIsSpeaking(false); resolve(); }
    });
  };

  // Direct send without input (for programmatic sends)
  const sendTextMessageDirect = async (text: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await wordpressClient.sendTextMessage(text);
      if (!response.success) throw new Error(response.error || 'Failed to get response');

      setMessages(prev => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: response.ai_response || '', timestamp: new Date() }]);
      if (usage) setUsage(prev => prev ? { ...prev, remaining: Math.max(0, prev.remaining - 1) } : null);

      if (response.workouts_logged && response.workouts_logged > 0) {
        await refreshBetterSelfGap();
      }

      await fetchBetterSelf();

      if (autoSpeak && response.ai_response) {
        try {
          const audioBlob = await wordpressClient.generateSpeech(response.ai_response, 'onyx');
          const reader = new FileReader();
          reader.onloadend = () => { const base64 = (reader.result as string).split(',')[1]; playAudio(base64); };
          reader.readAsDataURL(audioBlob);
        } catch (speechErr) {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle celebration close
  const handleCelebrationClose = () => {
    if (currentCelebrationIndex < celebrations.length - 1) {
      setCurrentCelebrationIndex(prev => prev + 1);
    } else {
      setCelebrations([]);
      setCurrentCelebrationIndex(0);
    }
  };

  // Animation state
  const getAnimationState = (): 'listening' | 'speaking' | 'loading' | 'idle' => {
    if (isListening || recorderState.isRecording) return 'listening';
    if (isSpeaking) return 'speaking';
    if (isLoading) return 'loading';
    return 'idle';
  };

  // iOS audio unlock
  const unlockAudioForIOS = () => {
    if (audioUnlockedRef.current) return;
    try {
      const silentAudio = document.createElement('audio');
      silentAudio.setAttribute('playsinline', 'true');
      silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      silentAudio.volume = 0.01;
      silentAudio.play().then(() => { silentAudio.pause(); audioUnlockedRef.current = true; }).catch(() => {});
    } catch (e) {}
  };

  // Initialize - runs after auth is confirmed
  useEffect(() => {
    const initSession = async () => {
      try {
        const updatedStreak = updateStreak();
        setStreak(updatedStreak);
        const session = await wordpressClient.createSession();
        setSessionReady(true);
        
        // Fetch usage
        try {
          const usageResponse = await fetch(`${API_BASE_URL}/wp-json/voice-chat/v1/usage`, { credentials: 'include' });
          if (usageResponse.ok) {
            const usageData = await usageResponse.json();
            if (usageData.success) setUsage(usageData.usage);
          }
        } catch (e) {}

        // Fetch Better Self
        await fetchBetterSelf();
        
        if (session.has_memories) {
          const welcomeName = authUserName || 'back';
          setMessages([{ id: 'welcome', role: 'assistant', content: `Good to have you ${welcomeName}! I remember our previous conversations. How can I help you today?`, timestamp: new Date() }]);
          setShowWelcome(false);
        }
      } catch (err) {
        setSessionReady(true);
      }
    };
    
    // Only init if auth is done
    if (!authLoading) {
      initSession();
    }
  }, [authLoading, authUserName]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  const copyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {}
  };

  const stopAllAudio = () => {
    document.querySelectorAll('audio').forEach(audio => { audio.pause(); audio.currentTime = 0; });
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setIsSpeaking(false);
  };

  const clearChat = () => {
    setMessages([]);
    setShowWelcome(true);
    setError(null);
  };

  const startListening = async () => {
    if (!voiceModeRef.current) return;
    setIsListening(true);
    try { await startRecording(); } catch (err) { setError('Microphone access denied'); setVoiceMode(false); setIsListening(false); }
  };

  const processVoiceAndContinue = async () => {
    if (!recorderState.isRecording) return;
    setIsListening(false);
    setIsLoading(true);
    setError(null);
    setShowWelcome(false);

    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) throw new Error('No audio recorded');

      const tempId = `user-${Date.now()}`;
      setMessages(prev => [...prev, { id: tempId, role: 'user', content: '🎤 Processing...', timestamp: new Date() }]);

      const response = await wordpressClient.sendVoiceMessage(audioBlob, 'onyx');
      if (!response.success) throw new Error(response.error || 'Failed to process voice');

      setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, content: response.user_message || '(Voice message)' } : msg));
      setMessages(prev => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: response.ai_response || '', timestamp: new Date() }]);

      if (usage) setUsage(prev => prev ? { ...prev, remaining: Math.max(0, prev.remaining - 1) } : null);
      setIsLoading(false);

      if (response.workouts_logged && response.workouts_logged > 0) {
        await refreshBetterSelfGap();
      }

      await fetchBetterSelf();

      if (response.audio && autoSpeak && voiceModeRef.current) await playAudio(response.audio);
      if (voiceModeRef.current) setTimeout(() => startListening(), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice processing failed');
      setMessages(prev => prev.filter(msg => !msg.content.includes('Processing')));
      setIsLoading(false);
      if (voiceModeRef.current) setTimeout(() => startListening(), 1000);
    }
  };

  const toggleVoiceMode = async () => {
    unlockAudioForIOS();
    if (voiceMode) {
      setVoiceMode(false);
      voiceModeRef.current = false;
      setIsListening(false);
      if (recorderState.isRecording) cancelRecording();
      stopAllAudio();
    } else {
      setVoiceMode(true);
      voiceModeRef.current = true;
      setShowWelcome(false);
      await startListening();
    }
  };

  const handleVoiceTap = async () => {
    if (recorderState.isRecording) await processVoiceAndContinue();
  };

  const sendTextMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    unlockAudioForIOS();
    setShowWelcome(false);

    const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await wordpressClient.sendTextMessage(text);
      if (!response.success) throw new Error(response.error || 'Failed to get response');

      setMessages(prev => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: response.ai_response || '', timestamp: new Date() }]);
      if (usage) setUsage(prev => prev ? { ...prev, remaining: Math.max(0, prev.remaining - 1) } : null);

      if (response.workouts_logged && response.workouts_logged > 0) {
        await refreshBetterSelfGap();
      }

      await fetchBetterSelf();

      if (autoSpeak && response.ai_response) {
        try {
          const audioBlob = await wordpressClient.generateSpeech(response.ai_response, 'onyx');
          const reader = new FileReader();
          reader.onloadend = () => { const base64 = (reader.result as string).split(',')[1]; playAudio(base64); };
          reader.readAsDataURL(audioBlob);
        } catch (speechErr) {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendTextMessage(inputText); };
  const handleStarterSelect = (text: string) => { sendTextMessage(text); };

  const getVoiceBannerStyle = () => {
    if (isListening) return { background: 'linear-gradient(90deg, #dc2626 0%, #BE5103 100%)' };
    if (isSpeaking) return { background: 'linear-gradient(90deg, #111184 0%, #550000 100%)' };
    if (isLoading) return { background: 'linear-gradient(90deg, #BE5103 0%, #550000 100%)' };
    return { background: 'linear-gradient(90deg, #16a34a 0%, #15803d 100%)' };
  };

  const animationState = getAnimationState();

  return (
    <div className={`flex flex-col h-full relative overflow-hidden ${className}`}>
      {/* Background */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top left, rgba(17, 17, 132, 0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(190, 81, 3, 0.1) 0%, transparent 50%), linear-gradient(160deg, #0d0d0d 0%, #1a1209 25%, #1c1410 50%, #12101a 75%, #0d0d0d 100%)' }} />
      <HeartbeatLine isActive={voiceMode && (isListening || isSpeaking || isLoading)} />

      {/* Header */}
      <div className="relative flex items-center justify-between p-2 sm:p-4 backdrop-blur-md" style={{ background: 'linear-gradient(90deg, rgba(85, 0, 0, 0.9) 0%, rgba(60, 20, 10, 0.85) 50%, rgba(17, 17, 132, 0.4) 100%)', borderBottom: '1px solid rgba(190, 81, 3, 0.3)' }}>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg overflow-hidden p-1" style={{ background: 'linear-gradient(135deg, #550000 0%, #BE5103 100%)', boxShadow: '0 4px 15px rgba(190, 81, 3, 0.4)' }}>
            <img src="/images/icon-192.png" alt="BFC" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-sm sm:text-lg font-bold" style={{ color: '#F5E6D3' }}>Best Fit Coach</h2>
            <p className="text-[10px] sm:text-xs" style={{ color: '#BE5103' }}>Be Better Than Yourself</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Combined Progress Badge (Streak + Better Self) */}
          <CombinedProgressBadge 
            streak={streak}
            gap={betterSelfGap} 
            loading={betterSelfLoading}
            hasChallenge={betterSelfHasChallenge}
            onClick={() => setBetterSelfPanelOpen(true)}
          />
          
          {/* Clear Chat */}
          {messages.length > 0 && (
            <button onClick={clearChat} className="p-1.5 sm:p-2 rounded-full transition-all hover:scale-110" style={{ background: 'rgba(85, 0, 0, 0.6)', color: '#E8C4A0' }} title="Clear chat">
              <Trash2 size={16} />
            </button>
          )}
          
          {/* Sound Toggle */}
          <button onClick={() => setAutoSpeak(!autoSpeak)} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs rounded-full transition-all font-medium" style={{ background: autoSpeak ? 'linear-gradient(135deg, #166534 0%, #15803d 100%)' : 'rgba(85, 0, 0, 0.6)', color: autoSpeak ? '#ffffff' : '#E8C4A0', boxShadow: autoSpeak ? '0 4px 15px rgba(22, 101, 52, 0.4)' : 'none' }}>
            {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
        </div>
      </div>

      {/* Better Self Panel */}
      <BetterSelfPanel 
        gap={betterSelfGap} 
        data={betterSelfData}
        hasChallenge={betterSelfHasChallenge}
        isOpen={betterSelfPanelOpen} 
        onClose={() => setBetterSelfPanelOpen(false)}
        onRecalibrate={handleRecalibrate}
        onStartChallenge={handleStartChallenge}
      />

      {/* Celebration Modal */}
      {celebrations.length > 0 && (
        <CelebrationModal 
          celebration={celebrations[currentCelebrationIndex]} 
          onClose={handleCelebrationClose}
        />
      )}

      <UsageLimitAlert usage={usage} />

      {error && (
        <div className="relative p-2 sm:p-3 text-xs sm:text-sm text-center backdrop-blur-sm" style={{ background: 'rgba(220, 38, 38, 0.9)', color: '#ffffff' }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:opacity-80">Dismiss</button>
        </div>
      )}

      {voiceMode && (
        <div className="relative p-4 sm:p-6 text-center text-white backdrop-blur-sm flex flex-col items-center justify-center gap-3 sm:gap-4" style={getVoiceBannerStyle()}>
          <FitnessLoadingAnimation state={animationState} />
          {isSpeaking && <SoundWaveAnimation isActive={true} />}
          <span className="font-medium text-sm sm:text-lg">
            {isListening && '🎤 Listening... Tap when done speaking'}
            {isSpeaking && '🔊 Coach is speaking...'}
            {isLoading && '⏳ Processing your message...'}
            {!isListening && !isSpeaking && !isLoading && '✅ Ready - Tap to speak'}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4">
        {showWelcome && messages.length === 0 && !voiceMode && (
          <div className="text-center py-4 sm:py-6">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-3 sm:mb-4">
              <FitnessLoadingAnimation state="idle" />
            </div>
            <p className="text-lg sm:text-xl mb-1 font-semibold" style={{ color: '#F5E6D3' }}>
              {authUserName ? `Hey ${authUserName}! I'm Coach BFC` : "Hey there! I'm Coach BFC"}
            </p>
            <p className="text-sm sm:text-base mb-4 sm:mb-6" style={{ color: '#A89080' }}>Your personal AI fitness coach. What's your goal today?</p>
            <DailyTip />
            <ConversationStarters onSelect={handleStarterSelect} />
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[90%] sm:max-w-[85%] rounded-xl sm:rounded-2xl px-3 py-2 sm:px-4 sm:py-3 relative group" style={{ background: message.role === 'user' ? 'linear-gradient(135deg, #111184 0%, #1a1a9e 50%, #0d0d6b 100%)' : 'linear-gradient(135deg, #F5F0EB 0%, #EDE5DC 100%)', color: message.role === 'user' ? '#E8E8FF' : '#2D2420', boxShadow: message.role === 'user' ? '0 4px 20px rgba(17, 17, 132, 0.4)' : '0 4px 20px rgba(0, 0, 0, 0.15)' }}>
              <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{message.content}</p>
              <button onClick={() => copyMessage(message.id, message.content)} className="absolute top-1 right-1 sm:top-2 sm:right-2 p-1 sm:p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: message.role === 'user' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} title="Copy message">
                {copiedId === message.id ? <Check size={12} className={message.role === 'user' ? 'text-green-300' : 'text-green-600'} /> : <Copy size={12} className={message.role === 'user' ? 'text-white/70' : 'text-gray-500'} />}
              </button>
            </div>
          </div>
        ))}
        
        {isLoading && !voiceMode && (
          <div className="flex justify-start">
            <div className="max-w-[90%] sm:max-w-[85%] rounded-xl sm:rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #F5F0EB 0%, #EDE5DC 100%)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)' }}>
              <TypingIndicator />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative p-2 sm:p-4 backdrop-blur-md" style={{ background: 'linear-gradient(90deg, rgba(85, 0, 0, 0.95) 0%, rgba(40, 20, 10, 0.9) 50%, rgba(17, 17, 132, 0.3) 100%)', borderTop: '1px solid rgba(190, 81, 3, 0.3)' }}>
        <div className="flex justify-center mb-3 sm:mb-4">
          <button onClick={voiceMode ? (recorderState.isRecording ? handleVoiceTap : toggleVoiceMode) : toggleVoiceMode} disabled={isLoading && !voiceMode} className="flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-full text-sm sm:text-lg font-semibold transition-all transform active:scale-95 touch-manipulation" style={{ background: voiceMode ? recorderState.isRecording ? 'linear-gradient(135deg, #dc2626 0%, #BE5103 100%)' : 'linear-gradient(135deg, #550000 0%, #7f1d1d 100%)' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#ffffff', boxShadow: voiceMode ? recorderState.isRecording ? '0 6px 25px rgba(220, 38, 38, 0.5)' : '0 6px 25px rgba(85, 0, 0, 0.5)' : '0 6px 25px rgba(22, 163, 74, 0.5)', WebkitTapHighlightColor: 'transparent' }}>
            {voiceMode ? (recorderState.isRecording ? (<><MicOff size={20} /><span>Tap to Send</span></>) : (<><PhoneOff size={20} /><span>End Conversation</span></>)) : (<><Phone size={20} /><span>Start Voice Chat</span></>)}
          </button>
        </div>

        {!voiceMode && (
          <form onSubmit={handleSubmit} className="flex items-center gap-2 sm:gap-3">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type a message..." disabled={isLoading} className="flex-1 px-3 sm:px-5 py-2 sm:py-3 rounded-full transition-all focus:outline-none focus:ring-2 text-sm sm:text-base" style={{ background: 'rgba(30, 20, 15, 0.8)', color: '#F5E6D3', border: '1px solid rgba(190, 81, 3, 0.4)' }} />
            <button type="submit" disabled={!inputText.trim() || isLoading} className="p-2 sm:p-3 rounded-full transition-all disabled:opacity-50 touch-manipulation" style={{ background: 'linear-gradient(135deg, #BE5103 0%, #8B3A02 100%)', color: '#ffffff', boxShadow: '0 4px 15px rgba(190, 81, 3, 0.4)', WebkitTapHighlightColor: 'transparent' }}>
              <Send size={18} />
            </button>
          </form>
        )}

        <p className="text-center text-[10px] sm:text-xs mt-2 sm:mt-3 px-2 sm:px-4" style={{ color: 'rgba(190, 81, 3, 0.6)' }}>
          🤖 BFC AI is very smart, not perfect — Please confirm important info.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export function Chat(props: ChatProps) {
  return <ChatComponent {...props} />;
}

export function VoiceChat(props: ChatProps) {
  return <ChatComponent {...props} />;
}

export default Chat;
