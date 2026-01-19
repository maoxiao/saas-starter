/**
 * New Credit System Types (Grant + Ledger Model)
 *
 * This file defines types and constants for the new credit system
 * based on industry best practices (Stripe Credits, Runway, etc.)
 */

// ============================================
// Grant Priority (Lower = Deducted First)
// ============================================

export const GRANT_PRIORITY = {
  SUBSCRIPTION: 10, // 订阅积分，最先扣（会过期）
  TOPUP: 20, // 充值积分，其次
  SIGNUP_BONUS: 30, // 注册赠送
  PROMO: 35, // 营销活动
  REFERRAL: 40, // 邀请奖励
  COMPENSATION: 45, // 客服补偿
  MANUAL: 48, // 手动调整
  LIFETIME: 50, // 终身计划积分（永不过期，最后扣）
  LEGACY: 60, // 迁移积分，最后
} as const;

export type GrantPriority =
  (typeof GRANT_PRIORITY)[keyof typeof GRANT_PRIORITY];

// ============================================
// Grant Type (Extensible without migration)
// ============================================

export const GRANT_TYPE = {
  SUBSCRIPTION: 'subscription', // 订阅赠送 (monthly refresh)
  LIFETIME: 'lifetime', // 终身计划赠送 (never expires)
  TOPUP: 'topup', // 一次性充值
  SIGNUP_BONUS: 'signup_bonus', // 注册赠送
  PROMO: 'promo', // 营销活动赠送
  REFERRAL: 'referral', // 邀请奖励
  COMPENSATION: 'compensation', // 客服补偿
  MANUAL: 'manual', // 手动调整
  LEGACY: 'legacy', // 迁移积分
} as const;

export type GrantType = (typeof GRANT_TYPE)[keyof typeof GRANT_TYPE];

// ============================================
// Log Action Types
// ============================================

export const LOG_ACTION = {
  GRANTED: 'granted', // 积分发放
  CONSUMED: 'consumed', // 积分消耗
  EXPIRED: 'expired', // 积分过期
  REFUNDED: 'refunded', // 积分退款
  HELD: 'held', // 积分冻结（预扣）
  RELEASED: 'released', // 积分释放
  REVOKED: 'revoked', // 积分撤销（退款作废）
} as const;

export type LogAction = (typeof LOG_ACTION)[keyof typeof LOG_ACTION];

// ============================================
// Type Definitions
// ============================================

export interface CreateGrantParams {
  userId: string;
  type: GrantType;
  amount: number;
  priority?: number;
  expiresAt?: Date | null;
  effectiveAt?: Date;
  sourceRef?: string;
}

export interface DeductCreditsParams {
  userId: string;
  amount: number;
  eventId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface HoldCreditsParams {
  userId: string;
  amount: number;
  eventId: string;
  reason?: string;
}

export interface ReleaseCreditsParams {
  userId: string;
  eventId: string;
}

export interface RevokeGrantParams {
  grantId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundCreditsParams {
  userId: string;
  originalEventId: string; // eventId of the CONSUMED transaction to refund
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface BalanceBreakdown {
  total: number;
  subscription: {
    balance: number;
    expiresAt: Date | null;
  };
  lifetime: {
    balance: number;
    expiresAt: null;
  };
  topup: {
    balance: number; // Total topup balance
    expiringBalance: number; // Balance that will expire
    expiresAt: Date | null; // Earliest expiration (for expiringBalance)
    nonExpiringBalance: number; // Balance that never expires
  };
  other: {
    balance: number;
  };
}

export interface SpentThisPeriod {
  subscriptionSpent: number;
  lifetimeSpent: number;
  topupSpent: number;
  totalSpent: number;
  periodStart: Date;
  periodEnd: Date;
}
