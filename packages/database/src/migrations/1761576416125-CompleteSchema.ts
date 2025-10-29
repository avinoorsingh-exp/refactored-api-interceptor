import { MigrationInterface, QueryRunner } from 'typeorm'

export class CompleteSchema1761576416125 implements MigrationInterface {
	name = 'CompleteSchema1761576416125'

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "line1" text NOT NULL, "line2" text, "city" text NOT NULL, "unit" text NOT NULL, "postal_code" text NOT NULL, "country" character(2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_745d8f43d3af10ab8247465e450" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "agent_companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "legacy_id" uuid NOT NULL, "email" text NOT NULL, "name" text NOT NULL, "phone" text NOT NULL, "tax_id" text, "tax_id_hashed" text, "use_ssn" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_07e0b0fc507d7f6047b572c2cd4" UNIQUE ("email"), CONSTRAINT "PK_e53de24e78bb10739768be9f65f" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agent_id" bigint, "title" text, "first_name" text NOT NULL, "middle_name" text, "last_name" text NOT NULL, "suffix" text, "preferred_name" text, "birth_date" TIMESTAMP WITH TIME ZONE, "lifecycle_status" text, "last_modified" TIMESTAMP WITH TIME ZONE, "system_id" integer, "seed_agent" boolean NOT NULL DEFAULT false, "join_date" TIMESTAMP WITH TIME ZONE, "anniversary_date" TIMESTAMP WITH TIME ZONE, "termination_date" TIMESTAMP WITH TIME ZONE, "is_staff" boolean NOT NULL DEFAULT false, "agent_company_id" uuid NOT NULL, CONSTRAINT "PK_9c653f28ae19c5884d5baf6a1d9" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "agent_addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agent_id" uuid NOT NULL, "address_id" uuid NOT NULL, "role" character varying(20), "is_primary" boolean NOT NULL DEFAULT false, "valid_from" date, "valid_to" date, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ccae8e9efb6f2afd23e0ca60521" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "email" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d0af6f5866201d5cb424767744a" UNIQUE ("email"), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "offices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "office_id" bigint NOT NULL, "website" text, "name" text NOT NULL, "phone" text NOT NULL, "lifecycle_status" text NOT NULL, "primary_state" character varying(200) NOT NULL, CONSTRAINT "PK_1ea41502c6dddcec44ad9fcbbb3" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "external_references" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "system_code" text NOT NULL, "ref_key" text NOT NULL, "ref_value" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2a6726657225af4cb97a928765b" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "agent_external_references" ("agent_id" uuid NOT NULL, "external_reference_id" uuid NOT NULL, CONSTRAINT "PK_88b541a63ac96c4d3cdd491be21" PRIMARY KEY ("agent_id", "external_reference_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "office_external_references" ("office_id" uuid NOT NULL, "external_reference_id" uuid NOT NULL, CONSTRAINT "PK_8036af6e5d8a87b95408b74f016" PRIMARY KEY ("office_id", "external_reference_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "company_external_references" ("company_id" uuid NOT NULL, "external_reference_id" uuid NOT NULL, CONSTRAINT "PK_fc66166ae1ea12c6cc7eb64e556" PRIMARY KEY ("company_id", "external_reference_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "agent_offices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "is_primary" boolean NOT NULL, "agent_id" uuid NOT NULL, "office_id" uuid NOT NULL, CONSTRAINT "PK_f3a7d2e362dcde354e0809804fc" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "pay_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "active" boolean NOT NULL, "agent_percentage" numeric NOT NULL, "cap" numeric NOT NULL, CONSTRAINT "PK_0868a5a0bcd0a4d0cf52a349698" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "payment_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agent_id" uuid NOT NULL, "pay_plan_id" uuid, "cap_reset_date" TIMESTAMP WITH TIME ZONE NOT NULL, "split_check" boolean NOT NULL, "cap_reset_date_changed_by_user" boolean NOT NULL, CONSTRAINT "PK_78624861ce2178d6835fb1d9fdf" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "payment_settings_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_settings" uuid NOT NULL, "custom_name" text NOT NULL, "value" numeric NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL, "end_date" TIMESTAMP WITH TIME ZONE NOT NULL, "type" text NOT NULL, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_a0bdc6f36d2b7f29a1b3fae86e6" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "plan_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_settings" uuid NOT NULL, "name" text NOT NULL, "default_value" numeric NOT NULL, "is_default" boolean NOT NULL, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_b1d4e09b569c4e25cedefb03168" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "pay_plan_variants" ("variant_id" character varying NOT NULL, "pay_plan_id" uuid NOT NULL, "value" numeric NOT NULL, CONSTRAINT "PK_f13a34828e806f3cd66fab91815" PRIMARY KEY ("variant_id", "pay_plan_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "languages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "code" text NOT NULL, "supported" boolean NOT NULL, CONSTRAINT "PK_b517f827ca496b29f4d549c631d" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "agent_languages" ("agent_id" uuid NOT NULL, "language_id" uuid NOT NULL, CONSTRAINT "PK_35f45e300df7669defbe0c6bf5a" PRIMARY KEY ("agent_id", "language_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "public_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agent_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d93171d9881ffb7048af75253f3" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "contact_methods" ("id" SERIAL NOT NULL, "name" text NOT NULL, "channel" text NOT NULL, "sub_type" text, "value" text NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "sms_opt_in" boolean, "agent_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_23dba1e45090b3cee8798abce5c" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "email_forwards" ("id" SERIAL NOT NULL, "recipient_id" text NOT NULL, "verified_last_checked" TIMESTAMP WITH TIME ZONE, "verified" boolean NOT NULL DEFAULT false, "created" TIMESTAMP WITH TIME ZONE NOT NULL, "forward_id" text NOT NULL, "recipient_created" TIMESTAMP WITH TIME ZONE, "verified_date" TIMESTAMP WITH TIME ZONE, "language" text, CONSTRAINT "PK_36ac7721a93607a59323f035772" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "socials" ("id" SERIAL NOT NULL, "context" text NOT NULL, "value" text NOT NULL, CONSTRAINT "PK_5e3ee018e1b66c619ae3d3b3309" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "specialties" ("id" BIGSERIAL NOT NULL, "name" text NOT NULL, CONSTRAINT "PK_ba01cec5aa8ac48778a1d097e98" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "agent_specialties" ("agent_uuid" uuid NOT NULL, "public_profile_id" uuid NOT NULL, "specialty_id" bigint NOT NULL, CONSTRAINT "PK_6bc0581256a99505f02089f21cf" PRIMARY KEY ("agent_uuid", "public_profile_id", "specialty_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "mls" ("mlsId" BIGSERIAL NOT NULL, "ouid" text, "global_id" integer, "lifecycle_status" text NOT NULL, "name" text NOT NULL, "short_name" text, "website" text, "org_type" text NOT NULL, "larversion_url" text, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, "modified_by" text NOT NULL, "address_id" uuid, CONSTRAINT "PK_305dab3fd4701ed4e20a909882d" PRIMARY KEY ("mlsId"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "agent_mls" ("agent_id" uuid NOT NULL, "mls_id" bigint NOT NULL, CONSTRAINT "PK_6456ca7bc0bf569622f7edef94c" PRIMARY KEY ("agent_id", "mls_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "active_locations" ("name" text NOT NULL, "agent_id" uuid NOT NULL, "postal_code" text NOT NULL, "city" text NOT NULL, "is_primary" boolean NOT NULL, CONSTRAINT "PK_011d28148331713efe4817f1956" PRIMARY KEY ("name", "agent_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "line_of_business" ("id" BIGSERIAL NOT NULL, "name" text NOT NULL, CONSTRAINT "PK_38eeccc38228d3292b3b17d7bb2" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "licenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expiration_date" date, "is_primary" boolean NOT NULL, "type" character varying(50) NOT NULL, "first_name" text NOT NULL, "middle_name" text, "last_name" text NOT NULL, "suffix" text, "number" text NOT NULL, "line_of_business_id" bigint NOT NULL, "state_id" uuid NOT NULL, CONSTRAINT "PK_da5021501ce80efa03de6f40086" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor" text NOT NULL, "body" text NOT NULL, "date" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_af6206538ea96c4e77e9f400c3d" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "lifecycle_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor" text NOT NULL, "effective_date" TIMESTAMP WITH TIME ZONE NOT NULL, "type" text NOT NULL, "active" boolean NOT NULL, "note_id" uuid, CONSTRAINT "PK_34abb88c0eea13bbddefd999a27" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "license_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "license_id" uuid NOT NULL, "actor" text NOT NULL, "date" TIMESTAMP WITH TIME ZONE NOT NULL, "type" text NOT NULL, "status" text NOT NULL, CONSTRAINT "PK_1ab21d4eb683758d652c1892136" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "relationships" ("subject_agent_id" uuid NOT NULL, "object_agent_id" uuid NOT NULL, "type" text NOT NULL, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, "created" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_45a297d9d9cb166f0f51bfc3198" PRIMARY KEY ("subject_agent_id", "object_agent_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "sponsor_configurations" ("agent_id" uuid NOT NULL, "uuid" uuid NOT NULL, "buffer" integer NOT NULL, "sponsor_buffer_override" boolean NOT NULL, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_88ec11bd74b5d1cc6749cdd3cfa" PRIMARY KEY ("agent_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "countries" ("countryId" SERIAL NOT NULL, "name" text NOT NULL, "two_letter_code" character varying(2) NOT NULL, "iso_3166" text, "dialing_code" integer, "system_id" integer, CONSTRAINT "PK_c9ebef6aac022e54b1b01c8f824" PRIMARY KEY ("countryId"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "regions" ("id" BIGSERIAL NOT NULL, "name" text NOT NULL, CONSTRAINT "PK_4fcd12ed6a046276e2deb08801c" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "code" text NOT NULL, "is_active" boolean NOT NULL, "email" text, "signature_distribution_email" text, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, "modified_by" text NOT NULL, "region_id" bigint NOT NULL, CONSTRAINT "PK_09ab30ca0975c02656483265f4f" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "programs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, CONSTRAINT "PK_d43c664bcaafc0e8a06dfd34e05" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "state_programs" ("state_id" uuid NOT NULL, "program_id" uuid NOT NULL, CONSTRAINT "PK_7dbd952b1fb201b81ca2d038860" PRIMARY KEY ("state_id", "program_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "organization_contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "email" text, "phone" text, "address" text, CONSTRAINT "PK_3728fac56883cb199cd707037a0" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "w9" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tin" text NOT NULL, "legal_name" text NOT NULL, "business_name" text, "federal_tax_classification" text NOT NULL, "federal_tax_classification_other" text, "exempt_payee_code" text, "exemption_from_fatca_reporting_code" text, "signature_date" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5879bda5407305a0b5efc98234a" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "w9_addresses" ("w9_id" uuid NOT NULL, "address_id" uuid NOT NULL, CONSTRAINT "PK_54acda0bcb2aa20e142bde40390" PRIMARY KEY ("w9_id", "address_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "taxes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tax_id" text NOT NULL, "type" text NOT NULL, "jurisdiction" text NOT NULL, "rate" numeric(10,4), "effective_date" TIMESTAMP WITH TIME ZONE, "expiration_date" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6c58c9cbb420c4f65e3f5eb8162" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "office_addresses" ("office_id" uuid NOT NULL, "address_id" uuid NOT NULL, CONSTRAINT "PK_5106ea714fa6101754cbc80fef1" PRIMARY KEY ("office_id", "address_id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "artifacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" text NOT NULL, "name" text NOT NULL, "url" text, "storage_key" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6516bbed3c129918e05c5012edb" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "custom_flags" ("flagId" BIGSERIAL NOT NULL, "name" text NOT NULL, "type" text NOT NULL, "scope" text NOT NULL, "active" boolean NOT NULL, "delete_in_progress" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_81ae9cb17213ee9660410d31bab" PRIMARY KEY ("flagId"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "fees" ("id" BIGSERIAL NOT NULL, "name" text NOT NULL, "active" boolean NOT NULL, "value" numeric(10,2) NOT NULL, "paid_by" text, "is_third_party" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_97f3a1b1b8ee5674fd4da93f461" PRIMARY KEY ("id"))`,
		)
		await queryRunner.query(
			`CREATE TABLE "approvals" ("approvalId" BIGSERIAL NOT NULL, "approval_state" text NOT NULL, "decision_date" TIMESTAMP WITH TIME ZONE, "counters" integer, "template" text, "note" text, "prerequisite" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_be1b41ed18758d99b4f3400eeca" PRIMARY KEY ("approvalId"))`,
		)
		await queryRunner.query(
			`ALTER TABLE "agents" ADD CONSTRAINT "FK_e9563501b4f4de0f2fb0b215f09" FOREIGN KEY ("agent_company_id") REFERENCES "agent_companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_addresses" ADD CONSTRAINT "FK_008542a4ae1b6d0b221c97d0d40" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_addresses" ADD CONSTRAINT "FK_fe45d6dd09b00c168032e438582" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_external_references" ADD CONSTRAINT "FK_1c8b2c2330cb9c76bc4c86a9e63" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_external_references" ADD CONSTRAINT "FK_b2fa09116731364a7bb8e65ea62" FOREIGN KEY ("external_reference_id") REFERENCES "external_references"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "office_external_references" ADD CONSTRAINT "FK_b86762d8a446064bc6dbade054e" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "office_external_references" ADD CONSTRAINT "FK_9d669ae8dd3736d5f674cf98272" FOREIGN KEY ("external_reference_id") REFERENCES "external_references"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "company_external_references" ADD CONSTRAINT "FK_6f76992da6854341e7118ba5cf3" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "company_external_references" ADD CONSTRAINT "FK_ccbb3fab21b52b7d9d91d8037ac" FOREIGN KEY ("external_reference_id") REFERENCES "external_references"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_offices" ADD CONSTRAINT "FK_60a1d196727a5867e6cd3d6f7ec" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_offices" ADD CONSTRAINT "FK_1b3a143becbbe34af843febaeae" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "payment_settings" ADD CONSTRAINT "FK_c6c5a8a6ed6f2e305f9d6a5c59d" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "payment_settings" ADD CONSTRAINT "FK_7a2c7a6c88abf797930ffc653ea" FOREIGN KEY ("pay_plan_id") REFERENCES "pay_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "payment_settings_variants" ADD CONSTRAINT "FK_7c6d0618209f886b9658a40708c" FOREIGN KEY ("payment_settings") REFERENCES "payment_settings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "pay_plan_variants" ADD CONSTRAINT "FK_27afa9edd0f7309f2475ace03f4" FOREIGN KEY ("pay_plan_id") REFERENCES "pay_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_languages" ADD CONSTRAINT "FK_d14d4c011580fcff8ca1dd35339" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_languages" ADD CONSTRAINT "FK_dfbcbd957bf8602e88ea7722136" FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "public_profiles" ADD CONSTRAINT "FK_d555feedf183a7272b8255d0605" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "contact_methods" ADD CONSTRAINT "FK_4f3edf66ef9ca15ae082ffe0fde" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_specialties" ADD CONSTRAINT "FK_620fa7bbd547b0faf83554a6ec3" FOREIGN KEY ("agent_uuid") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_specialties" ADD CONSTRAINT "FK_3702cdf1c8cfff043b8333c7994" FOREIGN KEY ("public_profile_id") REFERENCES "public_profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_specialties" ADD CONSTRAINT "FK_c70600035ce70b3ddce8b07037e" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "mls" ADD CONSTRAINT "FK_7074a63c12a6454117ad5c3f3a3" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_mls" ADD CONSTRAINT "FK_65aaa3aaf76c2e3a557e4b72bc7" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_mls" ADD CONSTRAINT "FK_b0f6195e4793254861d50da989a" FOREIGN KEY ("mls_id") REFERENCES "mls"("mlsId") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "active_locations" ADD CONSTRAINT "FK_8806d35ae6f0c5e3d54ea724d54" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "licenses" ADD CONSTRAINT "FK_467bc8f3eeb77a7d7186a175691" FOREIGN KEY ("line_of_business_id") REFERENCES "line_of_business"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "lifecycle_events" ADD CONSTRAINT "FK_5ae945b6879462c2ba257944cab" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "license_events" ADD CONSTRAINT "FK_494c8faaa87844f36337eeb45a5" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "relationships" ADD CONSTRAINT "FK_a1ba9d13186e9dc988f81c187f7" FOREIGN KEY ("subject_agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "relationships" ADD CONSTRAINT "FK_0283821e6200e68f1b9d5613600" FOREIGN KEY ("object_agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "sponsor_configurations" ADD CONSTRAINT "FK_88ec11bd74b5d1cc6749cdd3cfa" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "states" ADD CONSTRAINT "FK_5e92ce53d0835e3e36630ff134e" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "state_programs" ADD CONSTRAINT "FK_c047ddab4183fbbbf9aa61745ba" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "state_programs" ADD CONSTRAINT "FK_754db357862fbaefcde07e77462" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "w9_addresses" ADD CONSTRAINT "FK_b23201ed50b06f83db27e06ac39" FOREIGN KEY ("w9_id") REFERENCES "w9"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "w9_addresses" ADD CONSTRAINT "FK_c1e79b3dde929974c641247bca8" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "office_addresses" ADD CONSTRAINT "FK_197c631e0b1a4f90d1fa8a45f01" FOREIGN KEY ("office_id") REFERENCES "offices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
		await queryRunner.query(
			`ALTER TABLE "office_addresses" ADD CONSTRAINT "FK_8812b06029384299f37f9ee6f77" FOREIGN KEY ("address_id") REFERENCES "addresses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "office_addresses" DROP CONSTRAINT "FK_8812b06029384299f37f9ee6f77"`,
		)
		await queryRunner.query(
			`ALTER TABLE "office_addresses" DROP CONSTRAINT "FK_197c631e0b1a4f90d1fa8a45f01"`,
		)
		await queryRunner.query(
			`ALTER TABLE "w9_addresses" DROP CONSTRAINT "FK_c1e79b3dde929974c641247bca8"`,
		)
		await queryRunner.query(
			`ALTER TABLE "w9_addresses" DROP CONSTRAINT "FK_b23201ed50b06f83db27e06ac39"`,
		)
		await queryRunner.query(
			`ALTER TABLE "state_programs" DROP CONSTRAINT "FK_754db357862fbaefcde07e77462"`,
		)
		await queryRunner.query(
			`ALTER TABLE "state_programs" DROP CONSTRAINT "FK_c047ddab4183fbbbf9aa61745ba"`,
		)
		await queryRunner.query(
			`ALTER TABLE "states" DROP CONSTRAINT "FK_5e92ce53d0835e3e36630ff134e"`,
		)
		await queryRunner.query(
			`ALTER TABLE "sponsor_configurations" DROP CONSTRAINT "FK_88ec11bd74b5d1cc6749cdd3cfa"`,
		)
		await queryRunner.query(
			`ALTER TABLE "relationships" DROP CONSTRAINT "FK_0283821e6200e68f1b9d5613600"`,
		)
		await queryRunner.query(
			`ALTER TABLE "relationships" DROP CONSTRAINT "FK_a1ba9d13186e9dc988f81c187f7"`,
		)
		await queryRunner.query(
			`ALTER TABLE "license_events" DROP CONSTRAINT "FK_494c8faaa87844f36337eeb45a5"`,
		)
		await queryRunner.query(
			`ALTER TABLE "lifecycle_events" DROP CONSTRAINT "FK_5ae945b6879462c2ba257944cab"`,
		)
		await queryRunner.query(
			`ALTER TABLE "licenses" DROP CONSTRAINT "FK_467bc8f3eeb77a7d7186a175691"`,
		)
		await queryRunner.query(
			`ALTER TABLE "active_locations" DROP CONSTRAINT "FK_8806d35ae6f0c5e3d54ea724d54"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_mls" DROP CONSTRAINT "FK_b0f6195e4793254861d50da989a"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_mls" DROP CONSTRAINT "FK_65aaa3aaf76c2e3a557e4b72bc7"`,
		)
		await queryRunner.query(
			`ALTER TABLE "mls" DROP CONSTRAINT "FK_7074a63c12a6454117ad5c3f3a3"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_specialties" DROP CONSTRAINT "FK_c70600035ce70b3ddce8b07037e"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_specialties" DROP CONSTRAINT "FK_3702cdf1c8cfff043b8333c7994"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_specialties" DROP CONSTRAINT "FK_620fa7bbd547b0faf83554a6ec3"`,
		)
		await queryRunner.query(
			`ALTER TABLE "contact_methods" DROP CONSTRAINT "FK_4f3edf66ef9ca15ae082ffe0fde"`,
		)
		await queryRunner.query(
			`ALTER TABLE "public_profiles" DROP CONSTRAINT "FK_d555feedf183a7272b8255d0605"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_languages" DROP CONSTRAINT "FK_dfbcbd957bf8602e88ea7722136"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_languages" DROP CONSTRAINT "FK_d14d4c011580fcff8ca1dd35339"`,
		)
		await queryRunner.query(
			`ALTER TABLE "pay_plan_variants" DROP CONSTRAINT "FK_27afa9edd0f7309f2475ace03f4"`,
		)
		await queryRunner.query(
			`ALTER TABLE "payment_settings_variants" DROP CONSTRAINT "FK_7c6d0618209f886b9658a40708c"`,
		)
		await queryRunner.query(
			`ALTER TABLE "payment_settings" DROP CONSTRAINT "FK_7a2c7a6c88abf797930ffc653ea"`,
		)
		await queryRunner.query(
			`ALTER TABLE "payment_settings" DROP CONSTRAINT "FK_c6c5a8a6ed6f2e305f9d6a5c59d"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_offices" DROP CONSTRAINT "FK_1b3a143becbbe34af843febaeae"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_offices" DROP CONSTRAINT "FK_60a1d196727a5867e6cd3d6f7ec"`,
		)
		await queryRunner.query(
			`ALTER TABLE "company_external_references" DROP CONSTRAINT "FK_ccbb3fab21b52b7d9d91d8037ac"`,
		)
		await queryRunner.query(
			`ALTER TABLE "company_external_references" DROP CONSTRAINT "FK_6f76992da6854341e7118ba5cf3"`,
		)
		await queryRunner.query(
			`ALTER TABLE "office_external_references" DROP CONSTRAINT "FK_9d669ae8dd3736d5f674cf98272"`,
		)
		await queryRunner.query(
			`ALTER TABLE "office_external_references" DROP CONSTRAINT "FK_b86762d8a446064bc6dbade054e"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_external_references" DROP CONSTRAINT "FK_b2fa09116731364a7bb8e65ea62"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_external_references" DROP CONSTRAINT "FK_1c8b2c2330cb9c76bc4c86a9e63"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_addresses" DROP CONSTRAINT "FK_fe45d6dd09b00c168032e438582"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agent_addresses" DROP CONSTRAINT "FK_008542a4ae1b6d0b221c97d0d40"`,
		)
		await queryRunner.query(
			`ALTER TABLE "agents" DROP CONSTRAINT "FK_e9563501b4f4de0f2fb0b215f09"`,
		)
		await queryRunner.query(`DROP TABLE "approvals"`)
		await queryRunner.query(`DROP TABLE "fees"`)
		await queryRunner.query(`DROP TABLE "custom_flags"`)
		await queryRunner.query(`DROP TABLE "artifacts"`)
		await queryRunner.query(`DROP TABLE "office_addresses"`)
		await queryRunner.query(`DROP TABLE "taxes"`)
		await queryRunner.query(`DROP TABLE "w9_addresses"`)
		await queryRunner.query(`DROP TABLE "w9"`)
		await queryRunner.query(`DROP TABLE "organization_contacts"`)
		await queryRunner.query(`DROP TABLE "state_programs"`)
		await queryRunner.query(`DROP TABLE "programs"`)
		await queryRunner.query(`DROP TABLE "states"`)
		await queryRunner.query(`DROP TABLE "regions"`)
		await queryRunner.query(`DROP TABLE "countries"`)
		await queryRunner.query(`DROP TABLE "sponsor_configurations"`)
		await queryRunner.query(`DROP TABLE "relationships"`)
		await queryRunner.query(`DROP TABLE "license_events"`)
		await queryRunner.query(`DROP TABLE "lifecycle_events"`)
		await queryRunner.query(`DROP TABLE "notes"`)
		await queryRunner.query(`DROP TABLE "licenses"`)
		await queryRunner.query(`DROP TABLE "line_of_business"`)
		await queryRunner.query(`DROP TABLE "active_locations"`)
		await queryRunner.query(`DROP TABLE "agent_mls"`)
		await queryRunner.query(`DROP TABLE "mls"`)
		await queryRunner.query(`DROP TABLE "agent_specialties"`)
		await queryRunner.query(`DROP TABLE "specialties"`)
		await queryRunner.query(`DROP TABLE "socials"`)
		await queryRunner.query(`DROP TABLE "email_forwards"`)
		await queryRunner.query(`DROP TABLE "contact_methods"`)
		await queryRunner.query(`DROP TABLE "public_profiles"`)
		await queryRunner.query(`DROP TABLE "agent_languages"`)
		await queryRunner.query(`DROP TABLE "languages"`)
		await queryRunner.query(`DROP TABLE "pay_plan_variants"`)
		await queryRunner.query(`DROP TABLE "plan_variants"`)
		await queryRunner.query(`DROP TABLE "payment_settings_variants"`)
		await queryRunner.query(`DROP TABLE "payment_settings"`)
		await queryRunner.query(`DROP TABLE "pay_plans"`)
		await queryRunner.query(`DROP TABLE "agent_offices"`)
		await queryRunner.query(`DROP TABLE "company_external_references"`)
		await queryRunner.query(`DROP TABLE "office_external_references"`)
		await queryRunner.query(`DROP TABLE "agent_external_references"`)
		await queryRunner.query(`DROP TABLE "external_references"`)
		await queryRunner.query(`DROP TABLE "offices"`)
		await queryRunner.query(`DROP TABLE "companies"`)
		await queryRunner.query(`DROP TABLE "agent_addresses"`)
		await queryRunner.query(`DROP TABLE "agents"`)
		await queryRunner.query(`DROP TABLE "agent_companies"`)
		await queryRunner.query(`DROP TABLE "addresses"`)
	}
}
