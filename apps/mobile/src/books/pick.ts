// What the book search is choosing a book *for*, carried as ?pick= through search → editions → edition:
//   club:<clubId>        the club's book (club admins)
//   club:<clubId>:setup  the same while setting up a new club (on to its next step afterwards)
//   read           a book to start reading
//   read:<clubId>  my edition of a club's book (back to the club afterwards)

export type Pick = { kind: 'club'; clubId: string; setup: boolean } | { kind: 'read'; clubId: string | null };

export function parsePick(value: string | undefined): Pick | null {
  if (!value) return null;
  if (value === 'read') return { kind: 'read', clubId: null };
  const [kind, clubId, flag] = value.split(':');
  if (kind === 'club' && clubId) return { kind: 'club', clubId, setup: flag === 'setup' };
  if (kind === 'read' && clubId) return { kind: 'read', clubId };
  return null;
}
