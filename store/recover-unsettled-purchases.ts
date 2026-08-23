import { StoreItem } from "./store-items";
import { UnsettledPurchase, useStoreStore } from "./use-store-store";
import { usePlayerStore } from "./use-player-store";
import { usePetStore } from "./use-pet-store";

/**
 * Shop purchase durability — separate from reward-grant recovery.
 *
 * A. Paid collectible: grant+intent (store) → charge (player) → clear.
 * B. Paid food: grant+intent → charge → consume (store) → care (pet) → clear.
 * C. Gifted food: not a purchase. consume+care only; never charged.
 * D. Grant durable / charge missing: keep item, do not charge, finish food
 *    consume/care if autoConsume, clear intent.
 * E. Charge durable / grant missing: grant once, do not charge again, finish
 *    food consume/care, clear.
 * F. Food consume/care incomplete: complete each receipt exactly once.
 *    Paid food remains discoverable from the player charge receipt even
 *    after store-side clear persisted, as long as pet care is missing.
 * G. Repeated recovery: receipts make every effect a no-op.
 *
 * Recovery never charges. Player-favoring grant-before-charge is preserved.
 * Non-repeatable items are re-checked at the transaction boundary so a
 * second attempt cannot charge after the first grant.
 */

function storesHydrated(): boolean {
  return (
    useStoreStore.persist.hasHydrated() &&
    usePlayerStore.persist.hasHydrated() &&
    usePetStore.persist.hasHydrated()
  );
}

let purchaseInFlight = false;

function applyOnePurchase(purchase: UnsettledPurchase): void {
  const store = useStoreStore.getState();
  const pet = usePetStore.getState();

  store.grantPurchase(purchase);

  if (purchase.autoConsume) {
    useStoreStore.getState().consumePurchase(purchase.id, purchase.itemId);
    pet.applyPurchaseCared(purchase.id);
  }

  useStoreStore.getState().clearUnsettledPurchase(purchase.id);
}

function purchasesToRecover(): UnsettledPurchase[] {
  const store = useStoreStore.getState();
  const player = usePlayerStore.getState();
  const pet = usePetStore.getState();
  const byId = new Map<string, UnsettledPurchase>();

  for (const purchase of store.unsettledPurchases ?? []) {
    byId.set(purchase.id, purchase);
  }

  for (const [id, receipt] of Object.entries(player.appliedPurchases ?? {})) {
    if (!receipt.charged) continue;
    const granted = !!store.appliedPurchases[id]?.granted;
    const cared = !!pet.appliedPurchases[id]?.cared;
    const needsGrant = !granted;
    const needsCare = receipt.autoConsume && !cared;
    if (!needsGrant && !needsCare) continue;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      itemId: receipt.itemId,
      price: receipt.price,
      autoConsume: receipt.autoConsume,
    });
  }

  return [...byId.values()];
}

export function recoverUnsettledPurchases(): void {
  if (!storesHydrated()) return;
  if (purchaseInFlight) return;
  for (const purchase of purchasesToRecover()) {
    applyOnePurchase(purchase);
  }
}

export function executePaidShopPurchase(item: StoreItem): boolean {
  if (!storesHydrated()) return false;
  if (purchaseInFlight) return false;
  purchaseInFlight = true;
  try {
    const purchase: UnsettledPurchase = {
      id: `${Date.now()}:${item.id}`,
      itemId: item.id,
      price: item.price,
      autoConsume: item.repeatable,
    };
    const store = useStoreStore.getState();
    const player = usePlayerStore.getState();
    const pet = usePetStore.getState();

    // Re-check live ownership here, not from a render closure. A second
    // tap after a non-repeatable grant must not create a new charge.
    if (!item.repeatable && store.isOwned(item.id)) {
      return false;
    }

    store.grantPurchase(purchase);
    player.chargePurchase(
      purchase.id,
      purchase.itemId,
      purchase.price,
      purchase.autoConsume,
    );
    if (purchase.autoConsume) {
      useStoreStore.getState().consumePurchase(purchase.id, purchase.itemId);
      pet.applyPurchaseCared(purchase.id);
    }
    useStoreStore.getState().clearUnsettledPurchase(purchase.id);
    return true;
  } finally {
    purchaseInFlight = false;
  }
}

export function subscribeUnsettledPurchaseRecovery(): () => void {
  const unsubs: Array<() => void> = [];
  let finished = false;

  const onReady = () => {
    if (finished) return;
    if (!storesHydrated()) return;
    finished = true;
    while (unsubs.length > 0) unsubs.pop()?.();
    recoverUnsettledPurchases();
  };

  if (!useStoreStore.persist.hasHydrated()) {
    unsubs.push(useStoreStore.persist.onFinishHydration(onReady));
  }
  if (!usePlayerStore.persist.hasHydrated()) {
    unsubs.push(usePlayerStore.persist.onFinishHydration(onReady));
  }
  if (!usePetStore.persist.hasHydrated()) {
    unsubs.push(usePetStore.persist.onFinishHydration(onReady));
  }

  onReady();

  return () => {
    finished = true;
    while (unsubs.length > 0) unsubs.pop()?.();
  };
}
