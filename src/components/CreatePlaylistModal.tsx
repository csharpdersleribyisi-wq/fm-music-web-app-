import React, { useState } from 'react';
import { X } from 'lucide-react';
import { COVER_ASSETS, STUDIO_TRACK_LIBRARY } from '../data/catalog';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCollab: (data: {
    title: string;
    description: string;
    coverUrl: string;
    includeStarterTrack: boolean;
  }) => Promise<void>;
  onCreatePublic: (data: {
    title: string;
    description: string;
    genre: string;
    coverUrl: string;
  }) => Promise<void>;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreateCollab,
  onCreatePublic,
}) => {
  const [kind, setKind] = useState<'collaborative' | 'public'>('collaborative');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('Ambient Synth');
  const [coverUrl, setCoverUrl] = useState<string>(COVER_ASSETS[0].url);
  const [includeStarterTrack, setIncludeStarterTrack] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (kind === 'collaborative') {
        await onCreateCollab({
          title: title.trim(),
          description: description.trim(),
          coverUrl,
          includeStarterTrack,
        });
      } else {
        await onCreatePublic({
          title: title.trim(),
          description: description.trim(),
          genre: genre.trim() || 'Ambient',
          coverUrl,
        });
      }
      setTitle('');
      setDescription('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="w-full max-w-lg bg-[#131720] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[#F4F4F6]">
            Create New Session
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-[#8E95A5] hover:text-[#F4F4F6] rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#0B0D12] rounded-lg border border-white/8">
            <button
              type="button"
              onClick={() => setKind('collaborative')}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                kind === 'collaborative'
                  ? 'bg-[#1D2330] text-[#F4F4F6]'
                  : 'text-[#8E95A5] hover:text-[#F4F4F6]'
              }`}
            >
              Collaborative Room
            </button>
            <button
              type="button"
              onClick={() => setKind('public')}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                kind === 'public'
                  ? 'bg-[#1D2330] text-[#F4F4F6]'
                  : 'text-[#8E95A5] hover:text-[#F4F4F6]'
              }`}
            >
              Public Playlist
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
              Session Title
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === 'collaborative' ? 'Late Night Synth Jam' : 'Morning Focus Study'}
              className="w-full px-3.5 py-2.5 bg-[#0B0D12] border border-white/10 rounded-lg text-sm text-[#F4F4F6] placeholder-[#8E95A5] focus:outline-none focus:border-[#E5A93C]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes on tempo, instrumentation, or mood..."
              className="w-full px-3.5 py-2 bg-[#0B0D12] border border-white/10 rounded-lg text-sm text-[#F4F4F6] placeholder-[#8E95A5] focus:outline-none focus:border-[#E5A93C] resize-none"
            />
          </div>

          {kind === 'public' && (
            <div>
              <label className="block text-xs font-medium text-[#8E95A5] mb-1.5">
                Genre
              </label>
              <input
                type="text"
                maxLength={50}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0B0D12] border border-white/10 rounded-lg text-sm text-[#F4F4F6] focus:outline-none focus:border-[#E5A93C]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#8E95A5] mb-2">
              Cover Artwork
            </label>
            <div className="grid grid-cols-4 gap-3">
              {COVER_ASSETS.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setCoverUrl(asset.url)}
                  className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                    coverUrl === asset.url
                      ? 'border-[#E5A93C] ring-2 ring-[#E5A93C]/30'
                      : 'border-white/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={asset.url}
                    alt={asset.label}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {kind === 'collaborative' && (
            <label className="flex items-center gap-2.5 text-sm text-[#F4F4F6] cursor-pointer">
              <input
                type="checkbox"
                checked={includeStarterTrack}
                onChange={(e) => setIncludeStarterTrack(e.target.checked)}
                className="rounded border-white/20 bg-[#0B0D12] text-[#E5A93C]"
              />
              <span>
                Queue starter track ({STUDIO_TRACK_LIBRARY[0].title})
              </span>
            </label>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/8">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#8E95A5] hover:text-[#F4F4F6] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="px-5 py-2 bg-[#E5A93C] text-[#0B0D12] text-sm font-semibold rounded-lg hover:bg-[#ebb758] transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {submitting ? 'Creating...' : kind === 'collaborative' ? 'Launch Room' : 'Publish Playlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
