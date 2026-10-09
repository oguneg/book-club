import { MAX_PAGE_COUNT, normalizeIsbn, type ManualEditionInput } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createManualEdition } from '@/api/books';
import { bookErrorMessage } from '@/books/errors';
import { FormLayout } from '@/components/FormLayout';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { TextField } from '@/components/ui/TextField';
import { TextLink } from '@/components/ui/TextLink';

type Field = 'title' | 'authors' | 'pageCount' | 'isbn';

export default function AddBookByHand() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ title?: string; authors?: string; isbn?: string; workKey?: string; pick?: string }>();
  const [title, setTitle] = useState(params.title ?? '');
  const [authors, setAuthors] = useState(params.authors ?? '');
  const [pages, setPages] = useState('');
  const [publisher, setPublisher] = useState('');
  const [year, setYear] = useState('');
  const [isbn, setIsbn] = useState(params.isbn ?? '');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    const authorList = authors.split(',').map((a) => a.trim()).filter(Boolean);
    const pageCount = Number(pages);
    const next: Partial<Record<Field, string>> = {};
    if (!title.trim()) next.title = t('books.manual.required');
    if (authorList.length === 0) next.authors = t('books.manual.required');
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_PAGE_COUNT) next.pageCount = t('books.manual.pagesInvalid');
    if (isbn.trim() && !normalizeIsbn(isbn)) next.isbn = t('books.isbnInvalid');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: ManualEditionInput = {
      title: title.trim(),
      authors: authorList,
      pageCount,
      ...(publisher.trim() ? { publisher: publisher.trim() } : {}),
      ...(year.trim() ? { published: year.trim() } : {}),
      ...(isbn.trim() ? { isbn: isbn.trim() } : {}),
      ...(params.workKey ? { workKey: params.workKey } : {}),
    };
    setBusy(true);
    setError(undefined);
    try {
      const edition = await createManualEdition(input);
      router.replace({ pathname: '/books/edition/[id]', params: { id: edition.id, ...(params.pick ? { pick: params.pick } : {}) } });
    } catch (err) {
      setError(bookErrorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <FormLayout title={t('books.manual.title')} subtitle={t('books.manual.subtitle')}>
      {error && <Notice message={error} />}
      <TextField label={t('books.manual.bookTitle')} value={title} onChangeText={setTitle} error={errors.title} maxLength={300} />
      <TextField
        label={t('books.manual.authors')}
        hint={t('books.manual.authorsHint')}
        value={authors}
        onChangeText={setAuthors}
        error={errors.authors}
        autoCapitalize="words"
      />
      <TextField
        label={t('books.manual.pageCount')}
        hint={t('books.manual.pageCountHint')}
        value={pages}
        onChangeText={(v) => setPages(v.replace(/\D/g, ''))}
        error={errors.pageCount}
        inputMode="numeric"
        maxLength={5}
      />
      <TextField label={t('books.manual.publisher')} value={publisher} onChangeText={setPublisher} maxLength={200} />
      <TextField label={t('books.manual.year')} value={year} onChangeText={setYear} inputMode="numeric" maxLength={40} />
      <TextField label={t('books.manual.isbn')} value={isbn} onChangeText={setIsbn} error={errors.isbn} inputMode="numeric" maxLength={20} />
      <Button label={t('books.manual.submit')} onPress={submit} loading={busy} />
      <TextLink href={{ pathname: '/books', params: params.pick ? { pick: params.pick } : {} }} label={t('books.title')} />
    </FormLayout>
  );
}
