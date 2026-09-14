import { resolveMonsterId } from "./monster-id";
import { StoreItem } from "./store-items";
import {
  assignLegacyInventoryToSelectedMonster,
  UnsettledPurchase,
  useStoreStore,
} from "./use-store-store";
import { usePlayerStore } from "./use-player-store";
import { assignLegacyPetToSelectedMonster, usePetStore } from "./use-pet-store";

/**
 * Shop purchase durability — separate from reward-grant recovery.
 *
 * A. Paid collectible: grant+intent (store) → charge (player) → clear.
 * B. Paid food: grant+intent → charge → clear. Food stays in the selected
 *    monster's bag. Purchase does NOT consume or care.
 * C. Gifted food: not a purchase. Stashed in the bag; never charged or cared.
 * D. Grant durable / charge missing: keep item, do not charge, clear intent.
 * E. Charge durable / grant missing: grant once to the receipt's monster
 *    (or the selected monster), do not charge again, clear.
 * F. Old autoConsume food mid-recovery: do not consume or care. If the
 *    purchase already charged but the snack is still in the bag, it stays
 *    there. If an older build already consumed the snack before care, that
 *    unit is gone and we do not apply the old purchase-care boost.
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
  store.grantPurchase(purchase);
  // Food is inventory now. Never consume or care at purchase time,
  // including leftover autoConsume intents from older builds.
  useStoreStore.getState().clearUnsettledPurchase(purchase.id);
}

function purchasesToRecover(): UnsettledPurchase[] {
  const store = useStoreStore.getState();
  const player = usePlayerStore.getState();
  const byId = new Map<string, UnsettledPurchase>();

  for (const purchase of store.unsettledPurchases ?? []) {
    byId.set(purchase.id, purchase);
  }

  for (const [id, receipt] of Object.entries(player.appliedPurchases ?? {})) {
    if (!receipt.charged) continue;
    const granted = !!store.appliedPurchases[id]?.granted;
    if (granted) continue;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      itemId: receipt.itemId,
      price: receipt.price,
      autoConsume: false,
      monsterId: resolveMonsterId(receipt.monsterId ?? player.selectedMonster),
    });
  }

  return [...byId.values()];
}

export function recoverUnsettledPurchases(): void {
  if (!storesHydrated()) return;
  assignLegacyPetToSelectedMonster();
  assignLegacyInventoryToSelectedMonster();
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
    const monsterId = resolveMonsterId(
      usePlayerStore.getState().selectedMonster,
    );
    const purchase: UnsettledPurchase = {
      id: `${Date.now()}:${item.id}`,
      itemId: item.id,
      price: item.price,
      autoConsume: false,
      monsterId,
    };
    const store = useStoreStore.getState();
    const player = usePlayerStore.getState();

    // Re-check live ownership here, not from a render closure. A second
    // tap after a non-repeatable grant must not create a new charge.
    if (!item.repeatable && store.isOwned(item.id, monsterId)) {
      return false;
    }

    store.grantPurchase(purchase);
    player.chargePurchase(
      purchase.id,
      purchase.itemId,
      purchase.price,
      false,
      monsterId,
    );
    useStoreStore.getState().clearUnsettledPurchase(purchase.id);
    return true;
  } finally {
    purchaseInFlight = false;
  }
}

export function subscribeUnsettledPurchaseRecovery(): () => void {
  const unsubs: (() => void)[] = [];
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
