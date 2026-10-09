import type { IncomingMessage, Server } from 'node:http';
import type { Http2SecureServer, Http2Server } from 'node:http2';
import type { Duplex } from 'node:stream';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Auth } from './auth';
import type { Db } from './db/client';
import { clubBook, clubMember, edition } from './db/schema';

// Live updates: one WebSocket per open app (GET /api/live, signed in). Messages only say *what* changed;
// the app refetches it through the normal API, so permissions are checked in one place.

export type LiveEvent =
  | { type: 'readings' } // my readings changed (another device, or this one)
  | { type: 'club'; clubId: string } // a club's details changed (book, meetings, members)
  | { type: 'club-progress'; clubId: string }; // a member of the club logged progress on the club book

interface Socket {
  send(data: string): void;
}

export function createLiveHub({ db, log }: { db: Db; log: Logger }) {
  const byUser = new Map<string, Set<Socket>>();

  function send(userIds: Iterable<string>, event: LiveEvent) {
    const message = JSON.stringify(event);
    for (const userId of new Set(userIds)) {
      for (const socket of byUser.get(userId) ?? []) {
        try {
          socket.send(message);
        } catch (err) {
          log.debug({ err }, 'live send failed');
        }
      }
    }
  }

  async function membersOf(clubIds: string[]): Promise<{ clubId: string; userId: string }[]> {
    if (clubIds.length === 0) return [];
    return db.select({ clubId: clubMember.clubId, userId: clubMember.userId }).from(clubMember).where(inArray(clubMember.clubId, clubIds));
  }

  return {
    add(userId: string, socket: Socket) {
      const sockets = byUser.get(userId) ?? new Set();
      sockets.add(socket);
      byUser.set(userId, sockets);
    },

    remove(userId: string, socket: Socket) {
      const sockets = byUser.get(userId);
      sockets?.delete(socket);
      if (sockets?.size === 0) byUser.delete(userId);
    },

    connectedUsers: () => byUser.size,

    /** A club changed: tell every member. */
    async clubChanged(clubId: string) {
      const members = await membersOf([clubId]);
      send(
        members.map((m) => m.userId),
        { type: 'club', clubId },
      );
    },

    /**
     * A reading changed: tell its reader's other devices, and the members of every club the reader is in
     * whose current book is this book.
     */
    async readingChanged(userId: string, bookKey: string) {
      send([userId], { type: 'readings' });
      const clubs = await db
        .select({ clubId: clubBook.clubId })
        .from(clubBook)
        .innerJoin(edition, eq(edition.id, clubBook.editionId))
        .innerJoin(clubMember, and(eq(clubMember.clubId, clubBook.clubId), eq(clubMember.userId, userId)))
        .where(
          and(
            eq(clubBook.status, 'current'),
            sql`case when ${edition.workKey} is not null then 'w:' || ${edition.workKey} else 'e:' || ${edition.id} end = ${bookKey}`,
          ),
        );
      const members = await membersOf(clubs.map((c) => c.clubId));
      for (const { clubId } of clubs) {
        send(
          members.filter((m) => m.clubId === clubId).map((m) => m.userId),
          { type: 'club-progress', clubId },
        );
      }
    },
  };
}

export type LiveHub = ReturnType<typeof createLiveHub>;

/** Accepts WebSocket upgrades on /api/live for signed-in users from our own origins. */
export function attachLive(
  server: Server | Http2Server | Http2SecureServer,
  { auth, hub, trustedOrigins, log }: { auth: Auth; hub: LiveHub; trustedOrigins: string[]; log: Logger },
) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  const reject = (socket: Duplex, status: string) => {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };

  (server as Server).on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    void (async () => {
      if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/api/live') return reject(socket, '404 Not Found');
      // Browsers send cookies with cross-site WebSocket requests: only our own pages may connect.
      const origin = req.headers.origin;
      if (origin && !trustedOrigins.includes(origin)) return reject(socket, '403 Forbidden');

      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(name, value);
        else if (Array.isArray(value)) headers.set(name, value.join(', '));
      }
      const session = await auth.api.getSession({ headers }).catch(() => null);
      if (!session) return reject(socket, '401 Unauthorized');

      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        const userId = session.user.id;
        hub.add(userId, ws);
        let alive = true;
        ws.on('pong', () => (alive = true));
        // Proxies drop idle connections; a ping every 25 s keeps it open and finds dead ones.
        const heartbeat = setInterval(() => {
          if (!alive) return ws.terminate();
          alive = false;
          ws.ping();
        }, 25_000);
        ws.on('close', () => {
          clearInterval(heartbeat);
          hub.remove(userId, ws);
        });
        ws.on('error', (err) => log.debug({ err }, 'live socket error'));
        // The app never sends anything; ignore whatever arrives.
        ws.on('message', () => {});
      });
    })().catch((err: unknown) => {
      log.error({ err }, 'live upgrade failed');
      reject(socket, '500 Internal Server Error');
    });
  });

  return wss;
}
