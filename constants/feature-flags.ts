/**
 * Feature flags — flip these in one place. Do not scatter copies.
 *
 * FOUNDING_MEMBER_PURCHASE_ENABLED
 *   Real-money Founding Member checkout. Keep this false until Apple/Google
 *   billing is actually wired. While false, the perk modal and copy stay
 *   visible, but the button reads "Coming soon" and cannot grant premium.
 */
export const FOUNDING_MEMBER_PURCHASE_ENABLED = false;
