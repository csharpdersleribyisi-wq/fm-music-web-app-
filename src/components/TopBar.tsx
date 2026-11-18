import React from 'react';
import { Menu, Plus, Search } from 'lucide-react';
import { NavTab } from './Sidebar';

interface TopBarProps {
  activeTab: NavTab;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenCreateModal: () => void;
  onOpenMobileNav: () => void;
}

const TAB_TITLES: Record<NavTab, string> = {
  discover: 'Discover Public Sessions',
  collaborative: 'Collaborative Rooms',
  invites: 'Session Invitations',
  studio: 'Web Audio Studio Rack',
  library: 'My Library & Handoff',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  searchQuery,
  onSearchChange,
  onOpenCreateModal,
  onOpenMobileNav,
}) => {
  return (
    <header className="h-16 px-4 lg:px-8 border-b border-white/8 bg-[#0B0D12]/95 flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="lg:hidden p-2 -ml-2 text-[#8E95A5] hover:text-[#F4F4F6] rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-display text-base lg:text-lg font-semibold text-[#F4F4F6] truncate whitespace-nowrap">
          {TAB_TITLES[activeTab]}
        </h1>
      </div>

      <div className="hidden sm:flex items-center flex-1 max-w-md relative">
        <Search className="w-4 h-4 text-[#8E95A5] absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search playlists, tracks, or collaborators"
          aria-label="Search playlists, tracks, or collaborators"
          className="w-full pl-9 pr-4 py-2 bg-[#131720] border border-white/10 rounded-lg text-sm text-[#F4F4F6] placeholder-[#8E95A5] focus:outline-none focus:border-[#E5A93C]"
        />
      </div>

      <button
        onClick={onOpenCreateModal}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#E5A93C] text-[#0B0D12] text-sm font-semibold rounded-lg hover:bg-[#ebb758] transition-colors whitespace-nowrap shrink-0"
      >
        <Plus className="w-4 h-4" />
        <span>New Session</span>
      </button>
    </header>
  );
};
