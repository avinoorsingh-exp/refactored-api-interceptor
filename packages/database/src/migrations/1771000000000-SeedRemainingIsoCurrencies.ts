import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Seeds all remaining ISO 4217 currencies (January 2026 edition) that were missing
 * from the initial seed migration, and removes deprecated currencies.
 *
 * - Adds 115 missing currency, fund, precious metal, and special codes
 * - Removes BGN (Bulgarian Lev) and HRK (Croatian Kuna) — both countries adopted the Euro
 *
 * This migration is idempotent — safe to run multiple times.
 */
export class SeedRemainingIsoCurrencies1771000000000 implements MigrationInterface {
	name = 'SeedRemainingIsoCurrencies1771000000000'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// All missing ISO 4217 currencies as of January 1, 2026
		// Format: [code, number, name, symbol, minor_units]
		const currencies: ReadonlyArray<readonly [string, number, string, string | null, number]> = [
			// Africa
			['BIF', 108, 'Burundi Franc', 'FBu', 0],
			['CVE', 132, 'Cabo Verde Escudo', '$', 2],
			['CDF', 976, 'Congolese Franc', 'FC', 2],
			['DJF', 262, 'Djibouti Franc', 'Fdj', 0],
			['DZD', 12, 'Algerian Dinar', 'د.ج', 2],
			['ERN', 232, 'Nakfa', 'Nfk', 2],
			['ETB', 230, 'Ethiopian Birr', 'Br', 2],
			['GMD', 270, 'Dalasi', 'D', 2],
			['GNF', 324, 'Guinean Franc', 'FG', 0],
			['LRD', 430, 'Liberian Dollar', '$', 2],
			['LYD', 434, 'Libyan Dinar', 'ل.د', 3],
			['MGA', 969, 'Malagasy Ariary', 'Ar', 2],
			['MRU', 929, 'Ouguiya', 'UM', 2],
			['MUR', 480, 'Mauritius Rupee', '₨', 2],
			['MWK', 454, 'Malawi Kwacha', 'MK', 2],
			['MZN', 943, 'Mozambique Metical', 'MT', 2],
			['NAD', 516, 'Namibia Dollar', '$', 2],
			['RWF', 646, 'Rwanda Franc', 'RF', 0],
			['SCR', 690, 'Seychelles Rupee', '₨', 2],
			['SDG', 938, 'Sudanese Pound', 'ج.س', 2],
			['SHP', 654, 'Saint Helena Pound', '£', 2],
			['SLE', 925, 'Leone', 'Le', 2],
			['SOS', 706, 'Somali Shilling', 'Sh', 2],
			['SSP', 728, 'South Sudanese Pound', '£', 2],
			['STN', 930, 'Dobra', 'Db', 2],
			['TND', 788, 'Tunisian Dinar', 'د.ت', 3],
			['TZS', 834, 'Tanzanian Shilling', 'TSh', 2],
			['UGX', 800, 'Uganda Shilling', 'USh', 0],
			['YER', 886, 'Yemeni Rial', '﷼', 2],
			['ZMW', 967, 'Zambian Kwacha', 'ZK', 2],
			['ZWG', 924, 'Zimbabwe Gold', null, 2],

			// Americas
			['BMD', 60, 'Bermudian Dollar', '$', 2],
			['BOB', 68, 'Boliviano', 'Bs.', 2],
			['BOV', 984, 'Mvdol', null, 2],
			['BZD', 84, 'Belize Dollar', 'BZ$', 2],
			['CRC', 188, 'Costa Rican Colon', '₡', 2],
			['CUP', 192, 'Cuban Peso', '$', 2],
			['DOP', 214, 'Dominican Peso', 'RD$', 2],
			['GTQ', 320, 'Quetzal', 'Q', 2],
			['GYD', 328, 'Guyana Dollar', '$', 2],
			['HNL', 340, 'Lempira', 'L', 2],
			['HTG', 332, 'Gourde', 'G', 2],
			['KYD', 136, 'Cayman Islands Dollar', '$', 2],
			['NIO', 558, 'Cordoba Oro', 'C$', 2],
			['PAB', 590, 'Balboa', 'B/.', 2],
			['PYG', 600, 'Guarani', '₲', 0],
			['SRD', 968, 'Surinam Dollar', '$', 2],
			['SVC', 222, 'El Salvador Colon', '$', 2],
			['USN', 997, 'US Dollar (Next day)', null, 2],
			['UYI', 940, 'Uruguay Peso en Unidades Indexadas (UI)', null, 0],
			['UYU', 858, 'Peso Uruguayo', '$U', 2],
			['UYW', 927, 'Unidad Previsional', null, 4],
			['VED', 926, 'Bolivar Soberano', 'Bs.D', 2],
			['VES', 928, 'Bolivar Soberano', 'Bs.S', 2],

			// Asia & Pacific
			['AFN', 971, 'Afghani', '؋', 2],
			['AZN', 944, 'Azerbaijan Manat', '₼', 2],
			['BDT', 50, 'Taka', '৳', 2],
			['BND', 96, 'Brunei Dollar', '$', 2],
			['BTN', 64, 'Ngultrum', 'Nu.', 2],
			['KGS', 417, 'Som', 'сом', 2],
			['KHR', 116, 'Riel', '៛', 2],
			['KMF', 174, 'Comorian Franc', 'CF', 0],
			['KPW', 408, 'North Korean Won', '₩', 2],
			['KZT', 398, 'Tenge', '₸', 2],
			['LAK', 418, 'Lao Kip', '₭', 2],
			['LBP', 422, 'Lebanese Pound', 'ل.ل', 2],
			['LKR', 144, 'Sri Lanka Rupee', 'Rs', 2],
			['MDL', 498, 'Moldovan Leu', 'L', 2],
			['MMK', 104, 'Kyat', 'K', 2],
			['MNT', 496, 'Tugrik', '₮', 2],
			['MOP', 446, 'Pataca', 'MOP$', 2],
			['MVR', 462, 'Rufiyaa', '.ރ', 2],
			['NPR', 524, 'Nepalese Rupee', '₨', 2],
			['PGK', 598, 'Kina', 'K', 2],
			['PKR', 586, 'Pakistan Rupee', '₨', 2],
			['SYP', 760, 'Syrian Pound', '£', 2],
			['TJS', 972, 'Somoni', 'SM', 2],
			['TMT', 934, 'Turkmenistan New Manat', 'T', 2],
			['TOP', 776, "Pa'anga", 'T$', 2],
			['UZS', 860, 'Uzbekistan Sum', 'сўм', 2],
			['VUV', 548, 'Vatu', 'VT', 0],
			['WST', 882, 'Tala', 'T', 2],

			// Europe & Caucasus
			['ALL', 8, 'Lek', 'L', 2],
			['AMD', 51, 'Armenian Dram', '֏', 2],
			['AOA', 973, 'Kwanza', 'Kz', 2],
			['AWG', 533, 'Aruban Florin', 'ƒ', 2],
			['BAM', 977, 'Convertible Mark', 'KM', 2],
			['BWP', 72, 'Pula', 'P', 2],
			['BYN', 933, 'Belarusian Ruble', 'Br', 2],
			['CLF', 990, 'Unidad de Fomento', null, 4],
			['COU', 970, 'Unidad de Valor Real', null, 2],
			['CHE', 947, 'WIR Euro', null, 2],
			['CHW', 948, 'WIR Franc', null, 2],
			['FKP', 238, 'Falkland Islands Pound', '£', 2],
			['GEL', 981, 'Lari', '₾', 2],
			['GIP', 292, 'Gibraltar Pound', '£', 2],
			['IQD', 368, 'Iraqi Dinar', 'ع.د', 3],
			['IRR', 364, 'Iranian Rial', '﷼', 2],
			['LSL', 426, 'Loti', 'L', 2],
			['MKD', 807, 'Denar', 'ден', 2],
			['MXV', 979, 'Mexican Unidad de Inversion (UDI)', null, 2],
			['RSD', 941, 'Serbian Dinar', 'din.', 2],
			['SBD', 90, 'Solomon Islands Dollar', '$', 2],
			['SZL', 748, 'Lilangeni', 'E', 2],

			// Multicurrency / Regional
			['XCD', 951, 'East Caribbean Dollar', '$', 2],
			['XCG', 532, 'Caribbean Guilder', null, 2],
			['XAD', 396, 'Arab Accounting Dinar', null, 2],

			// Supranational / Special purpose
			['XBA', 955, 'Bond Markets Unit European Composite Unit (EURCO)', null, 0],
			['XBB', 956, 'Bond Markets Unit European Monetary Unit (E.M.U.-6)', null, 0],
			['XBC', 957, 'Bond Markets Unit European Unit of Account 9 (E.U.A.-9)', null, 0],
			['XBD', 958, 'Bond Markets Unit European Unit of Account 17 (E.U.A.-17)', null, 0],
			['XSU', 994, 'Sucre', null, 0],
			['XTS', 963, 'Codes specifically reserved for testing purposes', null, 0],
			['XUA', 965, 'ADB Unit of Account', null, 0],
			['XXX', 999, 'No currency', null, 0],
		]

		await queryRunner.startTransaction()

		try {
			// Reset the id sequence to avoid primary key conflicts.
			// The sequence can be out of sync if prior seeds inserted without
			// advancing it, or after a database restore.
			await queryRunner.query(
				`SELECT setval(
					pg_get_serial_sequence('"core"."currency"', 'id'),
					COALESCE((SELECT MAX(id) FROM "core"."currency"), 0) + 1,
					false
				)`,
			)

			// Insert all missing currencies
			for (const [code, number, name, symbol, minorUnits] of currencies) {
				await queryRunner.query(
					`INSERT INTO "core"."currency" ("code", "number", "name", "symbol", "minor_units")
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT ("code") DO NOTHING`,
					[code, number, name, symbol, minorUnits],
				)
			}

			// Remove deprecated currencies (countries adopted the Euro)
			// BGN (975) - Bulgarian Lev: Bulgaria adopted the Euro
			// HRK (191) - Croatian Kuna: Croatia adopted the Euro
			await queryRunner.query(
				`DELETE FROM "core"."currency" WHERE "code" IN ('BGN', 'HRK')`,
			)

			await queryRunner.commitTransaction()
		} catch (error) {
			await queryRunner.rollbackTransaction()
			throw error
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.startTransaction()

		try {
			// Re-add deprecated currencies
			await queryRunner.query(
				`INSERT INTO "core"."currency" ("code", "number", "name", "symbol", "minor_units")
				VALUES ('BGN', 975, 'Bulgarian Lev', 'лв', 2)
				ON CONFLICT ("code") DO NOTHING`,
			)

			await queryRunner.query(
				`INSERT INTO "core"."currency" ("code", "number", "name", "symbol", "minor_units")
				VALUES ('HRK', 191, 'Croatian Kuna', 'kn', 2)
				ON CONFLICT ("code") DO NOTHING`,
			)

			// Remove the currencies added by this migration
			const addedCodes = [
				'AFN','ALL','AMD','AOA','AWG','AZN','BAM','BDT','BIF','BMD','BND','BOB','BOV',
				'BTN','BWP','BYN','BZD','CDF','CHE','CHW','CLF','COU','CRC','CUP','CVE','DJF',
				'DOP','DZD','ERN','ETB','FKP','GEL','GIP','GMD','GNF','GTQ','GYD','HNL','HTG',
				'IQD','IRR','KGS','KHR','KMF','KPW','KYD','KZT','LAK','LBP','LKR','LRD','LSL',
				'LYD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXV','MZN',
				'NAD','NIO','NPR','PAB','PGK','PKR','PYG','RSD','RWF','SBD','SCR','SDG','SHP',
				'SLE','SOS','SRD','SSP','STN','SVC','SYP','SZL','TJS','TMT','TND','TOP','TZS',
				'UGX','USN','UYI','UYU','UYW','UZS','VED','VES','VUV','WST','XAD','XBA','XBB',
				'XBC','XBD','XCD','XCG','XSU','XTS','XUA','XXX','YER','ZMW','ZWG',
			]

			const placeholders = addedCodes.map((_, i) => `$${i + 1}`).join(', ')
			await queryRunner.query(
				`DELETE FROM "core"."currency" WHERE "code" IN (${placeholders})`,
				addedCodes,
			)

			await queryRunner.commitTransaction()
		} catch (error) {
			await queryRunner.rollbackTransaction()
			throw error
		}
	}
}
