import { MigrationInterface, QueryRunner } from 'typeorm'

/**
 * Seed ISO 4217 currency data.
 * Includes commonly used currencies with their codes, numbers, names, symbols, and minor units.
 */
export class SeedCurrencyData1770400000001 implements MigrationInterface {
	name = 'SeedCurrencyData1770400000001'

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ISO 4217 Currency data
		// Format: (code, number, name, symbol, minor_units)
		// Note: Precious metals and SDR use default minorUnits (2) as they don't have a standard decimal convention
		const currencies = [
			// Major currencies
			['USD', 840, 'US Dollar', '$', 2],
			['EUR', 978, 'Euro', '€', 2],
			['GBP', 826, 'Pound Sterling', '£', 2],
			['JPY', 392, 'Japanese Yen', '¥', 0],
			['CHF', 756, 'Swiss Franc', 'CHF', 2],
			['CAD', 124, 'Canadian Dollar', 'CA$', 2],
			['AUD', 36, 'Australian Dollar', 'A$', 2],
			['NZD', 554, 'New Zealand Dollar', 'NZ$', 2],

			// Asian currencies
			['CNY', 156, 'Chinese Yuan', '¥', 2],
			['HKD', 344, 'Hong Kong Dollar', 'HK$', 2],
			['SGD', 702, 'Singapore Dollar', 'S$', 2],
			['KRW', 410, 'South Korean Won', '₩', 0],
			['TWD', 901, 'New Taiwan Dollar', 'NT$', 2],
			['INR', 356, 'Indian Rupee', '₹', 2],
			['IDR', 360, 'Indonesian Rupiah', 'Rp', 2],
			['MYR', 458, 'Malaysian Ringgit', 'RM', 2],
			['PHP', 608, 'Philippine Peso', '₱', 2],
			['THB', 764, 'Thai Baht', '฿', 2],
			['VND', 704, 'Vietnamese Dong', '₫', 0],

			// European currencies (non-Euro)
			['SEK', 752, 'Swedish Krona', 'kr', 2],
			['NOK', 578, 'Norwegian Krone', 'kr', 2],
			['DKK', 208, 'Danish Krone', 'kr', 2],
			['PLN', 985, 'Polish Zloty', 'zł', 2],
			['CZK', 203, 'Czech Koruna', 'Kč', 2],
			['HUF', 348, 'Hungarian Forint', 'Ft', 2],
			['RON', 946, 'Romanian Leu', 'lei', 2],
			['BGN', 975, 'Bulgarian Lev', 'лв', 2],
			['HRK', 191, 'Croatian Kuna', 'kn', 2],
			['ISK', 352, 'Icelandic Krona', 'kr', 0],
			['RUB', 643, 'Russian Ruble', '₽', 2],
			['UAH', 980, 'Ukrainian Hryvnia', '₴', 2],
			['TRY', 949, 'Turkish Lira', '₺', 2],

			// Middle Eastern currencies
			['AED', 784, 'UAE Dirham', 'د.إ', 2],
			['SAR', 682, 'Saudi Riyal', '﷼', 2],
			['QAR', 634, 'Qatari Riyal', '﷼', 2],
			['KWD', 414, 'Kuwaiti Dinar', 'د.ك', 3],
			['BHD', 48, 'Bahraini Dinar', '.د.ب', 3],
			['OMR', 512, 'Omani Rial', '﷼', 3],
			['JOD', 400, 'Jordanian Dinar', 'د.ا', 3],
			['ILS', 376, 'Israeli New Shekel', '₪', 2],
			['EGP', 818, 'Egyptian Pound', '£', 2],

			// African currencies
			['ZAR', 710, 'South African Rand', 'R', 2],
			['NGN', 566, 'Nigerian Naira', '₦', 2],
			['KES', 404, 'Kenyan Shilling', 'KSh', 2],
			['GHS', 936, 'Ghanaian Cedi', '₵', 2],
			['MAD', 504, 'Moroccan Dirham', 'د.م.', 2],

			// American currencies (non-USD/CAD)
			['MXN', 484, 'Mexican Peso', '$', 2],
			['BRL', 986, 'Brazilian Real', 'R$', 2],
			['ARS', 32, 'Argentine Peso', '$', 2],
			['CLP', 152, 'Chilean Peso', '$', 0],
			['COP', 170, 'Colombian Peso', '$', 2],
			['PEN', 604, 'Peruvian Sol', 'S/', 2],

			// Oceania currencies
			['FJD', 242, 'Fijian Dollar', '$', 2],

			// Caribbean currencies
			['JMD', 388, 'Jamaican Dollar', 'J$', 2],
			['TTD', 780, 'Trinidad and Tobago Dollar', 'TT$', 2],
			['BSD', 44, 'Bahamian Dollar', '$', 2],
			['BBD', 52, 'Barbados Dollar', '$', 2],

			// Other notable currencies
			['XAF', 950, 'CFA Franc BEAC', 'FCFA', 0],
			['XOF', 952, 'CFA Franc BCEAO', 'CFA', 0],
			['XPF', 953, 'CFP Franc', '₣', 0],

			// Precious metals (ISO 4217) - use default minorUnits (2)
			['XAU', 959, 'Gold (troy ounce)', null, 2],
			['XAG', 961, 'Silver (troy ounce)', null, 2],
			['XPT', 962, 'Platinum (troy ounce)', null, 2],
			['XPD', 964, 'Palladium (troy ounce)', null, 2],

			// Special currencies - use default minorUnits (2)
			['XDR', 960, 'Special Drawing Rights', 'SDR', 2],
		] as const

		// Start transaction for atomic insert
		await queryRunner.startTransaction()

		try {
			for (const currency of currencies) {
				const [code, number, name, symbol, minorUnits] = currency

				await queryRunner.query(
					`INSERT INTO "core"."currency" ("code", "number", "name", "symbol", "minor_units")
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT ("code") DO NOTHING`,
					[code, number, name, symbol, minorUnits]
				)
			}

			await queryRunner.commitTransaction()
		} catch (error) {
			await queryRunner.rollbackTransaction()
			throw error
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Remove seeded currency data
		await queryRunner.query(`DELETE FROM "core"."currency"`)
	}
}
