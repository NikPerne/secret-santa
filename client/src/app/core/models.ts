export type Lang = 'en' | 'sl';
export type GroupStatus = 'open' | 'drawn' | 'finished';
export type GiftStatus = 'none' | 'bought' | 'delivered';
export type Role = 'organizer' | 'participant';

export interface User {
  id: string;
  email: string;
  name: string;
  language: Lang;
  emailNotifications: boolean;
  pushEnabled: boolean;
}

export interface ImageRef {
  url: string;
  publicId: string;
  width?: number | null;
  height?: number | null;
}

export interface Budget {
  amount: number | null;
  currency: string;
}

export interface GroupSettings {
  organizerSeesPairs: boolean;
  organizerParticipates: boolean;
  allowShippingAddress: boolean;
  bigRevealAfterExchange: boolean;
  avoidPreviousPairs: boolean;
}

export interface Exclusion {
  a: string;
  b: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  coverImage: ImageRef | null;
  exchangeDate: string | null;
  budget: Budget;
  location: string;
  inviteCode: string;
  status: GroupStatus;
  settings: GroupSettings;
  exclusions?: Exclusion[];
  previousGroupId: string | null;
  drawnAt: string | null;
  exchangePassed: boolean;
}

export interface GroupSummary extends Group {
  role: Role;
  memberCount: number;
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  participates: boolean;
}

export interface MyMembership {
  role: Role;
  participates: boolean;
  joinedAt: string;
  viewedMatchAt: string | null;
  giftStatus: GiftStatus;
  shippingAddress: string;
}

export interface GroupDetail {
  group: Group;
  me: MyMembership;
  members: Member[];
}

export interface InvitePreview {
  groupId?: string;
  name: string;
  description: string;
  coverImage: ImageRef | null;
  exchangeDate: string | null;
  budget: Budget;
  location: string;
  status: GroupStatus;
  organizerName: string;
  memberCount: number;
  alreadyMember: boolean;
}

export interface AppConfig {
  instantJoin: boolean;
  uploads: boolean;
  pushPublicKey: string | null;
}

export interface GroupInput {
  name?: string;
  description?: string;
  exchangeDate?: string | null;
  budget?: Partial<Budget>;
  location?: string;
  settings?: Partial<GroupSettings>;
  coverImage?: ImageRef | null;
}

export interface ApiErrorBody {
  error?: { code: string; message: string; details?: unknown };
}
