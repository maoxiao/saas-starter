import { boolean, integer, pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	normalizedEmail: text('normalized_email').unique(),
	emailVerified: boolean('email_verified').notNull(),
	image: text('image'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	role: text('role'),
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires'),
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
	firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),

	// Last Touch (updated on each visit with UTM params)
	lastTouchSource: text("last_touch_source"),
	lastTouchMedium: text("last_touch_medium"),
	lastTouchCampaign: text("last_touch_campaign"),
	lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),

	// Registration Session Attribution (set once when user registers)
	regPage: text("reg_page"), // Landing page of registration session
	regRef: text("reg_ref"), // Referrer of registration session
	regSource: text("reg_source"), // UTM source of registration session
	regMedium: text("reg_medium"), // UTM medium of registration session
	regCampaign: text("reg_campaign"), // UTM campaign of registration session

	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	userAttributionVisitorIdIdx: index("user_attribution_visitor_id_idx").on(table.visitorId),
	userAttributionUserIdIdx: index("user_attribution_user_id_idx").on(table.userId),
}));

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp('expires_at').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
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
	accessTokenExpiresAt: timestamp('access_token_expires_at'),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull()
}, (table) => ({
	accountUserIdIdx: index("account_user_id_idx").on(table.userId),
	accountAccountIdIdx: index("account_account_id_idx").on(table.accountId),
	accountProviderIdIdx: index("account_provider_id_idx").on(table.providerId),
}));

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at'),
	updatedAt: timestamp('updated_at')
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
	periodStart: timestamp('period_start'),
	periodEnd: timestamp('period_end'),
	cancelAtPeriodEnd: boolean('cancel_at_period_end'),
	trialStart: timestamp('trial_start'),
	trialEnd: timestamp('trial_end'),
	// Session attribution at conversion time (captures the session that led to payment)
	sessionLandingPage: text('session_landing_page'), // First page user visited in this checkout session
	sessionReferrer: text('session_referrer'), // External referrer for this checkout session
	sessionSource: text('session_source'), // UTM source for this checkout session
	sessionMedium: text('session_medium'), // UTM medium for this checkout session
	sessionCampaign: text('session_campaign'), // UTM campaign for this checkout session
	// Amount
	amount: integer('amount'), // in cents
	currency: text('currency'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
	paymentTypeIdx: index("payment_type_idx").on(table.type),
	paymentPurchaseTypeIdx: index("payment_purchase_type_idx").on(table.purchaseType),
	paymentPriceIdIdx: index("payment_price_id_idx").on(table.priceId),
	paymentUserIdIdx: index("payment_user_id_idx").on(table.userId),
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
	lastRefreshAt: timestamp("last_refresh_at"), // deprecated
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
	expirationDate: timestamp("expiration_date"),
	expiredAt: timestamp("expired_at"), // timestamp when expiration was processed
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
	creditTransactionUserIdIdx: index("credit_transaction_user_id_idx").on(table.userId),
	creditTransactionTypeIdx: index("credit_transaction_type_idx").on(table.type),
}));
