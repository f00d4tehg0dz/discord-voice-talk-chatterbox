interface Session {
  _id: string;
  date: string;
  title: string;
  summary: string;
  participants: Array<{
    userId: string;
    username: string;
    isDM: boolean;
  }>;
}

interface CampaignTimelineProps {
  campaign: {
    _id: string;
    sessions: Session[];
  };
}

export default function CampaignTimeline({ campaign }: CampaignTimelineProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white">Session Timeline</h2>
      <div className="relative">
        {campaign.sessions?.map((session, index) => (
          <div key={session._id} className="mb-8 relative">
            {/* Timeline connector */}
            {index < campaign.sessions.length - 1 && (
              <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-700" />
            )}
            
            <div className="flex gap-4">
              {/* Timeline dot */}
              <div className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-purple-600 text-white">
                {index + 1}
              </div>
              
              {/* Session content */}
              <div className="flex-1 bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-medium text-white">{session.title}</h3>
                  <span className="text-sm text-gray-400">
                    {new Date(session.date).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-300 mb-3">{session.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {session.participants.map((participant) => (
                    <span
                      key={participant.userId}
                      className={`inline-flex items-center px-2 py-1 rounded text-sm ${
                        participant.isDM
                          ? 'bg-purple-900 text-purple-200'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {participant.username}
                      {participant.isDM && (
                        <span className="ml-1 text-xs">(DM)</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
        {(!campaign.sessions || campaign.sessions.length === 0) && (
          <div className="text-center py-8 text-gray-400">
            No sessions recorded yet.
          </div>
        )}
      </div>
    </div>
  );
} 