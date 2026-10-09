// What the book search is choosing a book *for*, carried as ?pick= through search → editions → edition:
//   club:<clubId>  the club's book (club admins)
//   read           a book to start reading
//   read:<clubId>  my edition of a club's book (back to the club afterwards)

export type Pick = { kind: 'club'; clubId: string } | { kind: 'read'; clubId: string | null };

export function parsePick(value: string | undefined): Pick | null {
  if (!value) return null;
  if (value === 'read') return { kind: 'read', clubId: null };
  const [kind, clubId] = value.split(':');
  if (kind === 'club' && clubId) return { kind: 'club', clubId };
  if (kind === 'read' && clubId) return { kind: 'read', clubId };
  return null;
}
