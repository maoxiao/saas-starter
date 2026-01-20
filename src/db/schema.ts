import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, index, unique } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	normalizedEmail: text('normalized_email').unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
	role: text('role'),
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires', { withTimezone: true }),
	customerId: text('customer_id'),
}, (table) => ({
	userIdIdx: index("user_id_idx").on(table.id),
	userCustomerIdIdx: index("user_customer_id_idx").on(table.customerId),
	userRoleIdx: index("user_role_idx").on(table.role),
}));

// User attribution tracking for first-touch and last-touch data
export const userAttribution = pgTable("user_attribution", {
	id: text("id").primaryKey(),
	visitorId: text("visitor_id").notNull().unique(), // Anonymous visitor ID from localStorage
	userId: text("user_id").references(() => user.id, { onDelete: 'cascade' }),

	// First Touch (set once, never updated)
	firstTouchSource: text("first_touch_source"),
	firstTouchMedium: text("first_touch_medium"),
	firstTouchCampaign: text("first_touch_campaign"),
	landingPage: text("landing_page"),
	referrer: text("referrer"),
	firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),

	// Last Touch (updated on each visit with UTM params)
	lastTouchSource: text("last_touch_source"),
	lastTouchMedium: text("last_touch_medium"),
	lastTouchCampaign: text("last_touch_campaign"),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),

	// Registration Session Attribution (set once when user registers)
	regPage: text("reg_page"), // Landing page of registration session
	regRef: text("reg_ref"), // Referrer of registration session
	regSource: text("reg_source"), // UTM source of registration session
	regMedium: text("reg_medium"), // UTM medium of registration session
	regCampaign: text("reg_campaign"), // UTM campaign of registration session

	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
	userAttributionVisitorIdIdx: index("user_attribution_visitor_id_idx").on(table.visitorId),
	userAttributionUserIdIdx: index("user_attribution_user_id_idx").on(table.userId),
}));

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	impersonatedBy: text('impersonated_by')
}, (table) => ({
	sessionTokenIdx: index("session_token_idx").on(table.token),
	sessionUserIdIdx: index("session_user_id_idx").on(table.userId),
}));

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
}, (table) => ({
	accountUserIdIdx: index("account_user_id_idx").on(table.userId),
	accountAccountIdIdx: index("account_account_id_idx").on(table.accountId),
	accountProviderIdIdx: index("account_provider_id_idx").on(table.providerId),
}));

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }),
	updatedAt: timestamp('updated_at', { withTimezone: true })
});

export const payment = pgTable("payment", {
	id: text("id").primaryKey(),
	priceId: text('price_id').notNull(),
	type: text('type').notNull(),
	purchaseType: text('purchase_type'), // purchase type: 'lifetime', 'credit', 'subscription'
	interval: text('interval'),
	userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	customerId: text('customer_id').notNull(),
	subscriptionId: text('subscription_id'),
	sessionId: text('session_id'),
	invoiceId: text('invoice_id').unique(), // unique constraint for avoiding duplicate processing
	status: text('status').notNull(),
	paid: boolean('paid').notNull().default(false), // indicates whether payment is completed (set in invoice.paid event)
	periodStart: timestamp('period_start', { withTimezone: true }),
	periodEnd: timestamp('period_end', { withTimezone: true }),
	cancelAtPeriodEnd: boolean('cancel_at_period_end'),
	trialStart: timestamp('trial_start', { withTimezone: true }),
	trialEnd: timestamp('trial_end', { withTimezone: true }),
	// Session attribution at conversion time (captures the session that led to payment)
	sessionLandingPage: text('session_landing_page'), // First page user visited in this checkout session
	sessionReferrer: text('session_referrer'), // External referrer for this checkout session
	sessionSource: text('session_source'), // UTM source for this checkout session
	sessionMedium: text('session_medium'), // UTM medium for this checkout session
	sessionCampaign: text('session_campaign'), // UTM campaign for this checkout session
	// Amount
	amount: integer('amount'), // in cents
	currency: text('currency'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
	paymentTypeIdx: index("payment_type_idx").on(table.type),
	paymentPurchaseTypeIdx: index("payment_purchase_type_idx").on(table.purchaseType),
	paymentPriceIdIdx: index("payment_price_id_idx").on(table.priceId),
	paymentUserIdIdx: index("payment_user_id_idx").on(table.userId),
	// Covering index for monthly grant cron: supports ROW_NUMBER() + WHERE filtering without table lookups
	// Includes all fields needed: userId (partition), createdAt (order), status/paid (filter), priceId (select)
	paymentUserIdCreatedAtIdx: index("payment_user_id_created_at_idx").on(table.userId, table.createdAt, table.status, table.paid, table.priceId),
	paymentCustomerIdIdx: index("payment_customer_id_idx").on(table.customerId),
	paymentStatusIdx: index("payment_status_idx").on(table.status),
	paymentPaidIdx: index("payment_paid_idx").on(table.paid),
	paymentSubscriptionIdIdx: index("payment_subscription_id_idx").on(table.subscriptionId),
	paymentSessionIdIdx: index("payment_session_id_idx").on(table.sessionId),
	paymentInvoiceIdIdx: index("payment_invoice_id_idx").on(table.invoiceId),
}));

export const userCredit = pgTable("user_credit", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	currentCredits: integer("current_credits").notNull().default(0),
	lastRefreshAt: timestamp("last_refresh_at", { withTimezone: true }), // deprecated
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
	userCreditUserIdIdx: index("user_credit_user_id_idx").on(table.userId),
}));

export const creditTransaction = pgTable("credit_transaction", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	type: text("type").notNull(),
	description: text("description"),
	amount: integer("amount").notNull(),
	balance: integer("balance"), // remaining credit amount
	paymentId: text("payment_id"), // field name is paymentId, but actually it's invoiceId
	expirationDate: timestamp("expiration_date", { withTimezone: true }),
	expiredAt: timestamp("expired_at", { withTimezone: true }), // timestamp when expiration was processed
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
	creditTransactionUserIdIdx: index("credit_transaction_user_id_idx").on(table.userId),
	creditTransactionTypeIdx: index("credit_transaction_type_idx").on(table.type),
}));

// ============================================
// NEW CREDIT SYSTEM (Grant + Ledger Model)
// ============================================

/**
 * Credit Grant (积分批次表)
 * Each credit issuance (subscription, top-up, bonus, etc.) creates a separate grant.
 * Used for priority-based waterfall deduction.
 */
export const creditGrant = pgTable("credit_grant", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),

	// Grant type: 'subscription' | 'topup' | 'signup_bonus' | 'promo' | 'referral' | 'compensation' | 'manual' | 'legacy'
	type: text("type").notNull(),

	// Credit amounts
	amount: integer("amount").notNull(),     // Original grant amount
	balance: integer("balance").notNull(),   // Remaining balance (decreases as credits are consumed)

	// Priority & expiration (for waterfall deduction)
	priority: integer("priority").notNull().default(100), // Lower number = deducted first (e.g., subscription=10, topup=20)
	expiresAt: timestamp("expires_at", { withTimezone: true }),      // Expiration time (subscription=period_end, topup=null for never)

	// Effective time (for delayed activation scenarios like pre-sales)
	// Default: same as createdAt (immediate activation)
	// Use case: pre-sale credits that activate next month, scheduled promotions, etc.
	effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),

	// Source reference for audit trail (UNIQUE to prevent duplicate grants from webhook retries)
	sourceRef: text("source_ref").unique(), // Stripe subscription_id, invoice_id, checkout_session_id, etc.

	isActive: boolean("is_active").notNull().default(true),

	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
	creditGrantUserIdIdx: index("credit_grant_user_id_idx").on(table.userId),
	creditGrantTypeIdx: index("credit_grant_type_idx").on(table.type),
	creditGrantExpiresAtIdx: index("credit_grant_expires_at_idx").on(table.expiresAt),
	creditGrantPriorityIdx: index("credit_grant_priority_idx").on(table.priority),
	// Partial index for expiration job: only index active grants with positive balance
	creditGrantExpirationIdx: index("credit_grant_expiration_idx").on(table.expiresAt).where(sql`is_active = true AND balance > 0`),
}));

/**
 * Credit Log (流水审计表)
 * Immutable append-only ledger for all credit changes.
 * Each grant/consume/expire/refund operation creates a log entry.
 */
export const creditLog = pgTable("credit_log", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
	creditGrantId: text("credit_grant_id").references(() => creditGrant.id, { onDelete: 'set null' }),
	grantType: text("grant_type"),  // Redundant copy of grant.type for stats stability when grant is deleted

	// Action type: 'granted' | 'consumed' | 'expired' | 'refunded' | 'held' | 'released' | 'revoked'
	action: text("action").notNull(),

	// Amount change: positive for additions, negative for deductions
	amountChange: integer("amount_change").notNull(),

	// Idempotency key - combined with creditGrantId to prevent duplicate processing
	// Allows one event to span multiple grants while remaining idempotent per-grant
	eventId: text("event_id"),

	// Additional context
	reason: text("reason"), // Human-readable description (e.g., "Generated Image #1234")
	metadata: text("metadata"), // JSON string for extra data (e.g., { model: "flux-pro", duration: 12.5 })

	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
	creditLogUserIdIdx: index("credit_log_user_id_idx").on(table.userId),
	creditLogGrantIdIdx: index("credit_log_grant_id_idx").on(table.creditGrantId),
	creditLogEventIdIdx: index("credit_log_event_id_idx").on(table.eventId),
	creditLogActionIdx: index("credit_log_action_idx").on(table.action),
	// Composite index for idempotency queries in deduction.service.ts
	// Supports: WHERE userId = ? AND eventId = ? AND action = ?
	creditLogUserEventActionIdx: index("credit_log_user_event_action_idx").on(table.userId, table.eventId, table.action),
	// Composite index for time range queries in balance.service.ts (getSpentThisPeriod, getTransactionLogs)
	// Supports: WHERE userId = ? AND createdAt BETWEEN ? AND ?
	creditLogUserIdCreatedAtIdx: index("credit_log_user_id_created_at_idx").on(table.userId, table.createdAt),
	// Composite unique: same event + same grant + same action cannot have duplicate logs
	// This allows: HELD(event1, grant1) and RELEASED(event1, grant1) to coexist
	creditLogEventGrantActionUnique: unique("credit_log_event_grant_action_unique").on(table.eventId, table.creditGrantId, table.action),
}));
