import { isDraftEmpty, withDraft, type ListingDraft } from '../../drafts';

const empty: ListingDraft = {
  imageUris: [],
  title: '',
  description: '',
  category: null,
  events: [],
  size: null,
  brand: '',
  measurements: '',
  fitNote: '',
  pickupSpots: [],
  price: '',
  salePrice: '',
  offer: 'Rent',
};

describe('isDraftEmpty', () => {
  it('treats an untouched form as empty, even with a listing type picked', () => {
    expect(isDraftEmpty(empty)).toBe(true);
    expect(isDraftEmpty({ ...empty, offer: 'Buy only', title: '   ' })).toBe(true);
  });

  it('keeps anything typed or picked', () => {
    expect(isDraftEmpty({ ...empty, title: 'Black dress' })).toBe(false);
    expect(isDraftEmpty({ ...empty, imageUris: ['file:///a.jpg'] })).toBe(false);
    expect(isDraftEmpty({ ...empty, size: 'M' })).toBe(false);
  });
});

describe('withDraft', () => {
  const saved = (id: string, title: string) => ({ ...empty, id, title, updatedAt: '' });

  it('keeps several drafts, the one just edited first', () => {
    const drafts = [saved('a', 'Dress'), saved('b', 'Boots')];
    expect(withDraft(drafts, saved('b', 'Cowboy boots')).map((draft) => draft.title)).toEqual([
      'Cowboy boots',
      'Dress',
    ]);
    expect(withDraft(drafts, saved('c', 'Bag'))).toHaveLength(3);
  });

  it('drops a draft once it is emptied', () => {
    expect(withDraft([saved('a', 'Dress')], saved('a', ''))).toEqual([]);
  });
});
