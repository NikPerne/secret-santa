import type { GroupDoc, MembershipDoc, UserDoc } from '../models/index.js';

export function serializeUser(user: UserDoc) {
  return {
    id: user.id as string,
    email: user.email,
    name: user.name,
    language: user.language,
    emailNotifications: user.emailNotifications,
    needsName: user.needsName ?? false,
    pushEnabled: user.pushSubscriptions.length > 0,
  };
}

export function serializeImage(
  image: { url: string; publicId: string; width?: number | null; height?: number | null } | null | undefined,
) {
  return image
    ? { url: image.url, publicId: image.publicId, width: image.width ?? null, height: image.height ?? null }
    : null;
}

export function exchangePassed(group: GroupDoc, now = new Date()): boolean {
  return Boolean(group.exchangeDate && group.exchangeDate.getTime() <= now.getTime());
}

export function serializeGroup(group: GroupDoc, membership?: MembershipDoc) {
  const isOrganizer = membership?.role === 'organizer';
  return {
    id: group.id as string,
    name: group.name,
    description: group.description,
    coverImage: serializeImage(group.coverImage),
    exchangeDate: group.exchangeDate?.toISOString() ?? null,
    budget: { amount: group.budget?.amount ?? null, currency: group.budget?.currency ?? 'EUR' },
    location: group.location,
    inviteCode: group.inviteCode,
    status: group.status,
    theme: { preset: group.theme?.preset ?? 'none', text: group.theme?.text ?? '' },
    settings: {
      organizerSeesPairs: group.settings?.organizerSeesPairs ?? false,
      organizerParticipates: group.settings?.organizerParticipates ?? true,
      allowShippingAddress: group.settings?.allowShippingAddress ?? false,
      bigRevealAfterExchange: group.settings?.bigRevealAfterExchange ?? true,
      avoidPreviousPairs: group.settings?.avoidPreviousPairs ?? true,
    },
    exclusions: isOrganizer ? group.exclusions.map((e) => ({ a: String(e.a), b: String(e.b) })) : undefined,
    previousGroupId: group.previousGroupId ? String(group.previousGroupId) : null,
    drawnAt: group.drawnAt?.toISOString() ?? null,
    exchangePassed: exchangePassed(group),
  };
}

export function serializeMyMembership(m: MembershipDoc) {
  return {
    role: m.role,
    participates: m.participates,
    joinedAt: m.joinedAt.toISOString(),
    viewedMatchAt: m.viewedMatchAt?.toISOString() ?? null,
    giftStatus: m.giftStatus,
    shippingAddress: m.shippingAddress,
  };
}
