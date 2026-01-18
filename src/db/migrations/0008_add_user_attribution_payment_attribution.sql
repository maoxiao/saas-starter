CREATE TABLE "user_attribution" (
	"id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"user_id" text,
	"first_touch_source" text,
	"first_touch_medium" text,
	"first_touch_campaign" text,
	"landing_page" text,
	"referrer" text,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_touch_source" text,
	"last_touch_medium" text,
	"last_touch_campaign" text,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"reg_page" text,
	"reg_ref" text,
	"reg_source" text,
	"reg_medium" text,
	"reg_campaign" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_attribution_visitor_id_unique" UNIQUE("visitor_id")
);
--> statement-breakpoint
DROP INDEX "payment_scene_idx";--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD COLUMN "balance" integer;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD COLUMN "expired_at" timestamp;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "purchase_type" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "session_landing_page" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "session_referrer" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "session_source" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "session_medium" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "session_campaign" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "amount" integer;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "user_attribution" ADD CONSTRAINT "user_attribution_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_attribution_visitor_id_idx" ON "user_attribution" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "user_attribution_user_id_idx" ON "user_attribution" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_purchase_type_idx" ON "payment" USING btree ("purchase_type");--> statement-breakpoint
ALTER TABLE "credit_transaction" DROP COLUMN "remaining_amount";--> statement-breakpoint
ALTER TABLE "credit_transaction" DROP COLUMN "expiration_date_processed_at";--> statement-breakpoint
ALTER TABLE "payment" DROP COLUMN "scene";