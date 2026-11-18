import React, { useState } from 'react';
import { Check, Mail, Send, X } from 'lucide-react';
import { CollabInvite } from '../types/sonora';

interface InvitesViewProps {
  incoming: CollabInvite[];
  outgoing: CollabInvite[];
  onRespond: (invite: CollabInvite, accept: boolean) => Promise<void>;
}

export const InvitesView: React.FC<InvitesViewProps> = ({
  incoming,
  outgoing,
  onRespond,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAction = async (invite: CollabInvite, accept: boolean) => {
    setProcessingId(invite.id);
    try {
      await onRespond(invite, accept);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 pb-8">
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#F4F4F6]">
            Incoming Invitations
          </h2>
          <p className="text-xs text-[#8E95A5] mt-0.5">
            Accepting joins the collaborative room atomically via collabInvites
          </p>
        </div>

        {incoming.length === 0 ? (
          <div className="bg-[#131720] border border-white/8 rounded-xl p-8 text-center space-y-2">
            <Mail className="w-7 h-7 text-[#8E95A5] mx-auto" />
            <p className="text-sm font-medium text-[#F4F4F6]">No incoming invitations</p>
            <p className="text-xs text-[#8E95A5]">
              When another listener invites your account to a collaborative playlist, it appears here in real time.
            </p>
          </div>
        ) : (
          <div className="bg-[#131720] border border-white/8 rounded-xl divide-y divide-white/[0.06]">
            {incoming.map((inv) => (
              <div
                key={inv.id}
                className="p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#F4F4F6] truncate">
                    {inv.playlistTitle}
                  </p>
                  <p className="text-xs text-[#8E95A5] mt-0.5">
                    Invited by {inv.fromName} · Status: {inv.status}
                  </p>
                </div>

                {inv.status === 'pending' ? (
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => handleAction(inv, false)}
                      disabled={processingId === inv.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1B202C] border border-white/10 text-xs font-medium text-[#8E95A5] hover:text-[#F4F4F6] rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Decline
                    </button>
                    <button
                      onClick={() => handleAction(inv, true)}
                      disabled={processingId === inv.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#E5A93C] text-[#0B0D12] text-xs font-semibold rounded-lg hover:bg-[#ebb758] transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {processingId === inv.id ? 'Joining...' : 'Accept & Join'}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-[#8E95A5] capitalize">
                    {inv.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#F4F4F6]">
            Sent Invitations
          </h2>
          <p className="text-xs text-[#8E95A5] mt-0.5">
            Track status of invitations sent from your collaborative rooms
          </p>
        </div>

        {outgoing.length === 0 ? (
          <div className="bg-[#131720] border border-white/8 rounded-xl p-8 text-center space-y-2">
            <Send className="w-6 h-6 text-[#8E95A5] mx-auto" />
            <p className="text-sm text-[#8E95A5]">No outgoing invitations sent yet.</p>
          </div>
        ) : (
          <div className="bg-[#131720] border border-white/8 rounded-xl divide-y divide-white/[0.06]">
            {outgoing.map((inv) => (
              <div
                key={inv.id}
                className="p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#F4F4F6] truncate">
                    {inv.playlistTitle}
                  </p>
                  <p className="text-xs text-[#8E95A5] mt-0.5">
                    To {inv.toName}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium capitalize ${
                    inv.status === 'accepted'
                      ? 'text-[#4ADE80]'
                      : inv.status === 'declined'
                      ? 'text-[#F87171]'
                      : 'text-[#E5A93C]'
                  }`}
                >
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
