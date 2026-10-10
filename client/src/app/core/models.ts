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
  /** Signed up with only an email; ask for a name once. */
  needsName: boolean;
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

export interface Match {
  id: string;
  name: string;
  shippingAddress: string | null;
}

export type Feasibility = (
  | { ok: true }
  | {
      ok: false;
      code: 'too_few' | 'duplicate' | 'cannot_give' | 'cannot_receive' | 'too_constrained';
      reason: string;
      people: string[];
    }
) & { participantCount: number };

export interface DashboardMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  participates: boolean;
  joinedAt: string;
  hasMatch: boolean;
  viewedMatch: boolean;
  wishlistCount: number;
  hasPreferences: boolean;
  giftStatus: GiftStatus;
}

export interface Dashboard {
  group: Group;
  canSeePairs: boolean;
  feasibility: Feasibility | null;
  members: DashboardMember[];
}

export interface PairView {
  giver: { id: string; name: string };
  receiver: { id: string; name: string };
}

export interface WishlistItem {
  id: string;
  title: string;
  url: string;
  price: number | null;
  notes: string;
  image: ImageRef | null;
  order: number;
}

export interface WishlistItemInput {
  title: string;
  url?: string;
  price?: number | null;
  notes?: string;
  image?: ImageRef | null;
}

export interface Preferences {
  sizes: string;
  likes: string;
  dislikes: string;
}

export type UploadPurpose = 'wishlist' | 'gallery' | 'cover';

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  uploadUrl: string;
  timestamp: number;
  folder: string;
  allowed_formats: string;
  signature: string;
}

export type ChatWho = 'match' | 'santa';

export interface ChatMessage {
  id: string;
  mine: boolean;
  text: string;
  createdAt: string;
}

export interface GalleryPhoto {
  id: string;
  image: ImageRef;
  caption: string;
  by: string;
  mine: boolean;
  createdAt: string;
}
