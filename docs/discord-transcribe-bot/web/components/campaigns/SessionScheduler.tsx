interface CampaignSchedulerProps {
  campaign: {
    _id: string;
    name: string;
    nextSessionDate?: string;
  };
}

export default function SessionScheduler({ campaign }: CampaignSchedulerProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Session Scheduler</h2>
        <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          Schedule New Session
        </button>
      </div>

      {/* Next Session Card */}
      {campaign.nextSessionDate ? (
        <div className="bg-gray-800 p-6 rounded-lg border border-purple-500/30">
          <h3 className="text-lg font-medium text-white mb-2">Next Scheduled Session</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-400">
                {new Date(campaign.nextSessionDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-gray-400 text-sm">
                {new Date(campaign.nextSessionDate).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="space-x-2">
              <button className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors text-sm">
                Cancel
              </button>
              <button className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors text-sm">
                Edit
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 p-6 rounded-lg text-center">
          <p className="text-gray-400">No upcoming sessions scheduled</p>
        </div>
      )}

      {/* Calendar Component Placeholder */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <div className="text-center text-gray-400">
          <p>Calendar integration coming soon!</p>
          <p className="text-sm mt-2">You&apos;ll be able to:</p>
          <ul className="text-sm mt-1 space-y-1">
            <li>• View available time slots</li>
            <li>• Schedule recurring sessions</li>
            <li>• Sync with Discord events</li>
            <li>• Send automatic reminders</li>
          </ul>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button className="bg-gray-800 p-4 rounded-lg text-left hover:bg-gray-700 transition-colors">
          <h4 className="text-white font-medium">📊 View Attendance History</h4>
          <p className="text-gray-400 text-sm mt-1">Track player participation over time</p>
        </button>
        <button className="bg-gray-800 p-4 rounded-lg text-left hover:bg-gray-700 transition-colors">
          <h4 className="text-white font-medium">⚙️ Schedule Settings</h4>
          <p className="text-gray-400 text-sm mt-1">Configure scheduling preferences</p>
        </button>
      </div>
    </div>
  );
} 