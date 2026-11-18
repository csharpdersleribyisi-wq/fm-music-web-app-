import React from 'react';
import {
  Compass,
  Library,
  LogOut,
  Mail,
  Radio,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { UserProfile } from '../types/sonora';

export type NavTab = 'discover' | 'collaborative' | 'invites' | 'studio' | 'library';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingInviteCount: number;
  profile: UserProfile | null;
  onSignOut: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'collaborative', label: 'Collaborative', icon: Radio },
  { id: 'invites', label: 'Invites', icon: Mail },
  { id: 'studio', label: 'Studio Rack', icon: SlidersHorizontal },
  { id: 'library', label: 'My Library', icon: Library },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  pendingInviteCount,
  profile,
  onSignOut,
  mobileOpen,
  onCloseMobile,
}) => {
  const navContent = (
    <div className="flex flex-col h-full bg-[#0E1118] border-r border-white/8 w-[260px] shrink-0">
      <div className="px-6 py-5 border-b border-white/8 flex items-center justify-between">
        <button
          onClick={() => {
            onSelectTab('discover');
            onCloseMobile();
          }}
          className="font-display text-xl font-bold tracking-tight text-[#F4F4F6] whitespace-nowrap shrink-0"
        >
          Sonora
        </button>
        <button
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-2 text-[#8E95A5] hover:text-[#F4F4F6] rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-[#171C28] text-[#F4F4F6]'
                  : 'text-[#8E95A5] hover:text-[#F4F4F6] hover:bg-white/[0.03]'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#E5A93C]' : ''}`} />
                <span>{item.label}</span>
              </span>
              {item.id === 'invites' && pendingInviteCount > 0 && (
                <span className="font-mono-tabular text-xs font-semibold text-[#E5A93C]">
                  {pendingInviteCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#1C2230] border border-white/10 flex items-center justify-center text-xs font-semibold text-[#E5A93C] shrink-0">
                {(profile?.displayName || 'S').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#F4F4F6] truncate">
                {profile?.displayName || 'Listener'}
              </p>
              <p className="text-xs text-[#8E95A5] truncate">
                @{profile?.handle || 'sonora'}
              </p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 text-[#8E95A5] hover:text-[#F4F4F6] hover:bg-white/[0.04] rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-full shrink-0">{navContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
};
