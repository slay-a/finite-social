// Switches a book's card depth (concise <-> detailed) and clears its generated
// cards so each section regenerates on next visit. No re-upload, no re-parse:
// the extracted pages and the outline stay.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyUser, json, corsHeaders } from '../_shared/userAuth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await verifyUser(req);
  if (auth instanceof Response) return auth;

  const { book_id, card_mode } = await req.json().catch(() => ({}));
  if (!book_id) return json({ error: 'book_id required' }, 400);
  if (!['concise', 'detailed'].includes(card_mode)) return json({ error: 'card_mode must be concise or detailed' }, 400);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: book, error } = await sb.from('books').select('id, owner_id').eq('id', book_id).single();
  if (error || !book) return json({ error: 'Book not found' }, 404);
  if (book.owner_id !== auth.userId) return json({ error: 'Not your book' }, 403);

  await sb.from('books').update({ card_mode }).eq('id', book_id);

  const { data: sections } = await sb.from('book_sections').select('id').eq('book_id', book_id);
  const sectionIds = (sections ?? []).map((s) => s.id);
  if (sectionIds.length > 0) {
    await sb.from('section_cards').delete().in('section_id', sectionIds);
    await sb.from('book_sections').update({ card_status: 'none' }).eq('book_id', book_id);
    // Positions no longer map onto the new cards.
    await sb.from('reading_progress').delete().in('section_id', sectionIds);
  }

  return json({ ok: true, sections_reset: sectionIds.length });
});
