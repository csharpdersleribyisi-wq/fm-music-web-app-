import React from 'react';
import { AudioLines, Radio, SlidersHorizontal, Users } from 'lucide-react';
import { HERO_STUDIO_IMAGE } from '../data/catalog';

interface AuthScreenProps {
  onSignIn: () => void;
  isSigningIn: boolean;
  authError: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSignIn, isSigningIn, authError }) => {
  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F4F4F6] flex flex-col">
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 py-5 border-b border-white/8">
        <span className="font-display text-xl font-bold tracking-tight text-[#F4F4F6] whitespace-nowrap shrink-0">
          Sonora
        </span>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#8E95A5]">
          <span className="whitespace-nowrap shrink-0">Web Audio Studio</span>
          <span className="whitespace-nowrap shrink-0">Collaborative Sync</span>
          <span className="whitespace-nowrap shrink-0">Cross-Device Handoff</span>
        </nav>
        <button
          onClick={onSignIn}
          disabled={isSigningIn}
          className="px-4 py-2 text-sm font-semibold bg-[#E5A93C] text-[#0B0D12] rounded-lg hover:bg-[#ebb758] transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 lg:px-12 py-12 lg:py-16 grid lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between gap-8">
          <div className="space-y-5">
            <p className="text-xs font-medium text-[#E5A93C] tracking-wide">
              Synchronized Web Audio Workspace
            </p>
            <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-balance">
              Listen, compose, and sync across every session.
            </h1>
            <p className="text-base text-[#8E95A5] leading-relaxed max-w-xl">
              Sonora pairs a polyphonic Web Audio synthesizer and 3-band mastering rack with real-time Firestore session locks, keeping your Android and Web listening rooms aligned to the millisecond.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={onSignIn}
              disabled={isSigningIn}
              className="inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-[#E5A93C] text-[#0B0D12] text-sm font-semibold rounded-lg hover:bg-[#ebb758] transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <AudioLines className="w-4 h-4" />
              {isSigningIn ? 'Connecting to Sonora...' : 'Continue with Google'}
            </button>

            {authError && (
              <p className="text-sm text-[#F87171]">{authError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-white/8">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F4F4F6]">
                <Radio className="w-4 h-4 text-[#E5A93C]" />
                <span>Anchor Sync</span>
              </div>
              <p className="text-xs text-[#8E95A5] leading-relaxed">
                Server-timestamped transport anchors prevent cross-device drift.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F4F4F6]">
                <Users className="w-4 h-4 text-[#E5A93C]" />
                <span>Shared Rooms</span>
              </div>
              <p className="text-xs text-[#8E95A5] leading-relaxed">
                Invite collaborators from the user directory to curate queues live.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#F4F4F6]">
                <SlidersHorizontal className="w-4 h-4 text-[#E5A93C]" />
                <span>Web Audio EQ</span>
              </div>
              <p className="text-xs text-[#8E95A5] leading-relaxed">
                Real-time 3-band EQ, stereo reverb, and live FFT spectrum analysis.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative h-full min-h-[340px] rounded-xl overflow-hidden border border-white/10 bg-[#131720]">
            <img
              src={HERO_STUDIO_IMAGE}
              alt="Sonora acoustic listening studio"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12]/90 via-[#0B0D12]/25 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[#F4F4F6]">Sonora Studio Console</p>
                <p className="text-xs text-[#8E95A5] mt-1">
                  Web Audio API · 48kHz Polyphonic Engine · Real-Time Cloud Sync
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
