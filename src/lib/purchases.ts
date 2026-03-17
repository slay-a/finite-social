/**
 * RevenueCat purchase abstraction.
 *
 * Setup checklist:
 *   1. npx expo install react-native-purchases  ← already done
 *   2. eas build (Expo Go won't run native modules)
 *   3. Add keys to .env.local:
 *        EXPO_PUBLIC_RC_API_KEY_IOS=appl_xxxxx
 *        EXPO_PUBLIC_RC_API_KEY_ANDROID=goog_xxxxx
 *   4. In RevenueCat dashboard:
 *        - Create entitlement: "pro"
 *        - Create two products: monthly ($2.99) + annual ($21.99)
 *        - Attach both products to the "pro" entitlement
 */

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

// ─── Constants ────────────────────────────────────────────────────────────────

export const FREE_FEED_LIMIT = 15;   // articles per day
export const FREE_CODE_LIMIT = 5;    // LeetCode cards per day

export const PRO_MONTHLY_PRICE = '$2.99/mo';
export const PRO_ANNUAL_PRICE  = '$21.99/yr';

const RC_KEY_IOS     = process.env.EXPO_PUBLIC_RC_API_KEY_IOS     ?? '';
const RC_KEY_ANDROID = process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID ?? '';

const isConfigured = () =>
  Platform.OS === 'ios'     ? RC_KEY_IOS.startsWith('appl_') :
  Platform.OS === 'android' ? RC_KEY_ANDROID.startsWith('goog_') :
  false;

// ─── Init — call once on app start after user is known ───────────────────────

export function initPurchases(userId: string) {
  if (!isConfigured()) return;

  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);

  Purchases.configure({
    apiKey: Platform.OS === 'ios' ? RC_KEY_IOS : RC_KEY_ANDROID,
    appUserID: userId,
  });
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

export async function purchasePro(
  plan: 'monthly' | 'annual' = 'annual'
): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured()) {
    return { success: false, error: 'PURCHASES_NOT_CONFIGURED' };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;

    if (!current) {
      return { success: false, error: 'No offerings available. Try again later.' };
    }

    // Find the right package — monthly or annual
    const pkg: PurchasesPackage | undefined =
      plan === 'annual'
        ? current.annual ?? current.availablePackages.find((p) => p.packageType === 'ANNUAL')
        : current.monthly ?? current.availablePackages.find((p) => p.packageType === 'MONTHLY');

    if (!pkg) {
      // Fall back to first available package
      const fallback = current.availablePackages[0];
      if (!fallback) return { success: false, error: 'No packages available.' };
      const { customerInfo } = await Purchases.purchasePackage(fallback);
      const pro = customerInfo.entitlements.active['pro'] !== undefined;
      return { success: pro };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const pro = customerInfo.entitlements.active['pro'] !== undefined;
    return { success: pro };
  } catch (e: any) {
    if (e.userCancelled) return { success: false };
    return { success: false, error: e.message ?? 'Purchase failed.' };
  }
}

// ─── Restore ──────────────────────────────────────────────────────────────────

export async function restorePurchases(): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
  }
}

// ─── Status check ─────────────────────────────────────────────────────────────

export async function checkProStatus(): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
  }
}
