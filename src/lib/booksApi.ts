import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Book, BookCardMode, BookSection, SectionCardData } from '../types';
import { getSupabase } from './supabase';

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToBook(r: any): Book {
  return {
    id: r.id,
    title: r.title,
    author: r.author ?? null,
    cardMode: r.card_mode === 'detailed' ? 'detailed' : 'concise',
    fileType: 'pdf',
    pageCount: r.page_count ?? null,
    status: r.status,
    parseProgress: r.parse_progress ?? 0,
    parseError: r.parse_error ?? null,
    createdAt: r.created_at,
  };
}

function rowToSection(r: any): BookSection {
  return {
    id: r.id,
    bookId: r.book_id,
    parentId: r.parent_id ?? null,
    depth: r.depth,
    orderIndex: r.order_index,
    label: r.label ?? null,
    title: r.title,
    pageStart: r.page_start,
    pageEnd: r.page_end,
    cardStatus: r.card_status,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function fetchBooks(): Promise<Book[]> {
  const { data, error } = await getSupabase()
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToBook);
}

export async function fetchBook(bookId: string): Promise<Book | null> {
  const { data, error } = await getSupabase()
    .from('books').select('*').eq('id', bookId).single();
  if (error) return null;
  return rowToBook(data);
}

export async function fetchSections(bookId: string): Promise<BookSection[]> {
  const { data, error } = await getSupabase()
    .from('book_sections')
    .select('*')
    .eq('book_id', bookId)
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSection);
}

export async function fetchSection(sectionId: string): Promise<BookSection | null> {
  const { data, error } = await getSupabase()
    .from('book_sections').select('*').eq('id', sectionId).single();
  if (error) return null;
  return rowToSection(data);
}

export async function fetchSectionCards(sectionId: string): Promise<SectionCardData[]> {
  const { data, error } = await getSupabase()
    .from('section_cards')
    .select('id, section_id, order_index, title, body, visual')
    .eq('section_id', sectionId)
    .order('order_index');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    sectionId: r.section_id,
    orderIndex: r.order_index,
    title: r.title,
    body: r.body,
    visual: r.visual ?? null,
  }));
}

export async function deleteBook(bookId: string): Promise<void> {
  const { error } = await getSupabase().from('books').delete().eq('id', bookId);
  if (error) throw new Error(error.message);
}

// ─── Reading progress ─────────────────────────────────────────────────────────

export async function fetchProgress(sectionIds: string[]): Promise<Map<string, { lastCardIndex: number; completed: boolean }>> {
  if (sectionIds.length === 0) return new Map();
  const { data } = await getSupabase()
    .from('reading_progress')
    .select('section_id, last_card_index, completed')
    .in('section_id', sectionIds);
  return new Map(
    (data ?? []).map((r: any) => [r.section_id, { lastCardIndex: r.last_card_index, completed: r.completed }]),
  );
}

export async function saveProgress(sectionId: string, lastCardIndex: number, completed: boolean): Promise<void> {
  const sb = getSupabase();
  const userId = (await sb.auth.getUser()).data.user?.id;
  if (!userId) return;
  await sb.from('reading_progress').upsert({
    owner_id: userId,
    section_id: sectionId,
    last_card_index: lastCardIndex,
    completed,
    updated_at: new Date().toISOString(),
  });
}

// ─── Upload + processing ──────────────────────────────────────────────────────

export interface PickedPdf {
  name: string;
  uri: string;
  size: number | null;
}

export async function pickPdf(): Promise<PickedPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { name: asset.name, uri: asset.uri, size: asset.size ?? null };
}

export async function uploadBook(picked: PickedPdf, cardMode: BookCardMode): Promise<Book> {
  const sb = getSupabase();
  const userId = (await sb.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not signed in');

  const title = picked.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';

  const { data: bookRow, error: insertError } = await sb
    .from('books')
    .insert({ title, file_size_bytes: picked.size, file_path: '', card_mode: cardMode })
    .select('*')
    .single();
  if (insertError) throw new Error(insertError.message);

  const filePath = `${userId}/${bookRow.id}.pdf`;
  const bytes = await new File(picked.uri).bytes();

  const { error: uploadError } = await sb.storage
    .from('books')
    .upload(filePath, bytes, { contentType: 'application/pdf', upsert: true });
  if (uploadError) {
    await sb.from('books').delete().eq('id', bookRow.id);
    throw new Error(uploadError.message);
  }

  const { data: updated, error: updateError } = await sb
    .from('books')
    .update({ file_path: filePath })
    .eq('id', bookRow.id)
    .select('*')
    .single();
  if (updateError) throw new Error(updateError.message);
  return rowToBook(updated);
}

interface ProcessResponse {
  done: boolean;
  failed?: boolean;
  progress?: number;
  total?: number;
  error?: string;
}

/**
 * Drives the chunked server-side parse: process-book extracts ~50 pages per
 * invocation, so we keep re-invoking until it reports done.
 */
export async function processBook(
  bookId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  for (let i = 0; i < 100; i++) {
    const { data, error } = await sb.functions.invoke<ProcessResponse>('process-book', {
      body: { book_id: bookId },
    });
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'empty response' };
    if (data.failed) return { ok: false, error: data.error ?? 'processing failed' };
    if (data.progress != null && data.total != null) onProgress?.(data.progress, data.total);
    if (data.done) return { ok: true };
  }
  return { ok: false, error: 'processing took too long' };
}

export async function generateSectionCards(
  sectionId: string,
): Promise<'ready' | 'generating' | 'failed'> {
  const { data, error } = await getSupabase().functions.invoke<{ status: string; error?: string }>(
    'generate-section-cards',
    { body: { section_id: sectionId } },
  );
  if (error || !data) return 'failed';
  if (data.status === 'ready') return 'ready';
  if (data.status === 'generating') return 'generating';
  return 'failed';
}
