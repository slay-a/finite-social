import { useCallback, useEffect, useRef, useState } from 'react';
import { Book, BookCardMode } from '../types';
import { fetchBooks, pickPdf, processBook, uploadBook } from '../lib/booksApi';

export interface UploadState {
  phase: 'idle' | 'uploading' | 'parsing' | 'error';
  progress: number; // 0..1 while parsing
  error: string | null;
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [upload, setUpload] = useState<UploadState>({ phase: 'idle', progress: 0, error: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const reload = useCallback(async () => {
    try {
      const data = await fetchBooks();
      if (mountedRef.current) setBooks(data);
    } catch {
      // keep whatever we had
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const startUpload = useCallback(async (cardMode: BookCardMode) => {
    const picked = await pickPdf();
    if (!picked) return;

    setUpload({ phase: 'uploading', progress: 0, error: null });
    try {
      const book = await uploadBook(picked, cardMode);
      setUpload({ phase: 'parsing', progress: 0, error: null });
      await reload();

      const result = await processBook(book.id, (done, total) => {
        if (mountedRef.current && total > 0) {
          setUpload({ phase: 'parsing', progress: done / total, error: null });
        }
      });

      if (!result.ok) {
        setUpload({ phase: 'error', progress: 0, error: result.error ?? 'Processing failed' });
      } else {
        setUpload({ phase: 'idle', progress: 0, error: null });
      }
    } catch (e) {
      setUpload({
        phase: 'error',
        progress: 0,
        error: e instanceof Error ? e.message : 'Upload failed',
      });
    }
    await reload();
  }, [reload]);

  const dismissError = useCallback(
    () => setUpload({ phase: 'idle', progress: 0, error: null }),
    [],
  );

  return { books, isLoading, upload, startUpload, reload, dismissError };
}
