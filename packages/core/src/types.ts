export type AccountStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';
export type MemberRole = 'owner' | 'admin';
export type BotPlatform = 'telegram' | 'discord';
export type BindKind = 'payments' | 'admin' | 'tickets' | 'general';

export interface Account {
  id: string;
  slug: string;
  name: string;
  status: AccountStatus;
  package_id: string | null;
  timezone: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: Date | null;
  suspended_at: Date | null;
  telegram_enabled: boolean;
  discord_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Package {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  interval: string;
  stripe_price_id: string | null;
  features: Record<string, unknown>;
  sort_order: number;
  active: boolean;
}

export interface AccountMember {
  id: string;
  account_id: string;
  email: string;
  display_name: string | null;
  role: MemberRole;
  telegram_user_id: string | null;
  discord_user_id: string | null;
  accepted_at: Date | null;
  created_at: Date;
}

export interface ChatBinding {
  id: string;
  account_id: string;
  platform: BotPlatform;
  chat_id: string;
  kind: BindKind;
  title: string | null;
  created_at: Date;
}

/** An account is allowed to serve players only while it is paid up. */
export function isServiceable(status: AccountStatus): boolean {
  return status === 'active' || status === 'trialing';
}

/** Serviceable AND the operator has this specific bot switched on for the club. */
export function botEnabled(account: Account, platform: BotPlatform): boolean {
  if (!isServiceable(account.status)) return false;
  return platform === 'telegram' ? account.telegram_enabled : account.discord_enabled;
}
