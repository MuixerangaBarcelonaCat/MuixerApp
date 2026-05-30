import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1748600000000 implements MigrationInterface {
  name = 'InitialSchema1748600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums
    await queryRunner.query(`CREATE TYPE "figure_zone_enum" AS ENUM('BASE', 'PINYA', 'TRONC', 'FIGURE_DIRECTION', 'XICALLA_DIRECTION')`);
    await queryRunner.query(`CREATE TYPE "node_shape_enum" AS ENUM('ELLIPSE', 'RECTANGLE')`);
    await queryRunner.query(`CREATE TYPE "user_role_enum" AS ENUM('ADMIN', 'TECHNICAL', 'MEMBER')`);
    await queryRunner.query(`CREATE TYPE "gender_enum" AS ENUM('MALE', 'FEMALE', 'OTHER')`);
    await queryRunner.query(`CREATE TYPE "availability_status_enum" AS ENUM('AVAILABLE', 'TEMPORARILY_UNAVAILABLE', 'LONG_TERM_UNAVAILABLE')`);
    await queryRunner.query(`CREATE TYPE "onboarding_status_enum" AS ENUM('COMPLETED', 'IN_PROGRESS', 'LOST', 'NOT_APPLICABLE')`);
    await queryRunner.query(`CREATE TYPE "event_type_enum" AS ENUM('ASSAIG', 'ACTUACIO')`);
    await queryRunner.query(`CREATE TYPE "attendance_status_enum" AS ENUM('PENDENT', 'ANIRE', 'NO_VAIG', 'ASSISTIT', 'NO_PRESENTAT')`);
    await queryRunner.query(`CREATE TYPE "client_type_enum" AS ENUM('dashboard', 'pwa')`);
    await queryRunner.query(`CREATE TYPE "reference_element_type_enum" AS ENUM('RECTANGLE', 'ARROW')`);

    // positions
    await queryRunner.query(`
      CREATE TABLE "positions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "shortDescription" character varying,
        "longDescription" text,
        "color" character varying,
        "zone" "figure_zone_enum",
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_positions_name" UNIQUE ("name"),
        CONSTRAINT "UQ_positions_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_positions" PRIMARY KEY ("id")
      )
    `);

    // users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "passwordHash" character varying,
        "role" "user_role_enum" NOT NULL DEFAULT 'MEMBER',
        "isActive" boolean NOT NULL DEFAULT false,
        "inviteToken" character varying,
        "inviteExpiresAt" TIMESTAMP,
        "resetToken" character varying,
        "resetExpiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "person_id" uuid,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "REL_users_person" UNIQUE ("person_id"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // persons
    await queryRunner.query(`
      CREATE TABLE "persons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "firstSurname" character varying NOT NULL,
        "secondSurname" character varying,
        "alias" character varying(20) NOT NULL,
        "phone" character varying,
        "birthDate" date,
        "shoulderHeight" integer,
        "gender" "gender_enum",
        "isXicalla" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "isMember" boolean NOT NULL DEFAULT false,
        "isProvisional" boolean NOT NULL DEFAULT false,
        "availability" "availability_status_enum" NOT NULL DEFAULT 'AVAILABLE',
        "onboardingStatus" "onboarding_status_enum" NOT NULL DEFAULT 'NOT_APPLICABLE',
        "notes" text,
        "shirtDate" date,
        "joinDate" date,
        "legacyId" character varying,
        "lastSyncedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "managedById" uuid,
        "mentorId" uuid,
        CONSTRAINT "UQ_persons_alias" UNIQUE ("alias"),
        CONSTRAINT "PK_persons" PRIMARY KEY ("id")
      )
    `);

    // seasons
    await queryRunner.query(`
      CREATE TABLE "seasons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date NOT NULL,
        "description" text,
        "legacyId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_seasons_name" UNIQUE ("name"),
        CONSTRAINT "UQ_seasons_legacyId" UNIQUE ("legacyId"),
        CONSTRAINT "PK_seasons" PRIMARY KEY ("id")
      )
    `);

    // events
    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "eventType" "event_type_enum" NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "date" date NOT NULL,
        "startTime" character varying,
        "location" character varying,
        "locationUrl" character varying,
        "information" text,
        "countsForStatistics" boolean NOT NULL DEFAULT true,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "attendanceSummary" jsonb NOT NULL DEFAULT '{"confirmed":0,"declined":0,"pending":0,"attended":0,"noShow":0,"lateCancel":0,"children":0,"total":0}',
        "legacyId" character varying,
        "legacyType" character varying,
        "lastSyncedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "seasonId" uuid,
        CONSTRAINT "UQ_events_legacyId" UNIQUE ("legacyId"),
        CONSTRAINT "PK_events" PRIMARY KEY ("id")
      )
    `);

    // attendances
    await queryRunner.query(`
      CREATE TABLE "attendances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "status" "attendance_status_enum" NOT NULL,
        "respondedAt" TIMESTAMP,
        "notes" text,
        "legacyId" character varying,
        "lastSyncedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "personId" uuid NOT NULL,
        "eventId" uuid NOT NULL,
        CONSTRAINT "UQ_attendances_person_event" UNIQUE ("personId", "eventId"),
        CONSTRAINT "PK_attendances" PRIMARY KEY ("id")
      )
    `);

    // refresh_tokens
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying NOT NULL,
        "family" uuid NOT NULL,
        "client_type" "client_type_enum" NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "used_at" TIMESTAMP,
        "revoked_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_tokens_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);

    // figure_families
    await queryRunner.query(`
      CREATE TABLE "figure_families" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "description" text,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_figure_families_name" UNIQUE ("name"),
        CONSTRAINT "UQ_figure_families_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_figure_families" PRIMARY KEY ("id")
      )
    `);

    // figure_templates
    await queryRunner.query(`
      CREATE TABLE "figure_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "variantOrder" integer NOT NULL DEFAULT 1,
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "description" text,
        "hasPinya" boolean NOT NULL DEFAULT true,
        "direction" double precision NOT NULL DEFAULT 0,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "familyId" uuid,
        CONSTRAINT "UQ_figure_templates_name" UNIQUE ("name"),
        CONSTRAINT "UQ_figure_templates_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_figure_templates" PRIMARY KEY ("id")
      )
    `);

    // figure_nodes
    await queryRunner.query(`
      CREATE TABLE "figure_nodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" character varying NOT NULL,
        "zone" "figure_zone_enum" NOT NULL,
        "positionType" character varying,
        "x" double precision NOT NULL,
        "y" double precision NOT NULL,
        "z" integer NOT NULL DEFAULT 0,
        "width" double precision NOT NULL,
        "height" double precision NOT NULL,
        "rotation" double precision NOT NULL DEFAULT 0,
        "color" character varying,
        "shape" "node_shape_enum" NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "climbPath" character varying,
        "ringLevel" integer,
        "originNodeId" uuid,
        "renglaId" uuid,
        "renglaPosition" integer,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "templateId" uuid NOT NULL,
        CONSTRAINT "PK_figure_nodes" PRIMARY KEY ("id")
      )
    `);

    // figure_family_nodes
    await queryRunner.query(`
      CREATE TABLE "figure_family_nodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" character varying NOT NULL,
        "zone" "figure_zone_enum" NOT NULL,
        "positionType" character varying,
        "x" double precision NOT NULL,
        "y" double precision NOT NULL,
        "z" integer NOT NULL DEFAULT 0,
        "width" double precision NOT NULL,
        "height" double precision NOT NULL,
        "rotation" double precision NOT NULL DEFAULT 0,
        "color" character varying,
        "shape" "node_shape_enum" NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "climbPath" character varying,
        "ringLevel" integer,
        "renglaId" uuid,
        "renglaPosition" integer,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "familyId" uuid NOT NULL,
        CONSTRAINT "PK_figure_family_nodes" PRIMARY KEY ("id")
      )
    `);

    // composition_templates
    await queryRunner.query(`
      CREATE TABLE "composition_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "slug" character varying NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_composition_templates_name" UNIQUE ("name"),
        CONSTRAINT "UQ_composition_templates_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_composition_templates" PRIMARY KEY ("id")
      )
    `);

    // composition_slots
    await queryRunner.query(`
      CREATE TABLE "composition_slots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" character varying,
        "offsetX" double precision NOT NULL DEFAULT 0,
        "offsetY" double precision NOT NULL DEFAULT 0,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "compositionId" uuid NOT NULL,
        "figureTemplateId" uuid NOT NULL,
        CONSTRAINT "PK_composition_slots" PRIMARY KEY ("id")
      )
    `);

    // event_segments
    await queryRunner.query(`
      CREATE TABLE "event_segments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying,
        "sortOrder" integer NOT NULL,
        "startTime" character varying,
        "endTime" character varying,
        "notes" text,
        "isVisible" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "eventId" uuid NOT NULL,
        CONSTRAINT "PK_event_segments" PRIMARY KEY ("id")
      )
    `);

    // figure_instances
    await queryRunner.query(`
      CREATE TABLE "figure_instances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" character varying,
        "sortOrder" integer NOT NULL,
        "snapshotted" boolean NOT NULL DEFAULT false,
        "sourceVariantOrder" integer,
        "numberOfCordons" integer,
        "openCordons" jsonb,
        "projectionX" double precision,
        "projectionY" double precision,
        "projectionScale" double precision NOT NULL DEFAULT 1.0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "segmentId" uuid NOT NULL,
        "figureTemplateId" uuid,
        "compositionTemplateId" uuid,
        CONSTRAINT "PK_figure_instances" PRIMARY KEY ("id")
      )
    `);

    // instance_nodes
    await queryRunner.query(`
      CREATE TABLE "instance_nodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sourceNodeId" uuid,
        "originNodeId" uuid,
        "label" character varying NOT NULL,
        "zone" "figure_zone_enum" NOT NULL,
        "positionType" character varying,
        "x" double precision NOT NULL,
        "y" double precision NOT NULL,
        "z" integer NOT NULL DEFAULT 0,
        "width" double precision NOT NULL,
        "height" double precision NOT NULL,
        "rotation" double precision NOT NULL DEFAULT 0,
        "color" character varying,
        "shape" "node_shape_enum" NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "climbPath" character varying,
        "ringLevel" integer,
        "renglaId" uuid,
        "renglaPosition" integer,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "figureInstanceId" uuid NOT NULL,
        CONSTRAINT "PK_instance_nodes" PRIMARY KEY ("id")
      )
    `);

    // node_assignments
    await queryRunner.query(`
      CREATE TABLE "node_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "figureInstanceId" uuid NOT NULL,
        "instanceNodeId" uuid NOT NULL,
        "personId" uuid NOT NULL,
        "compositionSlotId" uuid,
        CONSTRAINT "UQ_node_assignments_instance_node_slot" UNIQUE ("figureInstanceId", "instanceNodeId", "compositionSlotId"),
        CONSTRAINT "UQ_node_assignments_instance_person_slot" UNIQUE ("figureInstanceId", "personId", "compositionSlotId"),
        CONSTRAINT "PK_node_assignments" PRIMARY KEY ("id")
      )
    `);

    // reference_elements
    await queryRunner.query(`
      CREATE TABLE "reference_elements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "reference_element_type_enum" NOT NULL,
        "label" character varying,
        "x" double precision NOT NULL,
        "y" double precision NOT NULL,
        "width" double precision NOT NULL,
        "height" double precision NOT NULL,
        "rotation" double precision NOT NULL DEFAULT 0,
        "color" character varying,
        "sortOrder" integer NOT NULL,
        "hiddenInSegments" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "eventId" uuid NOT NULL,
        CONSTRAINT "PK_reference_elements" PRIMARY KEY ("id")
      )
    `);

    // rengles
    await queryRunner.query(`
      CREATE TABLE "rengles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "startPosition" integer NOT NULL DEFAULT 1,
        "allowsCordoObert" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "templateId" uuid NOT NULL,
        CONSTRAINT "PK_rengles" PRIMARY KEY ("id")
      )
    `);

    // person_positions (join table)
    await queryRunner.query(`
      CREATE TABLE "person_positions" (
        "personsId" uuid NOT NULL,
        "positionsId" uuid NOT NULL,
        CONSTRAINT "PK_person_positions" PRIMARY KEY ("personsId", "positionsId")
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_family" ON "refresh_tokens" ("family")`);
    await queryRunner.query(`CREATE INDEX "IDX_person_positions_personsId" ON "person_positions" ("personsId")`);
    await queryRunner.query(`CREATE INDEX "IDX_person_positions_positionsId" ON "person_positions" ("positionsId")`);

    // uuid-ossp extension (needed for uuid_generate_v4)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Foreign keys
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_users_person" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "persons" ADD CONSTRAINT "FK_persons_managedBy" FOREIGN KEY ("managedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "persons" ADD CONSTRAINT "FK_persons_mentor" FOREIGN KEY ("mentorId") REFERENCES "persons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_events_season" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "attendances" ADD CONSTRAINT "FK_attendances_person" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "attendances" ADD CONSTRAINT "FK_attendances_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "figure_templates" ADD CONSTRAINT "FK_figure_templates_family" FOREIGN KEY ("familyId") REFERENCES "figure_families"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "figure_nodes" ADD CONSTRAINT "FK_figure_nodes_template" FOREIGN KEY ("templateId") REFERENCES "figure_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "figure_family_nodes" ADD CONSTRAINT "FK_figure_family_nodes_family" FOREIGN KEY ("familyId") REFERENCES "figure_families"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "composition_slots" ADD CONSTRAINT "FK_composition_slots_composition" FOREIGN KEY ("compositionId") REFERENCES "composition_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "composition_slots" ADD CONSTRAINT "FK_composition_slots_figureTemplate" FOREIGN KEY ("figureTemplateId") REFERENCES "figure_templates"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "event_segments" ADD CONSTRAINT "FK_event_segments_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "figure_instances" ADD CONSTRAINT "FK_figure_instances_segment" FOREIGN KEY ("segmentId") REFERENCES "event_segments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "figure_instances" ADD CONSTRAINT "FK_figure_instances_figureTemplate" FOREIGN KEY ("figureTemplateId") REFERENCES "figure_templates"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "figure_instances" ADD CONSTRAINT "FK_figure_instances_compositionTemplate" FOREIGN KEY ("compositionTemplateId") REFERENCES "composition_templates"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "instance_nodes" ADD CONSTRAINT "FK_instance_nodes_figureInstance" FOREIGN KEY ("figureInstanceId") REFERENCES "figure_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD CONSTRAINT "FK_node_assignments_figureInstance" FOREIGN KEY ("figureInstanceId") REFERENCES "figure_instances"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD CONSTRAINT "FK_node_assignments_instanceNode" FOREIGN KEY ("instanceNodeId") REFERENCES "instance_nodes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD CONSTRAINT "FK_node_assignments_person" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "node_assignments" ADD CONSTRAINT "FK_node_assignments_compositionSlot" FOREIGN KEY ("compositionSlotId") REFERENCES "composition_slots"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "reference_elements" ADD CONSTRAINT "FK_reference_elements_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "rengles" ADD CONSTRAINT "FK_rengles_template" FOREIGN KEY ("templateId") REFERENCES "figure_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "person_positions" ADD CONSTRAINT "FK_person_positions_person" FOREIGN KEY ("personsId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "person_positions" ADD CONSTRAINT "FK_person_positions_position" FOREIGN KEY ("positionsId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "person_positions" DROP CONSTRAINT "FK_person_positions_position"`);
    await queryRunner.query(`ALTER TABLE "person_positions" DROP CONSTRAINT "FK_person_positions_person"`);
    await queryRunner.query(`ALTER TABLE "rengles" DROP CONSTRAINT "FK_rengles_template"`);
    await queryRunner.query(`ALTER TABLE "reference_elements" DROP CONSTRAINT "FK_reference_elements_event"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT "FK_node_assignments_compositionSlot"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT "FK_node_assignments_person"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT "FK_node_assignments_instanceNode"`);
    await queryRunner.query(`ALTER TABLE "node_assignments" DROP CONSTRAINT "FK_node_assignments_figureInstance"`);
    await queryRunner.query(`ALTER TABLE "instance_nodes" DROP CONSTRAINT "FK_instance_nodes_figureInstance"`);
    await queryRunner.query(`ALTER TABLE "figure_instances" DROP CONSTRAINT "FK_figure_instances_compositionTemplate"`);
    await queryRunner.query(`ALTER TABLE "figure_instances" DROP CONSTRAINT "FK_figure_instances_figureTemplate"`);
    await queryRunner.query(`ALTER TABLE "figure_instances" DROP CONSTRAINT "FK_figure_instances_segment"`);
    await queryRunner.query(`ALTER TABLE "event_segments" DROP CONSTRAINT "FK_event_segments_event"`);
    await queryRunner.query(`ALTER TABLE "composition_slots" DROP CONSTRAINT "FK_composition_slots_figureTemplate"`);
    await queryRunner.query(`ALTER TABLE "composition_slots" DROP CONSTRAINT "FK_composition_slots_composition"`);
    await queryRunner.query(`ALTER TABLE "figure_family_nodes" DROP CONSTRAINT "FK_figure_family_nodes_family"`);
    await queryRunner.query(`ALTER TABLE "figure_nodes" DROP CONSTRAINT "FK_figure_nodes_template"`);
    await queryRunner.query(`ALTER TABLE "figure_templates" DROP CONSTRAINT "FK_figure_templates_family"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_user"`);
    await queryRunner.query(`ALTER TABLE "attendances" DROP CONSTRAINT "FK_attendances_event"`);
    await queryRunner.query(`ALTER TABLE "attendances" DROP CONSTRAINT "FK_attendances_person"`);
    await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_events_season"`);
    await queryRunner.query(`ALTER TABLE "persons" DROP CONSTRAINT "FK_persons_mentor"`);
    await queryRunner.query(`ALTER TABLE "persons" DROP CONSTRAINT "FK_persons_managedBy"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_person"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_person_positions_positionsId"`);
    await queryRunner.query(`DROP INDEX "IDX_person_positions_personsId"`);
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_family"`);
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_user_id"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "person_positions"`);
    await queryRunner.query(`DROP TABLE "rengles"`);
    await queryRunner.query(`DROP TABLE "reference_elements"`);
    await queryRunner.query(`DROP TABLE "node_assignments"`);
    await queryRunner.query(`DROP TABLE "instance_nodes"`);
    await queryRunner.query(`DROP TABLE "figure_instances"`);
    await queryRunner.query(`DROP TABLE "event_segments"`);
    await queryRunner.query(`DROP TABLE "composition_slots"`);
    await queryRunner.query(`DROP TABLE "composition_templates"`);
    await queryRunner.query(`DROP TABLE "figure_family_nodes"`);
    await queryRunner.query(`DROP TABLE "figure_nodes"`);
    await queryRunner.query(`DROP TABLE "figure_templates"`);
    await queryRunner.query(`DROP TABLE "figure_families"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "attendances"`);
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP TABLE "seasons"`);
    await queryRunner.query(`DROP TABLE "persons"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "positions"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "reference_element_type_enum"`);
    await queryRunner.query(`DROP TYPE "client_type_enum"`);
    await queryRunner.query(`DROP TYPE "attendance_status_enum"`);
    await queryRunner.query(`DROP TYPE "event_type_enum"`);
    await queryRunner.query(`DROP TYPE "onboarding_status_enum"`);
    await queryRunner.query(`DROP TYPE "availability_status_enum"`);
    await queryRunner.query(`DROP TYPE "gender_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
    await queryRunner.query(`DROP TYPE "node_shape_enum"`);
    await queryRunner.query(`DROP TYPE "figure_zone_enum"`);
  }
}
