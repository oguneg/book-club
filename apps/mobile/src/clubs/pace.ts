import { pageToPosition, type ClubDetail } from '@bookclub/shared';

type Book = NonNullable<ClubDetail['currentBook']>;

/** The club's schedule as a pace plan: start date, meeting targets ("read to p. N"), finish date. */
export function pacePlan(book: Book) {
  const range = { startPage: 1, endPage: book.edition.pageCount ?? 1 };
  return {
    startDate: book.startDate,
    finishDate: book.finishDate,
    checkpoints: book.meetings
      .filter((m) => m.readToPage !== null)
      .map((m) => ({ at: m.startsAt, position: pageToPosition(m.readToPage!, range) })),
  };
}
