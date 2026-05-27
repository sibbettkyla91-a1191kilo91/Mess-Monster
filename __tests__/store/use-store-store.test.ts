import { useStoreStore } from '@/store/use-store-store';
import { StoreItem } from '@/store/store-items';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const repeatableItem: StoreItem = {
  id: 'food-cookie',
  name: 'Cookie',
  emoji: '🍪',
  category: 'food',
  description: 'Sweet and crunchy.',
  price: 15,
  moodBoost: 3,
  repeatable: true,
};

const oneTimeItem: StoreItem = {
  id: 'acc-crown',
  name: 'Mini Crown',
  emoji: '👑',
  category: 'accessories',
  description: 'Royalty status unlocked.',
  price: 100,
  moodBoost: 3,
  repeatable: false,
};

beforeEach(() => {
  useStoreStore.setState({ owned: {} });
});

// ─── buyItem ──────────────────────────────────────────────────────────────────

describe('buyItem', () => {
  it('returns true on success', () => {
    expect(useStoreStore.getState().buyItem(repeatableItem)).toBe(true);
  });

  it('adds the item with quantity 1 on first purchase', () => {
    useStoreStore.getState().buyItem(repeatableItem);
    const entry = useStoreStore.getState().owned[repeatableItem.id];
    expect(entry).toBeDefined();
    expect(entry.quantity).toBe(1);
    expect(entry.item).toEqual(repeatableItem);
  });

  it('increments quantity on repeat purchase of a repeatable item', () => {
    useStoreStore.getState().buyItem(repeatableItem);
    useStoreStore.getState().buyItem(repeatableItem);
    useStoreStore.getState().buyItem(repeatableItem);
    expect(useStoreStore.getState().owned[repeatableItem.id].quantity).toBe(3);
  });

  it('preserves purchasedAt timestamp on repeat buys', () => {
    useStoreStore.getState().buyItem(repeatableItem);
    const firstPurchasedAt = useStoreStore.getState().owned[repeatableItem.id].purchasedAt;
    useStoreStore.getState().buyItem(repeatableItem);
    expect(useStoreStore.getState().owned[repeatableItem.id].purchasedAt).toBe(firstPurchasedAt);
  });

  it('can buy multiple different items', () => {
    useStoreStore.getState().buyItem(repeatableItem);
    useStoreStore.getState().buyItem(oneTimeItem);
    expect(Object.keys(useStoreStore.getState().owned)).toHaveLength(2);
  });
});

// ─── isOwned ──────────────────────────────────────────────────────────────────

describe('isOwned', () => {
  it('returns false before any purchase', () => {
    expect(useStoreStore.getState().isOwned(repeatableItem.id)).toBe(false);
  });

  it('returns true after buying an item', () => {
    useStoreStore.getState().buyItem(repeatableItem);
    expect(useStoreStore.getState().isOwned(repeatableItem.id)).toBe(true);
  });

  it('returns false after consuming the last unit', () => {
    useStoreStore.getState().buyItem(repeatableItem);
    useStoreStore.getState().useItem(repeatableItem.id);
    expect(useStoreStore.getState().isOwned(repeatableItem.id)).toBe(false);
  });
});

// ─── useItem ──────────────────────────────────────────────────────────────────

describe('useItem', () => {
  it('returns false when the item is not owned', () => {
    expect(useStoreStore.getState().useItem('nonexistent-id')).toBe(false);
  });

  it('returns true and decrements quantity when owned', () => {
    useStoreStore.getState().buyItem(repeatableItem);
    useStoreStore.getState().buyItem(repeatableItem); // qty = 2
    const ok = useStoreStore.getState().useItem(repeatableItem.id);
    expect(ok).toBe(true);
    expect(useStoreStore.getState().owned[repeatableItem.id].quantity).toBe(1);
  });

  it('cannot consume more than owned quantity', () => {
    useStoreStore.getState().buyItem(repeatableItem); // qty = 1
    useStoreStore.getState().useItem(repeatableItem.id); // qty = 0
    const ok = useStoreStore.getState().useItem(repeatableItem.id); // should fail
    expect(ok).toBe(false);
  });
});

// ─── getOwnedItems ────────────────────────────────────────────────────────────

describe('getOwnedItems', () => {
  it('returns an empty array when nothing is owned', () => {
    expect(useStoreStore.getState().getOwnedItems()).toHaveLength(0);
  });

  it('returns entries for all owned items', () => {
    useStoreStore.getState().buyItem(repeatableItem);
    useStoreStore.getState().buyItem(oneTimeItem);
    expect(useStoreStore.getState().getOwnedItems()).toHaveLength(2);
  });

  it('excludes items whose quantity has dropped to zero', () => {
    useStoreStore.getState().buyItem(repeatableItem);
    useStoreStore.getState().useItem(repeatableItem.id); // qty → 0
    expect(useStoreStore.getState().getOwnedItems()).toHaveLength(0);
  });
});
