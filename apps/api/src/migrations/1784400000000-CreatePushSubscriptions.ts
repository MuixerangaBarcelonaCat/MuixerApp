import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePushSubscriptions1784400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "endpoint" varchar(500) NOT NULL,
        "keys" jsonb NOT NULL,
        "userAgent" varchar(255),
        "isActive" boolean NOT NULL DEFAULT true,
        "lastUsedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_subscriptions_endpoint" UNIQUE ("endpoint"),
        CONSTRAINT "FK_push_subscriptions_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_push_subscriptions_user_id" ON "push_subscriptions" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_push_subscriptions_active_user"
        ON "push_subscriptions" ("isActive", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
