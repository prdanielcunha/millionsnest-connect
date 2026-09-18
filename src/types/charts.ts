export type ZeroCostDecisionStatus = 'allowed' | 'near_limit' | 'paused' | 'blocked';

export interface ZeroCostPolicyDecision {
  status: ZeroCostDecisionStatus;
  reason: string;
  provider?: string;
  resource?: string;
  measuredUsage?: number;
  freeLimit?: number;
  financialCostBrl: 0;
  checkedAt: string;
}

export type SongChartRightsStatus = 'owned' | 'licensed' | 'public_domain' | 'restricted' | 'unknown';

export interface SongChartRights {
  status: SongChartRightsStatus;
  allowFullDisplay: boolean;
  allowWhatsAppText: boolean;
  allowDocument: boolean;
  allowTransposition: boolean;
  attribution?: string;
  licenseExpiresAt?: string;
}

export interface SongChartProjection {
  songId: string;
  organizationId?: string;
  title: string;
  artist?: string;
  version?: string;
  key?: string;
  originalKey?: string;
  selectedKey?: string;
  bpm?: number;
  lyrics: string;
  chords: string;
  chordsUrl?: string;
  sections?: { name: string; startLine: number; endLine: number }[];
  tabs?: string;
  source: 'organization' | 'living_library' | 'licensed_provider';
  revision?: string;
  checksum: string;
  rights: SongChartRights;
}

export interface SongChartChunk {
  index: number;
  total: number;
  content: string;
}

export interface SongSearchResult {
  songId: string;
  title: string;
  artist?: string;
  version?: string;
  key?: string;
  originalKey?: string;
  selectedKey?: string;
  bpm?: number;
  source: SongChartProjection['source'];
  rightsStatus: SongChartRightsStatus;
  organizationScoped: boolean;
}

export interface SongChartAmbiguityOption {
  songId: string;
  title: string;
  artist?: string;
  version?: string;
  key?: string;
  bpm?: number;
}

export type SongChartDeliveryMode = 'full_text' | 'auto_chunked' | 'document_stub' | 'musician_mode_stub' | 'blocked';

export interface SongChartDelivery {
  mode: SongChartDeliveryMode;
  resolvedSong?: SongChartProjection;
  resolvedKey?: string;
  chunks: SongChartChunk[];
  chunkCount: number;
  automaticContinuation: boolean;
  ambiguityOptions?: SongChartAmbiguityOption[];
  blockedReason?: string;
  supplementaryActions: string[];
}

export type ScheduleDocumentStatus = 'available_stub' | 'unavailable' | 'blocked';

export interface ScheduleSongbookProjection {
  scheduleId: string;
  organizationId: string;
  title: string;
  date: string;
  time: string;
  songs: SongChartProjection[];
  documentStatus: ScheduleDocumentStatus;
}
