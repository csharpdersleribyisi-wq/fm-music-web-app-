import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { EngineSnapshot, EqSettings, SonoraAudioEngine } from './audio/AudioEngine';
import { AuthScreen } from './components/AuthScreen';
import { CollaborativeView } from './components/CollaborativeView';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { DiscoverView } from './components/DiscoverView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InvitesView } from './components/InvitesView';
import { LibraryView } from './components/LibraryView';
import { NavTab, Sidebar } from './components/Sidebar';
import { StudioRackView } from './components/StudioRackView';
import { TopBar } from './components/TopBar';
import { TransportBar } from './components/TransportBar';
import { COVER_ASSETS, STUDIO_TRACK_LIBRARY } from './data/catalog';
import { auth, googleProvider, testConnection } from './firebase/config';
import {
  addTrackToPlaylist,
  createCollaborativePlaylist,
  createPublicPlaylist,
  deleteCollaborativePlaylist,
  fetchPlaylistTracks,
  leaveCollaborativePlaylist,
  removeTrackFromPlaylist,
  respondToCollabInvite,
  seedStarterPublicPlaylists,
  sendCollabInvite,
  subscribeCollaborativePlaylists,
  subscribeCollabInvites,
  subscribePlaylistTracks,
  subscribePublicPlaylists,
  subscribeUserDirectory,
  subscribeUserProfile,
  syncPlaylistPlaybackState,
  syncUserPlaybackState,
  updateUserHandle,
  upsertUserAndDirectory,
} from './services/sonoraFirestore';
import {
  CollabInvite,
  CollaborativePlaylist,
  DirectoryEntry,
  EqPresetId,
  generateSafeId,
  PlaybackState,
  PlaylistTrack,
  PublicPlaylist,
  UserProfile,
} from './types/sonora';

const TAB_SESSION_ID = `web_${Math.random().toString(36).slice(2, 10)}`;

function SonoraWorkspace() {
  const engineRef = useRef<SonoraAudioEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SonoraAudioEngine();
  }
  const engine = engineRef.current;

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('discover');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Firestore synced collections
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [publicPlaylists, setPublicPlaylists] = useState<PublicPlaylist[]>([]);
  const [collabPlaylists, setCollabPlaylists] = useState<CollaborativePlaylist[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<CollabInvite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<CollabInvite[]>([]);

  // Selected playlists & subcollection tracks
  const [selectedPublicId, setSelectedPublicId] = useState<string | null>(null);
  const [selectedPublicTracks, setSelectedPublicTracks] = useState<PlaylistTrack[]>([]);
  const [loadingPublicTracks, setLoadingPublicTracks] = useState(false);

  const [selectedCollabId, setSelectedCollabId] = useState<string | null>(null);
  const [selectedCollabTracks, setSelectedCollabTracks] = useState<PlaylistTrack[]>([]);
  const [loadingCollabTracks, setLoadingCollabTracks] = useState(false);

  // Audio playback & cross-session sync state
  const [queue, setQueue] = useState<PlaylistTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeSyncedRoomId, setActiveSyncedRoomId] = useState<string | null>(null);
  const [syncedRoomTracks, setSyncedRoomTracks] = useState<PlaylistTrack[]>([]);
  const [eqPreset, setEqPreset] = useState<EqPresetId>('studio');
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(0.78);
  const [engineSnap, setEngineSnap] = useState<EngineSnapshot>(() => engine.getSnapshot());

  const serverClockOffsetRef = useRef<number>(0);
  const lastSequenceRef = useRef<number>(0);
  const activeSyncedRoomIdRef = useRef<string | null>(null);
  const syncedRoomTracksRef = useRef<PlaylistTrack[]>([]);
  const queueRef = useRef<PlaylistTrack[]>([]);
  const currentIndexRef = useRef<number>(0);
  const userRef = useRef<User | null>(null);

  activeSyncedRoomIdRef.current = activeSyncedRoomId;
  syncedRoomTracksRef.current = syncedRoomTracks;
  queueRef.current = queue;
  currentIndexRef.current = currentIndex;
  userRef.current = user;

  const selectedPublicPlaylist = useMemo(
    () => publicPlaylists.find((p) => p.id === selectedPublicId) ?? publicPlaylists[0] ?? null,
    [publicPlaylists, selectedPublicId]
  );

  const selectedCollabPlaylist = useMemo(
    () => collabPlaylists.find((p) => p.id === selectedCollabId) ?? collabPlaylists[0] ?? null,
    [collabPlaylists, selectedCollabId]
  );

  const activeSyncedRoom = useMemo(
    () => collabPlaylists.find((p) => p.id === activeSyncedRoomId) ?? null,
    [collabPlaylists, activeSyncedRoomId]
  );

  const currentTrack = queue[currentIndex] ?? null;

  // Startup connection check & AudioEngine cleanup
  useEffect(() => {
    testConnection();
    return () => {
      engine.dispose();
    };
  }, [engine]);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        try {
          await upsertUserAndDirectory(nextUser);
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      } else {
        engine.pause(0);
        setActiveSyncedRoomId(null);
        setQueue([]);
      }
    });
    return () => unsub();
  }, [engine]);

  // Core Firestore listeners (only active when signed in)
  useEffect(() => {
    if (!authReady || !user) return;

    const unsubUser = subscribeUserProfile(user.uid, (prof, offsetMs) => {
      setProfile(prof);
      if (offsetMs !== 0) {
        serverClockOffsetRef.current = offsetMs;
      }
      if (prof?.eqPreset) {
        setEqPreset(prof.eqPreset);
        engine.applyEqPreset(prof.eqPreset);
      }
    });

    const unsubDir = subscribeUserDirectory(setDirectory);
    const unsubPublic = subscribePublicPlaylists(setPublicPlaylists);
    const unsubCollab = subscribeCollaborativePlaylists(user.uid, setCollabPlaylists);
    const unsubInvites = subscribeCollabInvites(user.uid, (inc, out) => {
      setIncomingInvites(inc);
      setOutgoingInvites(out);
    });

    return () => {
      unsubUser();
      unsubDir();
      unsubPublic();
      unsubCollab();
      unsubInvites();
    };
  }, [authReady, user, engine]);

  // Selected public playlist tracks listener
  useEffect(() => {
    if (!user || !selectedPublicPlaylist) {
      setSelectedPublicTracks([]);
      return;
    }
    setLoadingPublicTracks(true);
    const unsub = subscribePlaylistTracks('publicPlaylists', selectedPublicPlaylist.id, (tracks) => {
      const resolved = tracks.length > 0 ? tracks : selectedPublicPlaylist.embeddedTracks || [];
      setSelectedPublicTracks(resolved);
      setLoadingPublicTracks(false);
    });
    return () => unsub();
  }, [user, selectedPublicPlaylist]);

  // Selected collaborative playlist tracks listener
  useEffect(() => {
    if (!user || !selectedCollabPlaylist) {
      setSelectedCollabTracks([]);
      return;
    }
    setLoadingCollabTracks(true);
    const unsub = subscribePlaylistTracks('collaborativePlaylists', selectedCollabPlaylist.id, (tracks) => {
      const resolved = tracks.length > 0 ? tracks : selectedCollabPlaylist.embeddedTracks || [];
      setSelectedCollabTracks(resolved);
      setLoadingCollabTracks(false);
    });
    return () => unsub();
  }, [user, selectedCollabPlaylist]);

  // Active synced collaborative room tracks listener
  useEffect(() => {
    if (!user || !activeSyncedRoomId) {
      setSyncedRoomTracks([]);
      return;
    }
    const unsub = subscribePlaylistTracks('collaborativePlaylists', activeSyncedRoomId, (tracks) => {
      const room = collabPlaylists.find((c) => c.id === activeSyncedRoomId);
      const resolved = tracks.length > 0 ? tracks : room?.embeddedTracks || [];
      setSyncedRoomTracks(resolved);
      setQueue(resolved);
    });
    return () => unsub();
  }, [user, activeSyncedRoomId, collabPlaylists]);

  // Sync Web Audio Engine whenever remote collaborative playlist playbackState updates
  useEffect(() => {
    if (!activeSyncedRoom) return;
    const remote = activeSyncedRoom.playbackState;
    const tracks = syncedRoomTracksRef.current;
    if (!remote || tracks.length === 0) return;

    // Ignore echoes from this same browser tab if sequence <= local
    if (remote.sessionId === TAB_SESSION_ID && remote.sequence <= lastSequenceRef.current) {
      return;
    }
    if (remote.sequence < lastSequenceRef.current && remote.sessionId !== TAB_SESSION_ID) {
      // Allow higher or equal sequence from another device/session
    }

    lastSequenceRef.current = Math.max(lastSequenceRef.current, remote.sequence);

    const idxById = tracks.findIndex((t) => t.id === remote.trackId);
    const resolvedIdx =
      idxById >= 0
        ? idxById
        : Math.max(0, Math.min(tracks.length - 1, remote.trackIndex || 0));
    const track = tracks[resolvedIdx] ?? null;

    setCurrentIndex(resolvedIdx);
    setPlaybackRate(remote.playbackRate || 1.0);
    engine.syncToRemoteAnchor(remote, track, serverClockOffsetRef.current);
  }, [activeSyncedRoom, syncedRoomTracks, engine]);

  // Re-synchronize on tab visibility regain or network reconnect
  useEffect(() => {
    const handleResync = () => {
      if (document.visibilityState !== 'visible') return;
      if (!activeSyncedRoom) return;
      const tracks = syncedRoomTracksRef.current;
      const remote = activeSyncedRoom.playbackState;
      const idx = Math.max(
        0,
        tracks.findIndex((t) => t.id === remote.trackId)
      );
      const track = tracks[idx] ?? tracks[0] ?? null;
      if (track) {
        engine.syncToRemoteAnchor(remote, track, serverClockOffsetRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleResync);
    window.addEventListener('online', handleResync);
    return () => {
      document.removeEventListener('visibilitychange', handleResync);
      window.removeEventListener('online', handleResync);
    };
  }, [activeSyncedRoom, engine]);

  const publishTransportUpdate = useCallback(
    async (
      nextTrack: PlaylistTrack,
      nextIndex: number,
      playing: boolean,
      posSec: number,
      rate = playbackRate
    ) => {
      const currentUser = userRef.current;
      if (!currentUser) return;
      const nextSeq = lastSequenceRef.current + 1;
      lastSequenceRef.current = nextSeq;

      const statePayload: PlaybackState = {
        trackId: nextTrack.id,
        trackIndex: nextIndex,
        isPlaying: playing,
        anchorPositionSec: posSec,
        anchorTimestampMs: Date.now() + serverClockOffsetRef.current,
        playbackRate: rate,
        eqPreset,
        updatedBy: currentUser.uid,
        sessionId: TAB_SESSION_ID,
        sequence: nextSeq,
        playlistId: activeSyncedRoomIdRef.current || undefined,
        playlistType: activeSyncedRoomIdRef.current ? 'collaborative' : 'studio',
      };

      if (activeSyncedRoomIdRef.current) {
        await syncPlaylistPlaybackState(activeSyncedRoomIdRef.current, statePayload, currentUser.uid);
      }
      await syncUserPlaybackState(currentUser.uid, statePayload, eqPreset);
    },
    [eqPreset, playbackRate]
  );

  // AudioEngine state & auto-advance callbacks
  useEffect(() => {
    engine.setCallbacks(
      (snap) => setEngineSnap(snap),
      () => {
        const q = queueRef.current;
        if (q.length === 0) return;
        const nextIdx = (currentIndexRef.current + 1) % q.length;
        const nextTrk = q[nextIdx];
        if (!nextTrk) return;
        setCurrentIndex(nextIdx);
        engine.setTrack(nextTrk, 0);
        engine.play(0);
        publishTransportUpdate(nextTrk, nextIdx, true, 0);
      }
    );
  }, [engine, publishTransportUpdate]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google Sign-In failed.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    engine.pause(0);
    setActiveSyncedRoomId(null);
    await signOut(auth);
  };

  const handlePlayPublicPlaylist = async (playlist: PublicPlaylist, trackIndex = 0) => {
    setSelectedPublicId(playlist.id);
    setActiveSyncedRoomId(null);
    let tracks = selectedPublicPlaylist?.id === playlist.id ? selectedPublicTracks : [];
    if (tracks.length === 0) {
      tracks = await fetchPlaylistTracks('publicPlaylists', playlist.id);
      if (tracks.length === 0 && playlist.embeddedTracks) {
        tracks = playlist.embeddedTracks;
      }
    }
    if (tracks.length === 0) return;
    const safeIdx = Math.max(0, Math.min(tracks.length - 1, trackIndex));
    const trk = tracks[safeIdx];
    setQueue(tracks);
    setCurrentIndex(safeIdx);
    engine.setTrack(trk, 0);
    await engine.play(0);
    await publishTransportUpdate(trk, safeIdx, true, 0);
  };

  const handlePlayQuickTrack = async (
    rawTrack: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>
  ) => {
    setActiveSyncedRoomId(null);
    const fullTrack: PlaylistTrack = {
      ...rawTrack,
      addedBy: user?.uid || 'studio',
      order: 0,
      createdAtMs: Date.now(),
    };
    setQueue([fullTrack]);
    setCurrentIndex(0);
    engine.setTrack(fullTrack, 0);
    await engine.play(0);
    await publishTransportUpdate(fullTrack, 0, true, 0);
  };

  const handleJoinSyncRoom = async (playlist: CollaborativePlaylist, startIndex?: number) => {
    setSelectedCollabId(playlist.id);
    setActiveSyncedRoomId(playlist.id);
    let tracks =
      selectedCollabPlaylist?.id === playlist.id && selectedCollabTracks.length > 0
        ? selectedCollabTracks
        : await fetchPlaylistTracks('collaborativePlaylists', playlist.id);
    if (tracks.length === 0 && playlist.embeddedTracks) {
      tracks = playlist.embeddedTracks;
    }
    setSyncedRoomTracks(tracks);
    setQueue(tracks);
    if (tracks.length === 0) return;

    if (typeof startIndex === 'number') {
      const safeIdx = Math.max(0, Math.min(tracks.length - 1, startIndex));
      const trk = tracks[safeIdx];
      setCurrentIndex(safeIdx);
      engine.setTrack(trk, 0);
      await engine.play(0);
      const nextSeq = Math.max(lastSequenceRef.current, playlist.playbackState.sequence) + 1;
      lastSequenceRef.current = nextSeq;
      if (user) {
        await syncPlaylistPlaybackState(
          playlist.id,
          {
            trackId: trk.id,
            trackIndex: safeIdx,
            isPlaying: true,
            anchorPositionSec: 0,
            anchorTimestampMs: Date.now(),
            playbackRate,
            eqPreset,
            updatedBy: user.uid,
            sessionId: TAB_SESSION_ID,
            sequence: nextSeq,
            playlistId: playlist.id,
            playlistType: 'collaborative',
          },
          user.uid
        );
      }
      return;
    }

    // Join existing live room anchor
    const remote = playlist.playbackState;
    lastSequenceRef.current = Math.max(lastSequenceRef.current, remote.sequence);
    const idx = Math.max(
      0,
      tracks.findIndex((t) => t.id === remote.trackId)
    );
    const trk = tracks[idx] ?? tracks[0];
    setCurrentIndex(idx);
    await engine.syncToRemoteAnchor(remote, trk, serverClockOffsetRef.current);
  };

  const handleTogglePlay = async () => {
    if (!currentTrack) return;
    if (engineSnap.isPlaying) {
      const pos = engine.getPositionSec();
      engine.pause(pos);
      await publishTransportUpdate(currentTrack, currentIndex, false, pos);
    } else {
      const pos = engine.getPositionSec();
      await engine.play(pos);
      await publishTransportUpdate(currentTrack, currentIndex, true, pos);
    }
  };

  const handleToggleRoomPlay = async (playlist: CollaborativePlaylist) => {
    if (activeSyncedRoomId !== playlist.id) {
      await handleJoinSyncRoom(playlist);
      return;
    }
    await handleTogglePlay();
  };

  const handlePrev = async () => {
    if (queue.length === 0) return;
    const prevIdx = (currentIndex - 1 + queue.length) % queue.length;
    const trk = queue[prevIdx];
    setCurrentIndex(prevIdx);
    engine.setTrack(trk, 0);
    await engine.play(0);
    await publishTransportUpdate(trk, prevIdx, true, 0);
  };

  const handleNext = async () => {
    if (queue.length === 0) return;
    const nextIdx = (currentIndex + 1) % queue.length;
    const trk = queue[nextIdx];
    setCurrentIndex(nextIdx);
    engine.setTrack(trk, 0);
    await engine.play(0);
    await publishTransportUpdate(trk, nextIdx, true, 0);
  };

  const handleSeek = async (sec: number) => {
    if (!currentTrack) return;
    engine.seek(sec);
    await publishTransportUpdate(currentTrack, currentIndex, engineSnap.isPlaying, sec);
  };

  const handleRateChange = async (rate: number) => {
    setPlaybackRate(rate);
    engine.setPlaybackRate(rate);
    if (currentTrack) {
      await publishTransportUpdate(currentTrack, currentIndex, engineSnap.isPlaying, engine.getPositionSec(), rate);
    }
  };

  const handleSelectEqPreset = (preset: EqPresetId) => {
    setEqPreset(preset);
    engine.applyEqPreset(preset);
  };

  const handleEqChange = (settings: EqSettings) => {
    engine.setEqSettings(settings);
  };

  const handleCreateCollab = async (data: {
    title: string;
    description: string;
    coverUrl: string;
    includeStarterTrack: boolean;
  }) => {
    if (!user) return;
    const id = generateSafeId('room');
    await createCollaborativePlaylist({
      id,
      title: data.title,
      description: data.description,
      coverUrl: data.coverUrl,
      user,
      sessionId: TAB_SESSION_ID,
      initialTracks: data.includeStarterTrack ? [STUDIO_TRACK_LIBRARY[0]] : [],
    });
    setSelectedCollabId(id);
    setActiveTab('collaborative');
  };

  const handleCreatePublic = async (data: {
    title: string;
    description: string;
    genre: string;
    coverUrl: string;
  }) => {
    if (!user) return;
    const id = generateSafeId('pub');
    await createPublicPlaylist({
      id,
      title: data.title,
      description: data.description,
      genre: data.genre,
      coverUrl: data.coverUrl,
      user,
      initialTracks: [STUDIO_TRACK_LIBRARY[0], STUDIO_TRACK_LIBRARY[1]],
    });
    setSelectedPublicId(id);
    setActiveTab('discover');
  };

  const handleForkPublicToCollab = async (playlist: PublicPlaylist) => {
    if (!user) return;
    let tracks =
      selectedPublicPlaylist?.id === playlist.id ? selectedPublicTracks : [];
    if (tracks.length === 0) {
      tracks = await fetchPlaylistTracks('publicPlaylists', playlist.id);
    }
    const id = generateSafeId('room');
    await createCollaborativePlaylist({
      id,
      title: `${playlist.title} (Sync)`,
      description: playlist.description || `Forked from ${playlist.title}`,
      coverUrl: playlist.coverUrl || COVER_ASSETS[0].url,
      user,
      sessionId: TAB_SESSION_ID,
      initialTracks: tracks,
    });
    setSelectedCollabId(id);
    setActiveTab('collaborative');
  };

  const handleAddTrackToCollab = async (
    playlist: CollaborativePlaylist,
    track: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>
  ) => {
    if (!user) return;
    const existingTracks = selectedCollabPlaylist?.id === playlist.id ? selectedCollabTracks : [];
    const nextOrder = existingTracks.length;
    await addTrackToPlaylist({
      collectionName: 'collaborativePlaylists',
      playlistId: playlist.id,
      track: { ...track, id: generateSafeId('trk'), order: nextOrder },
      nextTrackCount: playlist.trackCount + 1,
      user,
    });
  };

  const handleUploadLocalTrack = async (playlist: CollaborativePlaylist, file: File) => {
    if (!user) return;
    const trackId = generateSafeId('local');
    const durationSec = await engine.loadLocalAudioFile(file, trackId);
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').slice(0, 90) || 'Local Audio File';
    const nextOrder = selectedCollabPlaylist?.id === playlist.id ? selectedCollabTracks.length : 0;
    await addTrackToPlaylist({
      collectionName: 'collaborativePlaylists',
      playlistId: playlist.id,
      track: {
        id: trackId,
        title: cleanTitle,
        artist: profile?.displayName || 'Local Upload',
        genre: 'Local Audio',
        durationSec,
        bpm: 100,
        synthPreset: 'warm_pad',
        rootNote: 'C3',
        coverUrl: playlist.coverUrl || COVER_ASSETS[0].url,
        order: nextOrder,
      },
      nextTrackCount: playlist.trackCount + 1,
      user,
    });
  };

  const handleRemoveTrackFromCollab = async (playlist: CollaborativePlaylist, trackId: string) => {
    await removeTrackFromPlaylist({
      collectionName: 'collaborativePlaylists',
      playlistId: playlist.id,
      trackId,
      nextTrackCount: Math.max(0, playlist.trackCount - 1),
    });
  };

  const handleSaveComposedTrack = async (
    collectionName: 'collaborativePlaylists' | 'publicPlaylists',
    playlistId: string,
    track: Omit<PlaylistTrack, 'addedBy' | 'order' | 'createdAtMs'>
  ) => {
    if (!user) return;
    const existing = await fetchPlaylistTracks(collectionName, playlistId);
    const nextTotal =
      existing.reduce((sum, t) => sum + t.durationSec, 0) + track.durationSec;
    await addTrackToPlaylist({
      collectionName,
      playlistId,
      track: { ...track, order: existing.length },
      nextTrackCount: existing.length + 1,
      nextTotalDurationSec: collectionName === 'publicPlaylists' ? nextTotal : undefined,
      user,
    });
  };

  const handleResumeHandoff = async () => {
    const handoff = profile?.playbackState;
    if (!handoff) return;
    if (handoff.playlistId && handoff.playlistType === 'collaborative') {
      const room = collabPlaylists.find((c) => c.id === handoff.playlistId);
      if (room) {
        setActiveTab('collaborative');
        await handleJoinSyncRoom(room);
        return;
      }
    }
    const studioMatch =
      STUDIO_TRACK_LIBRARY.find((t) => t.id === handoff.trackId) || STUDIO_TRACK_LIBRARY[0];
    const fullTrack: PlaylistTrack = {
      ...studioMatch,
      addedBy: user?.uid || 'studio',
      order: 0,
      createdAtMs: Date.now(),
    };
    setActiveSyncedRoomId(null);
    setQueue([fullTrack]);
    setCurrentIndex(0);
    engine.setTrack(fullTrack, handoff.anchorPositionSec || 0);
    await engine.play(handoff.anchorPositionSec || 0);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center">
        <p className="text-sm text-[#8E95A5]">Connecting to Sonora...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        onSignIn={handleSignIn}
        isSigningIn={isSigningIn}
        authError={authError}
      />
    );
  }

  const pendingInviteCount = incomingInvites.filter((i) => i.status === 'pending').length;

  return (
    <div className="h-screen flex flex-col bg-[#0B0D12] text-[#F4F4F6] overflow-hidden">
      <div className="flex-1 flex min-h-0">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          pendingInviteCount={pendingInviteCount}
          profile={profile}
          onSignOut={handleSignOut}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            activeTab={activeTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenCreateModal={() => setCreateModalOpen(true)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />

          <main className="flex-1 overflow-y-auto px-4 lg:px-8 pt-6">
            {activeTab === 'discover' && (
              <DiscoverView
                publicPlaylists={publicPlaylists}
                selectedPlaylist={selectedPublicPlaylist}
                selectedTracks={selectedPublicTracks}
                loadingTracks={loadingPublicTracks}
                activeTrackId={currentTrack?.id}
                isPlaying={engineSnap.isPlaying}
                searchQuery={searchQuery}
                onSelectPlaylist={(p) => setSelectedPublicId(p.id)}
                onPlayPlaylist={handlePlayPublicPlaylist}
                onForkToCollab={handleForkPublicToCollab}
                onSeedStarterCatalog={() => seedStarterPublicPlaylists(user)}
                onPlayQuickTrack={handlePlayQuickTrack}
              />
            )}

            {activeTab === 'collaborative' && (
              <CollaborativeView
                currentUid={user.uid}
                playlists={collabPlaylists}
                selectedPlaylist={selectedCollabPlaylist}
                tracks={selectedCollabTracks}
                loadingTracks={loadingCollabTracks}
                directory={directory}
                activeSyncedPlaylistId={activeSyncedRoomId}
                isPlaying={engineSnap.isPlaying}
                activeTrackId={currentTrack?.id}
                lastDriftMs={engineSnap.lastDriftMs}
                searchQuery={searchQuery}
                onSelectPlaylist={(p) => setSelectedCollabId(p.id)}
                onOpenCreateModal={() => setCreateModalOpen(true)}
                onJoinSyncRoom={handleJoinSyncRoom}
                onToggleRoomPlay={handleToggleRoomPlay}
                onAddTrack={handleAddTrackToCollab}
                onUploadLocalTrack={handleUploadLocalTrack}
                onRemoveTrack={handleRemoveTrackFromCollab}
                onSendInvite={(pl, recipient) => sendCollabInvite(pl, user, recipient)}
                onLeaveRoom={async (pl) => {
                  await leaveCollaborativePlaylist(pl.id, user.uid);
                  if (activeSyncedRoomId === pl.id) setActiveSyncedRoomId(null);
                  if (selectedCollabId === pl.id) setSelectedCollabId(null);
                }}
                onDeleteRoom={async (pl) => {
                  await deleteCollaborativePlaylist(pl.id);
                  if (activeSyncedRoomId === pl.id) setActiveSyncedRoomId(null);
                  if (selectedCollabId === pl.id) setSelectedCollabId(null);
                }}
              />
            )}

            {activeTab === 'invites' && (
              <InvitesView
                incoming={incomingInvites}
                outgoing={outgoingInvites}
                onRespond={async (invite, accept) => {
                  await respondToCollabInvite(invite, accept);
                  if (accept) {
                    setSelectedCollabId(invite.playlistId);
                    setActiveTab('collaborative');
                  }
                }}
              />
            )}

            {activeTab === 'studio' && (
              <StudioRackView
                engine={engine}
                isPlaying={engineSnap.isPlaying}
                eqPreset={eqPreset}
                playbackRate={playbackRate}
                collabPlaylists={collabPlaylists}
                publicPlaylists={publicPlaylists}
                currentUid={user.uid}
                onSelectEqPreset={handleSelectEqPreset}
                onEqChange={handleEqChange}
                onRateChange={handleRateChange}
                onPlayCustomTrack={handlePlayQuickTrack}
                onSaveTrackToPlaylist={handleSaveComposedTrack}
              />
            )}

            {activeTab === 'library' && (
              <LibraryView
                profile={profile}
                collabPlaylists={collabPlaylists}
                publicPlaylists={publicPlaylists}
                currentUid={user.uid}
                onUpdateProfile={(name, handle) => updateUserHandle(user.uid, handle, name)}
                onResumeHandoff={handleResumeHandoff}
                onOpenCollabRoom={(pl) => {
                  setSelectedCollabId(pl.id);
                  setActiveTab('collaborative');
                }}
                onOpenPublicPlaylist={(pl) => {
                  setSelectedPublicId(pl.id);
                  setActiveTab('discover');
                }}
              />
            )}
          </main>
        </div>
      </div>

      <TransportBar
        currentTrack={currentTrack}
        isPlaying={engineSnap.isPlaying}
        positionSec={engineSnap.positionSec}
        durationSec={engineSnap.durationSec}
        volume={volume}
        needsUserGesture={engineSnap.needsUserGesture}
        isSyncedRoom={Boolean(activeSyncedRoomId)}
        syncRoomTitle={activeSyncedRoom?.title}
        lastDriftMs={engineSnap.lastDriftMs}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={handleSeek}
        onVolumeChange={(v) => {
          setVolume(v);
          engine.setVolume(v);
        }}
        onUnlockAudio={() => engine.unlockAudio()}
        onOpenStudio={() => setActiveTab('studio')}
      />

      <CreatePlaylistModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreateCollab={handleCreateCollab}
        onCreatePublic={handleCreatePublic}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SonoraWorkspace />
    </ErrorBoundary>
  );
}
