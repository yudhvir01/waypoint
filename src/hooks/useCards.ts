import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "../context/BackendProvider";
import type { CardSchedule } from "../lib/backend/types";
import { extractCards } from "../lib/cards";

export function useCards() {
  const { backend } = useBackend();

  return useQuery({
    queryKey: ["cards"],
    enabled: !!backend,
    staleTime: 30_000,
    // Without the cards table (an older Supabase project that hasn't re-run
    // setup.sql) this fails; once is enough to know.
    retry: false,
    queryFn: () => backend!.listCards(),
  });
}

export function useReviewCard() {
  const { backend } = useBackend();

  return useMutation({
    mutationFn: ({ id, schedule }: { id: string; schedule: CardSchedule }) =>
      backend!.reviewCard(id, schedule),
  });
}

// Notes written before cards existed (or imported) have question :: answer
// lines but no cards yet, because cards are made when a note is saved.
// This reads every note once and makes the cards.
export function useScanNotes() {
  const { backend } = useBackend();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ notes: number; cards: number }> => {
      const snap = await backend!.snapshot({ notes: true });
      let notes = 0;
      let cards = 0;
      for (const note of snap.notes) {
        const wanted = extractCards(note.content);
        if (wanted.length === 0) continue;
        await backend!.syncNoteCards(note.id, wanted);
        notes++;
        cards += wanted.length;
      }
      return { notes, cards };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cards"] }),
  });
}
