export interface OfferShape { title?: string; category?: string; description?: string }
export function isAllowedOffer(offer: OfferShape): boolean {
  const category = (offer.category ?? '').normalize('NFKC').toLowerCase();
  const title = (offer.title ?? '').normalize('NFKC').toLowerCase();
  if (/haustier|tierbedarf|tierheim|aquaristik|terraristik|pet supplies/.test(category)) return false;
  return !/\b(hund|hunde|katze|katzen|welpe|welpen|kätzchen|giraffe|papagei|schlange|schildkröte|zierfisch|zierfische|tierheim|katzenfutter|hundefutter|hundeleine|kratzbaum|aquarium|terrarium)\b/i.test(title);
}
export function filterAllowed<T extends OfferShape>(rows: T[]): T[] { return rows.filter(isAllowedOffer); }
