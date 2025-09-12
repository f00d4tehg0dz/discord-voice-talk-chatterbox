interface CampaignNotesProps {
  campaign: {
    _id: string;
    notes: Array<{
      _id: string;
      title: string;
      content: string;
      category: string;
      createdAt: string;
      updatedAt: string;
    }>;
  };
}

export default function CampaignNotes({ campaign }: CampaignNotesProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Campaign Notes</h2>
        <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          Add Note
        </button>
      </div>
      <div className="grid gap-4">
        {campaign.notes?.map((note) => (
          <div key={note._id} className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-medium text-white">{note.title}</h3>
              <span className="text-sm text-gray-400">
                {new Date(note.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-gray-300 whitespace-pre-wrap">{note.content}</p>
            <div className="mt-2">
              <span className="inline-block px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                {note.category}
              </span>
            </div>
          </div>
        ))}
        {(!campaign.notes || campaign.notes.length === 0) && (
          <div className="text-center py-8 text-gray-400">
            No notes yet. Click &quot;Add Note&quot; to create one.
          </div>
        )}
      </div>
    </div>
  );
} 