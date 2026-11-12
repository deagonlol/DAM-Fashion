import { isDraftEmpty, type ListingDraft } from '../../drafts';

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
