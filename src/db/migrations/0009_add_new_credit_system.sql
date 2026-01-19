CREATE TABLE "credit_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance" integer NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"expires_at" timestamp,
	"effective_at" timestamp DEFAULT now() NOT NULL,
	"source_ref" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_grant_source_ref_unique" UNIQUE("source_ref")
);
--> statement-breakpoint
CREATE TABLE "credit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credit_grant_id" text,
	"grant_type" text,
	"action" text NOT NULL,
	"amount_change" integer NOT NULL,
	"event_id" text,
	"reason" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_log_event_grant_action_unique" UNIQUE("event_id","credit_grant_id","action")
);
--> statement-breakpoint
ALTER TABLE "credit_grant" ADD CONSTRAINT "credit_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_log" ADD CONSTRAINT "credit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_log" ADD CONSTRAINT "credit_log_credit_grant_id_credit_grant_id_fk" FOREIGN KEY ("credit_grant_id") REFERENCES "public"."credit_grant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_grant_user_id_idx" ON "credit_grant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_grant_type_idx" ON "credit_grant" USING btree ("type");--> statement-breakpoint
CREATE INDEX "credit_grant_expires_at_idx" ON "credit_grant" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "credit_grant_priority_idx" ON "credit_grant" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "credit_grant_expiration_idx" ON "credit_grant" USING btree ("expires_at") WHERE is_active = true AND balance > 0;--> statement-breakpoint
CREATE INDEX "credit_log_user_id_idx" ON "credit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_log_grant_id_idx" ON "credit_log" USING btree ("credit_grant_id");--> statement-breakpoint
CREATE INDEX "credit_log_event_id_idx" ON "credit_log" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "credit_log_action_idx" ON "credit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "credit_log_user_event_action_idx" ON "credit_log" USING btree ("user_id","event_id","action");--> statement-breakpoint
CREATE INDEX "credit_log_user_id_created_at_idx" ON "credit_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_user_id_created_at_idx" ON "payment" USING btree ("user_id","created_at","status","paid","price_id");