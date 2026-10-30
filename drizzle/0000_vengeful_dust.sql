CREATE TABLE "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"claim_data" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "disputes_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "master_skus" (
	"id" serial PRIMARY KEY NOT NULL,
	"barcode" text DEFAULT '',
	"sku_id" text NOT NULL,
	"sku_name" text NOT NULL,
	"harga" integer,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "master_skus_sku_id_unique" UNIQUE("sku_id")
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"waktu_proses" text NOT NULL,
	"operator_id" text NOT NULL,
	"order_id" text NOT NULL,
	"sku_id" text NOT NULL,
	"nama_barang" text NOT NULL,
	"kondisi" text NOT NULL,
	"catatan_tambahan" text DEFAULT '',
	"video_timestamp" text DEFAULT '',
	"nama_file_video" text DEFAULT '',
	"link_video" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"role" text NOT NULL,
	"department" text NOT NULL,
	"company" text DEFAULT 'PT. Tirta Kumala Sari',
	"operator_code" text NOT NULL,
	"pin" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"avatar_color" text,
	"custom_permissions" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_operator_code_unique" UNIQUE("operator_code")
);
--> statement-breakpoint
CREATE TABLE "warehouse_meta" (
	"id" serial PRIMARY KEY NOT NULL,
	"meta_key" text NOT NULL,
	"meta_value" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "warehouse_meta_meta_key_unique" UNIQUE("meta_key")
);
