import {
  GroupModel,
  MembershipModel,
  PreferencesModel,
  UserModel,
  WishlistItemModel,
} from '../models/index.js';
import { deleteGroupData } from '../services/group-data.js';
import { logger } from '../utils/logger.js';

export const DEMO_INVITE_CODE = 'DEMOxmas';

const people = [
  { name: 'Nika', email: 'nika@example.com', role: 'organizer' as const },
  { name: 'Ana', email: 'ana@example.com', role: 'participant' as const },
  { name: 'Marko', email: 'marko@example.com', role: 'participant' as const },
  { name: 'Eva', email: 'eva@example.com', role: 'participant' as const },
  { name: 'Luka', email: 'luka@example.com', role: 'participant' as const },
  { name: 'Maja', email: 'maja@example.com', role: 'participant' as const },
];

const wishes: Record<string, Array<{ title: string; price?: number; url?: string; notes?: string }>> = {
  Nika: [
    { title: 'Board game: Wingspan', price: 45, url: 'https://boardgamegeek.com/boardgame/266192/wingspan' },
    { title: 'Fancy hot chocolate', price: 12, notes: 'Dark, not milk!' },
  ],
  Ana: [
    { title: 'Wool socks', price: 15, notes: 'Size 38, anything colourful' },
    { title: 'A good thriller novel', price: 20 },
  ],
  Marko: [
    { title: 'Bike light set', price: 25 },
    { title: 'Coffee beans from a local roaster', price: 18 },
  ],
  Eva: [{ title: 'Watercolour paints', price: 30, notes: 'Travel-size set would be perfect' }],
  Luka: [],
  Maja: [
    { title: 'Houseplant (low light)', price: 20 },
    { title: 'Scented candle', price: 15, notes: 'No vanilla' },
  ],
};

/**
 * Creates (or recreates) a demo group with 6 participants, two couples excluded from each other,
 * wishlists and preferences. Sign in as any of the demo emails using the dev instant sign-in.
 */
export async function seedDemo(): Promise<{ groupId: string; inviteCode: string }> {
  const existing = await GroupModel.findOne({ inviteCode: DEMO_INVITE_CODE });
  if (existing) await deleteGroupData(existing._id);

  const users = [];
  for (const p of people) {
    users.push(
      await UserModel.findOneAndUpdate(
        { email: p.email },
        { $setOnInsert: { email: p.email, name: p.name, language: 'sl' } },
        { upsert: true, returnDocument: 'after' },
      ),
    );
  }
  const byName = new Map(users.map((u) => [u.name, u]));
  const id = (name: string) => byName.get(name)!._id;

  const now = new Date();
  const year =
    now.getUTCMonth() === 11 && now.getUTCDate() > 24 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const group = await GroupModel.create({
    name: `Family Christmas ${year}`,
    description: 'Our yearly gift swap at grandma’s. Keep it cosy and within budget!',
    exchangeDate: new Date(`${year}-12-24T12:00:00Z`),
    budget: { amount: 30, currency: 'EUR' },
    location: 'Grandma’s house',
    organizerId: id('Nika'),
    inviteCode: DEMO_INVITE_CODE,
    exclusions: [
      { a: id('Ana'), b: id('Marko') },
      { a: id('Eva'), b: id('Luka') },
    ],
  });

  for (const p of people) {
    const userId = id(p.name);
    await MembershipModel.create({ groupId: group._id, userId, role: p.role });
    await WishlistItemModel.insertMany(
      wishes[p.name].map((w, order) => ({ ...w, groupId: group._id, userId, order })),
    );
  }
  await PreferencesModel.create({
    groupId: group._id,
    userId: id('Ana'),
    sizes: 'Shoes 38, T-shirt S',
    likes: 'Green, crime novels, tea',
    dislikes: 'Anything with lavender',
  });

  logger.info(
    `🎄 Demo group "${group.name}" seeded (invite code ${DEMO_INVITE_CODE}). ` +
      `Sign in as ${people.map((p) => p.email).join(', ')}.`,
  );
  return { groupId: group.id, inviteCode: DEMO_INVITE_CODE };
}
