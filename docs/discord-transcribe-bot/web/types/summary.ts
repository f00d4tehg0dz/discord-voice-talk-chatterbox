export interface Participant {
  userId: string;
  username: string;
  isDM: boolean;
}

export interface Campaign {
  _id: string;
  name: string;
  guildId: string;
  dmUserId: string;
}

export interface Summary {
  _id: string;
  guildId: string;
  campaignId: Campaign;
  sessionNumber: number;
  sessionStart: string;
  sessionEnd: string;
  encryptedSummary: {
    iv: string;
    encryptedData: string;
    authTag: string;
  };
  encryptedCliffNotes: {
    iv: string;
    encryptedData: string;
    authTag: string;
  };
  decryptedText?: string;
  participants: Participant[];
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SummariesResponse {
  summaries: Summary[];
  campaigns: Campaign[];
  pagination: Pagination;
} 