// Drizzle schema. Tables arrive stage by stage; see docs/ARCHITECTURE.md, "Data model".
// After changing it, run `npm run db:generate -w @bookclub/server` and commit the new migration.
import { sql } from 'drizzle-orm';
import { boolean, customType, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (value) => Buffer.from(value),
});

// Accounts: the tables Better Auth expects (property names are its field names).
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  /** Display name shown to club members. */
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  ...timestamps,
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

/** A way to sign in: provider "credential" holds the password hash, "google" the Google identity. */
export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps,
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_provider_account_uidx').on(table.providerId, table.accountId),
  ],
);

/** Short-lived tokens: email confirmation, password reset, OAuth state. */
export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// Books. Editions are what members hold; rows come from Open Library, Google Books or manual entry.
export const edition = pgTable(
  'edition',
  {
    id: text('id').primaryKey(),
    source: text('source', { enum: ['openlibrary', 'google', 'manual'] }).notNull(),
    /** The provider's id (Open Library edition "OL…M", Google volume id); null for manual entries. */
    sourceId: text('source_id'),
    isbn13: text('isbn13'),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    authors: text('authors').array().notNull().default(sql`'{}'::text[]`),
    publisher: text('publisher'),
    published: text('published'),
    pageCount: integer('page_count'),
    language: text('language'),
    /** Open Library work ("OL…W") this edition belongs to, when known. */
    workKey: text('work_key'),
    /** Key for /api/covers/:key, or null. */
    cover: text('cover'),
    /** Who typed in a manual entry. */
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('edition_source_uidx').on(table.source, table.sourceId),
    index('edition_isbn13_idx').on(table.isbn13),
    index('edition_work_key_idx').on(table.workKey),
  ],
);

/** Provider answers (searches, edition lists, ISBN lookups), so repeat questions never reach the quota. */
export const bookCache = pgTable('book_cache', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Cover images, fetched once from the provider and served from here. `bytes` null = the provider has none. */
export const cover = pgTable('cover', {
  key: text('key').primaryKey(),
  contentType: text('content_type'),
  bytes: bytea('bytes'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});

// Clubs. Membership roles: exactly one owner per club (partial unique index), any number of admins.
export const club = pgTable(
  'club',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    inviteCode: text('invite_code').notNull(),
    memberCap: integer('member_cap').notNull(),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [uniqueIndex('club_invite_code_uidx').on(table.inviteCode)],
);

export const clubMember = pgTable(
  'club_member',
  {
    clubId: text('club_id')
      .notNull()
      .references(() => club.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.clubId, table.userId] }),
    index('club_member_user_idx').on(table.userId),
    uniqueIndex('club_member_one_owner_uidx').on(table.clubId).where(sql`role = 'owner'`),
  ],
);

/** A book the club reads: one current at a time, the rest finished (past books). */
export const clubBook = pgTable(
  'club_book',
  {
    id: text('id').primaryKey(),
    clubId: text('club_id')
      .notNull()
      .references(() => club.id, { onDelete: 'cascade' }),
    /** The club's reference edition: meeting pages are in this edition. */
    editionId: text('edition_id')
      .notNull()
      .references(() => edition.id, { onDelete: 'restrict' }),
    status: text('status', { enum: ['current', 'finished'] }).notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    finishDate: date('finish_date', { mode: 'string' }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('club_book_club_idx').on(table.clubId),
    uniqueIndex('club_book_one_current_uidx').on(table.clubId).where(sql`status = 'current'`),
  ],
);

export const meeting = pgTable(
  'meeting',
  {
    id: text('id').primaryKey(),
    clubBookId: text('club_book_id')
      .notNull()
      .references(() => clubBook.id, { onDelete: 'cascade' }),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    title: text('title').notNull(),
    location: text('location'),
    readToPage: integer('read_to_page'),
    ...timestamps,
  },
  (table) => [index('meeting_club_book_idx').on(table.clubBookId)],
);
