import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * ISO 3166-1 Country seed data
 */
const COUNTRIES = [
	{ name: 'Afghanistan', alpha2: 'AF', alpha3: 'AFG', number: 4, dialingCode: 93 },
	{ name: 'Åland Islands', alpha2: 'AX', alpha3: 'ALA', number: 248, dialingCode: 358 },
	{ name: 'Albania', alpha2: 'AL', alpha3: 'ALB', number: 8, dialingCode: 355 },
	{ name: 'Algeria', alpha2: 'DZ', alpha3: 'DZA', number: 12, dialingCode: 213 },
	{ name: 'American Samoa', alpha2: 'AS', alpha3: 'ASM', number: 16, dialingCode: 1 },
	{ name: 'Andorra', alpha2: 'AD', alpha3: 'AND', number: 20, dialingCode: 376 },
	{ name: 'Angola', alpha2: 'AO', alpha3: 'AGO', number: 24, dialingCode: 244 },
	{ name: 'Anguilla', alpha2: 'AI', alpha3: 'AIA', number: 660, dialingCode: 1 },
	{ name: 'Antarctica', alpha2: 'AQ', alpha3: 'ATA', number: 10, dialingCode: 672 },
	{ name: 'Antigua and Barbuda', alpha2: 'AG', alpha3: 'ATG', number: 28, dialingCode: 1 },
	{ name: 'Argentina', alpha2: 'AR', alpha3: 'ARG', number: 32, dialingCode: 54 },
	{ name: 'Armenia', alpha2: 'AM', alpha3: 'ARM', number: 51, dialingCode: 374 },
	{ name: 'Aruba', alpha2: 'AW', alpha3: 'ABW', number: 533, dialingCode: 297 },
	{ name: 'Australia', alpha2: 'AU', alpha3: 'AUS', number: 36, dialingCode: 61 },
	{ name: 'Austria', alpha2: 'AT', alpha3: 'AUT', number: 40, dialingCode: 43 },
	{ name: 'Azerbaijan', alpha2: 'AZ', alpha3: 'AZE', number: 31, dialingCode: 994 },
	{ name: 'Bahamas', alpha2: 'BS', alpha3: 'BHS', number: 44, dialingCode: 1 },
	{ name: 'Bahrain', alpha2: 'BH', alpha3: 'BHR', number: 48, dialingCode: 973 },
	{ name: 'Bangladesh', alpha2: 'BD', alpha3: 'BGD', number: 50, dialingCode: 880 },
	{ name: 'Barbados', alpha2: 'BB', alpha3: 'BRB', number: 52, dialingCode: 1 },
	{ name: 'Belarus', alpha2: 'BY', alpha3: 'BLR', number: 112, dialingCode: 375 },
	{ name: 'Belgium', alpha2: 'BE', alpha3: 'BEL', number: 56, dialingCode: 32 },
	{ name: 'Belize', alpha2: 'BZ', alpha3: 'BLZ', number: 84, dialingCode: 501 },
	{ name: 'Benin', alpha2: 'BJ', alpha3: 'BEN', number: 204, dialingCode: 229 },
	{ name: 'Bermuda', alpha2: 'BM', alpha3: 'BMU', number: 60, dialingCode: 1 },
	{ name: 'Bhutan', alpha2: 'BT', alpha3: 'BTN', number: 64, dialingCode: 975 },
	{ name: 'Bolivia (Plurinational State of)', alpha2: 'BO', alpha3: 'BOL', number: 68, dialingCode: 591 },
	{ name: 'Bonaire, Sint Eustatius and Saba', alpha2: 'BQ', alpha3: 'BES', number: 535, dialingCode: 599 },
	{ name: 'Bosnia and Herzegovina', alpha2: 'BA', alpha3: 'BIH', number: 70, dialingCode: 387 },
	{ name: 'Botswana', alpha2: 'BW', alpha3: 'BWA', number: 72, dialingCode: 267 },
	{ name: 'Bouvet Island', alpha2: 'BV', alpha3: 'BVT', number: 74, dialingCode: 47 },
	{ name: 'Brazil', alpha2: 'BR', alpha3: 'BRA', number: 76, dialingCode: 55 },
	{ name: 'British Indian Ocean Territory', alpha2: 'IO', alpha3: 'IOT', number: 86, dialingCode: 246 },
	{ name: 'Brunei Darussalam', alpha2: 'BN', alpha3: 'BRN', number: 96, dialingCode: 673 },
	{ name: 'Bulgaria', alpha2: 'BG', alpha3: 'BGR', number: 100, dialingCode: 359 },
	{ name: 'Burkina Faso', alpha2: 'BF', alpha3: 'BFA', number: 854, dialingCode: 226 },
	{ name: 'Burundi', alpha2: 'BI', alpha3: 'BDI', number: 108, dialingCode: 257 },
	{ name: 'Cabo Verde', alpha2: 'CV', alpha3: 'CPV', number: 132, dialingCode: 238 },
	{ name: 'Cambodia', alpha2: 'KH', alpha3: 'KHM', number: 116, dialingCode: 855 },
	{ name: 'Cameroon', alpha2: 'CM', alpha3: 'CMR', number: 120, dialingCode: 237 },
	{ name: 'Canada', alpha2: 'CA', alpha3: 'CAN', number: 124, dialingCode: 1 },
	{ name: 'Cayman Islands', alpha2: 'KY', alpha3: 'CYM', number: 136, dialingCode: 1 },
	{ name: 'Central African Republic', alpha2: 'CF', alpha3: 'CAF', number: 140, dialingCode: 236 },
	{ name: 'Chad', alpha2: 'TD', alpha3: 'TCD', number: 148, dialingCode: 235 },
	{ name: 'Chile', alpha2: 'CL', alpha3: 'CHL', number: 152, dialingCode: 56 },
	{ name: 'China', alpha2: 'CN', alpha3: 'CHN', number: 156, dialingCode: 86 },
	{ name: 'Christmas Island', alpha2: 'CX', alpha3: 'CXR', number: 162, dialingCode: 61 },
	{ name: 'Cocos (Keeling) Islands', alpha2: 'CC', alpha3: 'CCK', number: 166, dialingCode: 61 },
	{ name: 'Colombia', alpha2: 'CO', alpha3: 'COL', number: 170, dialingCode: 57 },
	{ name: 'Comoros', alpha2: 'KM', alpha3: 'COM', number: 174, dialingCode: 269 },
	{ name: 'Congo', alpha2: 'CG', alpha3: 'COG', number: 178, dialingCode: 242 },
	{ name: 'Congo (Democratic Republic of the)', alpha2: 'CD', alpha3: 'COD', number: 180, dialingCode: 243 },
	{ name: 'Cook Islands', alpha2: 'CK', alpha3: 'COK', number: 184, dialingCode: 682 },
	{ name: 'Costa Rica', alpha2: 'CR', alpha3: 'CRI', number: 188, dialingCode: 506 },
	{ name: "Côte d'Ivoire", alpha2: 'CI', alpha3: 'CIV', number: 384, dialingCode: 225 },
	{ name: 'Croatia', alpha2: 'HR', alpha3: 'HRV', number: 191, dialingCode: 385 },
	{ name: 'Cuba', alpha2: 'CU', alpha3: 'CUB', number: 192, dialingCode: 53 },
	{ name: 'Curaçao', alpha2: 'CW', alpha3: 'CUW', number: 531, dialingCode: 599 },
	{ name: 'Cyprus', alpha2: 'CY', alpha3: 'CYP', number: 196, dialingCode: 357 },
	{ name: 'Czechia', alpha2: 'CZ', alpha3: 'CZE', number: 203, dialingCode: 420 },
	{ name: 'Denmark', alpha2: 'DK', alpha3: 'DNK', number: 208, dialingCode: 45 },
	{ name: 'Djibouti', alpha2: 'DJ', alpha3: 'DJI', number: 262, dialingCode: 253 },
	{ name: 'Dominica', alpha2: 'DM', alpha3: 'DMA', number: 212, dialingCode: 1 },
	{ name: 'Dominican Republic', alpha2: 'DO', alpha3: 'DOM', number: 214, dialingCode: 1 },
	{ name: 'Ecuador', alpha2: 'EC', alpha3: 'ECU', number: 218, dialingCode: 593 },
	{ name: 'Egypt', alpha2: 'EG', alpha3: 'EGY', number: 818, dialingCode: 20 },
	{ name: 'El Salvador', alpha2: 'SV', alpha3: 'SLV', number: 222, dialingCode: 503 },
	{ name: 'Equatorial Guinea', alpha2: 'GQ', alpha3: 'GNQ', number: 226, dialingCode: 240 },
	{ name: 'Eritrea', alpha2: 'ER', alpha3: 'ERI', number: 232, dialingCode: 291 },
	{ name: 'Estonia', alpha2: 'EE', alpha3: 'EST', number: 233, dialingCode: 372 },
	{ name: 'Eswatini', alpha2: 'SZ', alpha3: 'SWZ', number: 748, dialingCode: 268 },
	{ name: 'Ethiopia', alpha2: 'ET', alpha3: 'ETH', number: 231, dialingCode: 251 },
	{ name: 'Falkland Islands (Malvinas)', alpha2: 'FK', alpha3: 'FLK', number: 238, dialingCode: 500 },
	{ name: 'Faroe Islands', alpha2: 'FO', alpha3: 'FRO', number: 234, dialingCode: 298 },
	{ name: 'Fiji', alpha2: 'FJ', alpha3: 'FJI', number: 242, dialingCode: 679 },
	{ name: 'Finland', alpha2: 'FI', alpha3: 'FIN', number: 246, dialingCode: 358 },
	{ name: 'France', alpha2: 'FR', alpha3: 'FRA', number: 250, dialingCode: 33 },
	{ name: 'French Guiana', alpha2: 'GF', alpha3: 'GUF', number: 254, dialingCode: 594 },
	{ name: 'French Polynesia', alpha2: 'PF', alpha3: 'PYF', number: 258, dialingCode: 689 },
	{ name: 'French Southern Territories', alpha2: 'TF', alpha3: 'ATF', number: 260, dialingCode: 262 },
	{ name: 'Gabon', alpha2: 'GA', alpha3: 'GAB', number: 266, dialingCode: 241 },
	{ name: 'Gambia', alpha2: 'GM', alpha3: 'GMB', number: 270, dialingCode: 220 },
	{ name: 'Georgia', alpha2: 'GE', alpha3: 'GEO', number: 268, dialingCode: 995 },
	{ name: 'Germany', alpha2: 'DE', alpha3: 'DEU', number: 276, dialingCode: 49 },
	{ name: 'Ghana', alpha2: 'GH', alpha3: 'GHA', number: 288, dialingCode: 233 },
	{ name: 'Gibraltar', alpha2: 'GI', alpha3: 'GIB', number: 292, dialingCode: 350 },
	{ name: 'Greece', alpha2: 'GR', alpha3: 'GRC', number: 300, dialingCode: 30 },
	{ name: 'Greenland', alpha2: 'GL', alpha3: 'GRL', number: 304, dialingCode: 299 },
	{ name: 'Grenada', alpha2: 'GD', alpha3: 'GRD', number: 308, dialingCode: 1 },
	{ name: 'Guadeloupe', alpha2: 'GP', alpha3: 'GLP', number: 312, dialingCode: 590 },
	{ name: 'Guam', alpha2: 'GU', alpha3: 'GUM', number: 316, dialingCode: 1 },
	{ name: 'Guatemala', alpha2: 'GT', alpha3: 'GTM', number: 320, dialingCode: 502 },
	{ name: 'Guernsey', alpha2: 'GG', alpha3: 'GGY', number: 831, dialingCode: 44 },
	{ name: 'Guinea', alpha2: 'GN', alpha3: 'GIN', number: 324, dialingCode: 224 },
	{ name: 'Guinea-Bissau', alpha2: 'GW', alpha3: 'GNB', number: 624, dialingCode: 245 },
	{ name: 'Guyana', alpha2: 'GY', alpha3: 'GUY', number: 328, dialingCode: 592 },
	{ name: 'Haiti', alpha2: 'HT', alpha3: 'HTI', number: 332, dialingCode: 509 },
	{ name: 'Heard Island and McDonald Islands', alpha2: 'HM', alpha3: 'HMD', number: 334, dialingCode: 672 },
	{ name: 'Holy See', alpha2: 'VA', alpha3: 'VAT', number: 336, dialingCode: 379 },
	{ name: 'Honduras', alpha2: 'HN', alpha3: 'HND', number: 340, dialingCode: 504 },
	{ name: 'Hong Kong', alpha2: 'HK', alpha3: 'HKG', number: 344, dialingCode: 852 },
	{ name: 'Hungary', alpha2: 'HU', alpha3: 'HUN', number: 348, dialingCode: 36 },
	{ name: 'Iceland', alpha2: 'IS', alpha3: 'ISL', number: 352, dialingCode: 354 },
	{ name: 'India', alpha2: 'IN', alpha3: 'IND', number: 356, dialingCode: 91 },
	{ name: 'Indonesia', alpha2: 'ID', alpha3: 'IDN', number: 360, dialingCode: 62 },
	{ name: 'Iran (Islamic Republic of)', alpha2: 'IR', alpha3: 'IRN', number: 364, dialingCode: 98 },
	{ name: 'Iraq', alpha2: 'IQ', alpha3: 'IRQ', number: 368, dialingCode: 964 },
	{ name: 'Ireland', alpha2: 'IE', alpha3: 'IRL', number: 372, dialingCode: 353 },
	{ name: 'Isle of Man', alpha2: 'IM', alpha3: 'IMN', number: 833, dialingCode: 44 },
	{ name: 'Israel', alpha2: 'IL', alpha3: 'ISR', number: 376, dialingCode: 972 },
	{ name: 'Italy', alpha2: 'IT', alpha3: 'ITA', number: 380, dialingCode: 39 },
	{ name: 'Jamaica', alpha2: 'JM', alpha3: 'JAM', number: 388, dialingCode: 1 },
	{ name: 'Japan', alpha2: 'JP', alpha3: 'JPN', number: 392, dialingCode: 81 },
	{ name: 'Jersey', alpha2: 'JE', alpha3: 'JEY', number: 832, dialingCode: 44 },
	{ name: 'Jordan', alpha2: 'JO', alpha3: 'JOR', number: 400, dialingCode: 962 },
	{ name: 'Kazakhstan', alpha2: 'KZ', alpha3: 'KAZ', number: 398, dialingCode: 7 },
	{ name: 'Kenya', alpha2: 'KE', alpha3: 'KEN', number: 404, dialingCode: 254 },
	{ name: 'Kiribati', alpha2: 'KI', alpha3: 'KIR', number: 296, dialingCode: 686 },
	{ name: "Korea (Democratic People's Republic of)", alpha2: 'KP', alpha3: 'PRK', number: 408, dialingCode: 850 },
	{ name: 'Korea (Republic of)', alpha2: 'KR', alpha3: 'KOR', number: 410, dialingCode: 82 },
	{ name: 'Kuwait', alpha2: 'KW', alpha3: 'KWT', number: 414, dialingCode: 965 },
	{ name: 'Kyrgyzstan', alpha2: 'KG', alpha3: 'KGZ', number: 417, dialingCode: 996 },
	{ name: "Lao People's Democratic Republic", alpha2: 'LA', alpha3: 'LAO', number: 418, dialingCode: 856 },
	{ name: 'Latvia', alpha2: 'LV', alpha3: 'LVA', number: 428, dialingCode: 371 },
	{ name: 'Lebanon', alpha2: 'LB', alpha3: 'LBN', number: 422, dialingCode: 961 },
	{ name: 'Lesotho', alpha2: 'LS', alpha3: 'LSO', number: 426, dialingCode: 266 },
	{ name: 'Liberia', alpha2: 'LR', alpha3: 'LBR', number: 430, dialingCode: 231 },
	{ name: 'Libya', alpha2: 'LY', alpha3: 'LBY', number: 434, dialingCode: 218 },
	{ name: 'Liechtenstein', alpha2: 'LI', alpha3: 'LIE', number: 438, dialingCode: 423 },
	{ name: 'Lithuania', alpha2: 'LT', alpha3: 'LTU', number: 440, dialingCode: 370 },
	{ name: 'Luxembourg', alpha2: 'LU', alpha3: 'LUX', number: 442, dialingCode: 352 },
	{ name: 'Macao', alpha2: 'MO', alpha3: 'MAC', number: 446, dialingCode: 853 },
	{ name: 'Madagascar', alpha2: 'MG', alpha3: 'MDG', number: 450, dialingCode: 261 },
	{ name: 'Malawi', alpha2: 'MW', alpha3: 'MWI', number: 454, dialingCode: 265 },
	{ name: 'Malaysia', alpha2: 'MY', alpha3: 'MYS', number: 458, dialingCode: 60 },
	{ name: 'Maldives', alpha2: 'MV', alpha3: 'MDV', number: 462, dialingCode: 960 },
	{ name: 'Mali', alpha2: 'ML', alpha3: 'MLI', number: 466, dialingCode: 223 },
	{ name: 'Malta', alpha2: 'MT', alpha3: 'MLT', number: 470, dialingCode: 356 },
	{ name: 'Marshall Islands', alpha2: 'MH', alpha3: 'MHL', number: 584, dialingCode: 692 },
	{ name: 'Martinique', alpha2: 'MQ', alpha3: 'MTQ', number: 474, dialingCode: 596 },
	{ name: 'Mauritania', alpha2: 'MR', alpha3: 'MRT', number: 478, dialingCode: 222 },
	{ name: 'Mauritius', alpha2: 'MU', alpha3: 'MUS', number: 480, dialingCode: 230 },
	{ name: 'Mayotte', alpha2: 'YT', alpha3: 'MYT', number: 175, dialingCode: 262 },
	{ name: 'Mexico', alpha2: 'MX', alpha3: 'MEX', number: 484, dialingCode: 52 },
	{ name: 'Micronesia (Federated States of)', alpha2: 'FM', alpha3: 'FSM', number: 583, dialingCode: 691 },
	{ name: 'Moldova (Republic of)', alpha2: 'MD', alpha3: 'MDA', number: 498, dialingCode: 373 },
	{ name: 'Monaco', alpha2: 'MC', alpha3: 'MCO', number: 492, dialingCode: 377 },
	{ name: 'Mongolia', alpha2: 'MN', alpha3: 'MNG', number: 496, dialingCode: 976 },
	{ name: 'Montenegro', alpha2: 'ME', alpha3: 'MNE', number: 499, dialingCode: 382 },
	{ name: 'Montserrat', alpha2: 'MS', alpha3: 'MSR', number: 500, dialingCode: 1 },
	{ name: 'Morocco', alpha2: 'MA', alpha3: 'MAR', number: 504, dialingCode: 212 },
	{ name: 'Mozambique', alpha2: 'MZ', alpha3: 'MOZ', number: 508, dialingCode: 258 },
	{ name: 'Myanmar', alpha2: 'MM', alpha3: 'MMR', number: 104, dialingCode: 95 },
	{ name: 'Namibia', alpha2: 'NA', alpha3: 'NAM', number: 516, dialingCode: 264 },
	{ name: 'Nauru', alpha2: 'NR', alpha3: 'NRU', number: 520, dialingCode: 674 },
	{ name: 'Nepal', alpha2: 'NP', alpha3: 'NPL', number: 524, dialingCode: 977 },
	{ name: 'Netherlands', alpha2: 'NL', alpha3: 'NLD', number: 528, dialingCode: 31 },
	{ name: 'New Caledonia', alpha2: 'NC', alpha3: 'NCL', number: 540, dialingCode: 687 },
	{ name: 'New Zealand', alpha2: 'NZ', alpha3: 'NZL', number: 554, dialingCode: 64 },
	{ name: 'Nicaragua', alpha2: 'NI', alpha3: 'NIC', number: 558, dialingCode: 505 },
	{ name: 'Niger', alpha2: 'NE', alpha3: 'NER', number: 562, dialingCode: 227 },
	{ name: 'Nigeria', alpha2: 'NG', alpha3: 'NGA', number: 566, dialingCode: 234 },
	{ name: 'Niue', alpha2: 'NU', alpha3: 'NIU', number: 570, dialingCode: 683 },
	{ name: 'Norfolk Island', alpha2: 'NF', alpha3: 'NFK', number: 574, dialingCode: 672 },
	{ name: 'North Macedonia', alpha2: 'MK', alpha3: 'MKD', number: 807, dialingCode: 389 },
	{ name: 'Northern Mariana Islands', alpha2: 'MP', alpha3: 'MNP', number: 580, dialingCode: 1 },
	{ name: 'Norway', alpha2: 'NO', alpha3: 'NOR', number: 578, dialingCode: 47 },
	{ name: 'Oman', alpha2: 'OM', alpha3: 'OMN', number: 512, dialingCode: 968 },
	{ name: 'Pakistan', alpha2: 'PK', alpha3: 'PAK', number: 586, dialingCode: 92 },
	{ name: 'Palau', alpha2: 'PW', alpha3: 'PLW', number: 585, dialingCode: 680 },
	{ name: 'Palestine, State of', alpha2: 'PS', alpha3: 'PSE', number: 275, dialingCode: 970 },
	{ name: 'Panama', alpha2: 'PA', alpha3: 'PAN', number: 591, dialingCode: 507 },
	{ name: 'Papua New Guinea', alpha2: 'PG', alpha3: 'PNG', number: 598, dialingCode: 675 },
	{ name: 'Paraguay', alpha2: 'PY', alpha3: 'PRY', number: 600, dialingCode: 595 },
	{ name: 'Peru', alpha2: 'PE', alpha3: 'PER', number: 604, dialingCode: 51 },
	{ name: 'Philippines', alpha2: 'PH', alpha3: 'PHL', number: 608, dialingCode: 63 },
	{ name: 'Pitcairn', alpha2: 'PN', alpha3: 'PCN', number: 612, dialingCode: 870 },
	{ name: 'Poland', alpha2: 'PL', alpha3: 'POL', number: 616, dialingCode: 48 },
	{ name: 'Portugal', alpha2: 'PT', alpha3: 'PRT', number: 620, dialingCode: 351 },
	{ name: 'Puerto Rico', alpha2: 'PR', alpha3: 'PRI', number: 630, dialingCode: 1 },
	{ name: 'Qatar', alpha2: 'QA', alpha3: 'QAT', number: 634, dialingCode: 974 },
	{ name: 'Réunion', alpha2: 'RE', alpha3: 'REU', number: 638, dialingCode: 262 },
	{ name: 'Romania', alpha2: 'RO', alpha3: 'ROU', number: 642, dialingCode: 40 },
	{ name: 'Russian Federation', alpha2: 'RU', alpha3: 'RUS', number: 643, dialingCode: 7 },
	{ name: 'Rwanda', alpha2: 'RW', alpha3: 'RWA', number: 646, dialingCode: 250 },
	{ name: 'Saint Barthélemy', alpha2: 'BL', alpha3: 'BLM', number: 652, dialingCode: 590 },
	{ name: 'Saint Helena, Ascension and Tristan da Cunha', alpha2: 'SH', alpha3: 'SHN', number: 654, dialingCode: 290 },
	{ name: 'Saint Kitts and Nevis', alpha2: 'KN', alpha3: 'KNA', number: 659, dialingCode: 1 },
	{ name: 'Saint Lucia', alpha2: 'LC', alpha3: 'LCA', number: 662, dialingCode: 1 },
	{ name: 'Saint Martin (French part)', alpha2: 'MF', alpha3: 'MAF', number: 663, dialingCode: 590 },
	{ name: 'Saint Pierre and Miquelon', alpha2: 'PM', alpha3: 'SPM', number: 666, dialingCode: 508 },
	{ name: 'Saint Vincent and the Grenadines', alpha2: 'VC', alpha3: 'VCT', number: 670, dialingCode: 1 },
	{ name: 'Samoa', alpha2: 'WS', alpha3: 'WSM', number: 882, dialingCode: 685 },
	{ name: 'San Marino', alpha2: 'SM', alpha3: 'SMR', number: 674, dialingCode: 378 },
	{ name: 'Sao Tome and Principe', alpha2: 'ST', alpha3: 'STP', number: 678, dialingCode: 239 },
	{ name: 'Saudi Arabia', alpha2: 'SA', alpha3: 'SAU', number: 682, dialingCode: 966 },
	{ name: 'Senegal', alpha2: 'SN', alpha3: 'SEN', number: 686, dialingCode: 221 },
	{ name: 'Serbia', alpha2: 'RS', alpha3: 'SRB', number: 688, dialingCode: 381 },
	{ name: 'Seychelles', alpha2: 'SC', alpha3: 'SYC', number: 690, dialingCode: 248 },
	{ name: 'Sierra Leone', alpha2: 'SL', alpha3: 'SLE', number: 694, dialingCode: 232 },
	{ name: 'Singapore', alpha2: 'SG', alpha3: 'SGP', number: 702, dialingCode: 65 },
	{ name: 'Sint Maarten (Dutch part)', alpha2: 'SX', alpha3: 'SXM', number: 534, dialingCode: 1 },
	{ name: 'Slovakia', alpha2: 'SK', alpha3: 'SVK', number: 703, dialingCode: 421 },
	{ name: 'Slovenia', alpha2: 'SI', alpha3: 'SVN', number: 705, dialingCode: 386 },
	{ name: 'Solomon Islands', alpha2: 'SB', alpha3: 'SLB', number: 90, dialingCode: 677 },
	{ name: 'Somalia', alpha2: 'SO', alpha3: 'SOM', number: 706, dialingCode: 252 },
	{ name: 'South Africa', alpha2: 'ZA', alpha3: 'ZAF', number: 710, dialingCode: 27 },
	{ name: 'South Georgia and the South Sandwich Islands', alpha2: 'GS', alpha3: 'SGS', number: 239, dialingCode: 500 },
	{ name: 'South Sudan', alpha2: 'SS', alpha3: 'SSD', number: 728, dialingCode: 211 },
	{ name: 'Spain', alpha2: 'ES', alpha3: 'ESP', number: 724, dialingCode: 34 },
	{ name: 'Sri Lanka', alpha2: 'LK', alpha3: 'LKA', number: 144, dialingCode: 94 },
	{ name: 'Sudan', alpha2: 'SD', alpha3: 'SDN', number: 729, dialingCode: 249 },
	{ name: 'Suriname', alpha2: 'SR', alpha3: 'SUR', number: 740, dialingCode: 597 },
	{ name: 'Svalbard and Jan Mayen', alpha2: 'SJ', alpha3: 'SJM', number: 744, dialingCode: 47 },
	{ name: 'Sweden', alpha2: 'SE', alpha3: 'SWE', number: 752, dialingCode: 46 },
	{ name: 'Switzerland', alpha2: 'CH', alpha3: 'CHE', number: 756, dialingCode: 41 },
	{ name: 'Syrian Arab Republic', alpha2: 'SY', alpha3: 'SYR', number: 760, dialingCode: 963 },
	{ name: 'Taiwan, Province of China', alpha2: 'TW', alpha3: 'TWN', number: 158, dialingCode: 886 },
	{ name: 'Tajikistan', alpha2: 'TJ', alpha3: 'TJK', number: 762, dialingCode: 992 },
	{ name: 'Tanzania, United Republic of', alpha2: 'TZ', alpha3: 'TZA', number: 834, dialingCode: 255 },
	{ name: 'Thailand', alpha2: 'TH', alpha3: 'THA', number: 764, dialingCode: 66 },
	{ name: 'Timor-Leste', alpha2: 'TL', alpha3: 'TLS', number: 626, dialingCode: 670 },
	{ name: 'Togo', alpha2: 'TG', alpha3: 'TGO', number: 768, dialingCode: 228 },
	{ name: 'Tokelau', alpha2: 'TK', alpha3: 'TKL', number: 772, dialingCode: 690 },
	{ name: 'Tonga', alpha2: 'TO', alpha3: 'TON', number: 776, dialingCode: 676 },
	{ name: 'Trinidad and Tobago', alpha2: 'TT', alpha3: 'TTO', number: 780, dialingCode: 1 },
	{ name: 'Tunisia', alpha2: 'TN', alpha3: 'TUN', number: 788, dialingCode: 216 },
	{ name: 'Turkey', alpha2: 'TR', alpha3: 'TUR', number: 792, dialingCode: 90 },
	{ name: 'Turkmenistan', alpha2: 'TM', alpha3: 'TKM', number: 795, dialingCode: 993 },
	{ name: 'Turks and Caicos Islands', alpha2: 'TC', alpha3: 'TCA', number: 796, dialingCode: 1 },
	{ name: 'Tuvalu', alpha2: 'TV', alpha3: 'TUV', number: 798, dialingCode: 688 },
	{ name: 'Uganda', alpha2: 'UG', alpha3: 'UGA', number: 800, dialingCode: 256 },
	{ name: 'Ukraine', alpha2: 'UA', alpha3: 'UKR', number: 804, dialingCode: 380 },
	{ name: 'United Arab Emirates', alpha2: 'AE', alpha3: 'ARE', number: 784, dialingCode: 971 },
	{ name: 'United Kingdom of Great Britain and Northern Ireland', alpha2: 'GB', alpha3: 'GBR', number: 826, dialingCode: 44 },
	{ name: 'United States of America', alpha2: 'US', alpha3: 'USA', number: 840, dialingCode: 1 },
	{ name: 'United States Minor Outlying Islands', alpha2: 'UM', alpha3: 'UMI', number: 581, dialingCode: 1 },
	{ name: 'Uruguay', alpha2: 'UY', alpha3: 'URY', number: 858, dialingCode: 598 },
	{ name: 'Uzbekistan', alpha2: 'UZ', alpha3: 'UZB', number: 860, dialingCode: 998 },
	{ name: 'Vanuatu', alpha2: 'VU', alpha3: 'VUT', number: 548, dialingCode: 678 },
	{ name: 'Venezuela (Bolivarian Republic of)', alpha2: 'VE', alpha3: 'VEN', number: 862, dialingCode: 58 },
	{ name: 'Viet Nam', alpha2: 'VN', alpha3: 'VNM', number: 704, dialingCode: 84 },
	{ name: 'Virgin Islands (British)', alpha2: 'VG', alpha3: 'VGB', number: 92, dialingCode: 1 },
	{ name: 'Virgin Islands (U.S.)', alpha2: 'VI', alpha3: 'VIR', number: 850, dialingCode: 1 },
	{ name: 'Wallis and Futuna', alpha2: 'WF', alpha3: 'WLF', number: 876, dialingCode: 681 },
	{ name: 'Western Sahara', alpha2: 'EH', alpha3: 'ESH', number: 732, dialingCode: 212 },
	{ name: 'Yemen', alpha2: 'YE', alpha3: 'YEM', number: 887, dialingCode: 967 },
	{ name: 'Zambia', alpha2: 'ZM', alpha3: 'ZMB', number: 894, dialingCode: 260 },
	{ name: 'Zimbabwe', alpha2: 'ZW', alpha3: 'ZWE', number: 716, dialingCode: 263 },
];

export class Migrations1762213450560 implements MigrationInterface {
    name = 'Migrations1762213450560'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "core"`);
        await queryRunner.query(`CREATE TABLE "core"."address" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "line1" text NOT NULL, "line2" text, "city" text NOT NULL, "unit" text NOT NULL, "postal_code" text NOT NULL, "country" character(2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d92de1f82754668b5f5f5dd4fd5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."agent_company" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "legacy_id" uuid NOT NULL, "email" text NOT NULL, "name" text NOT NULL, "phone" text NOT NULL, "tax_id" text, "tax_id_hashed" text, "use_ssn" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_222e1946725ccea0674ecf75b2e" UNIQUE ("email"), CONSTRAINT "PK_81fca3f58e8f54e10c46adb07d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."agent" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agent_id" bigint, "title" text, "first_name" text NOT NULL, "middle_name" text, "last_name" text NOT NULL, "suffix" text, "preferred_name" text, "birth_date" TIMESTAMP WITH TIME ZONE, "lifecycle_status" text, "last_modified" TIMESTAMP WITH TIME ZONE, "system_id" integer, "seed_agent" boolean NOT NULL DEFAULT false, "join_date" TIMESTAMP WITH TIME ZONE, "anniversary_date" TIMESTAMP WITH TIME ZONE, "termination_date" TIMESTAMP WITH TIME ZONE, "is_staff" boolean NOT NULL DEFAULT false, "agent_company_id" uuid NOT NULL, CONSTRAINT "PK_1000e989398c5d4ed585cf9a46f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."agent_address" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agent_id" uuid NOT NULL, "address_id" uuid NOT NULL, "role" character varying(20), "is_primary" boolean NOT NULL DEFAULT false, "valid_from" date, "valid_to" date, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7b8b0514632bffdf8d13afbc9de" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."company" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "email" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b0fc567cf51b1cf717a9e8046a1" UNIQUE ("email"), CONSTRAINT "PK_056f7854a7afdba7cbd6d45fc20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."office" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "office_id" bigint NOT NULL, "website" text, "name" text NOT NULL, "phone" text NOT NULL, "lifecycle_status" text NOT NULL, "primary_state" character varying(200) NOT NULL, CONSTRAINT "PK_200185316ba169fda17e3b6ba00" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."external_reference" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "system_code" text NOT NULL, "ref_key" text NOT NULL, "ref_value" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_02611658e0d81ce42303ab9ab90" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."agent_external_reference" ("agent_id" uuid NOT NULL, "external_reference_id" uuid NOT NULL, CONSTRAINT "PK_779b87a2e3cb41adc63b014852b" PRIMARY KEY ("agent_id", "external_reference_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."office_external_reference" ("office_id" uuid NOT NULL, "external_reference_id" uuid NOT NULL, CONSTRAINT "PK_625031fa773b30175e134c748e2" PRIMARY KEY ("office_id", "external_reference_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."company_external_reference" ("company_id" uuid NOT NULL, "external_reference_id" uuid NOT NULL, CONSTRAINT "PK_200241f196ec4223ba9ac05784f" PRIMARY KEY ("company_id", "external_reference_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."agent_office" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "is_primary" boolean NOT NULL, "agent_id" uuid NOT NULL, "office_id" uuid NOT NULL, CONSTRAINT "PK_93b7fd326a55886fd710554e002" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."pay_plan" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "active" boolean NOT NULL, "agent_percentage" numeric NOT NULL, "cap" numeric NOT NULL, CONSTRAINT "PK_045653ccd9e77d0113555158a50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."payment_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agent_id" uuid NOT NULL, "pay_plan_id" uuid, "cap_reset_date" TIMESTAMP WITH TIME ZONE NOT NULL, "split_check" boolean NOT NULL, "cap_reset_date_changed_by_user" boolean NOT NULL, CONSTRAINT "PK_78624861ce2178d6835fb1d9fdf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."payment_settings_variant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_settings" uuid NOT NULL, "custom_name" text NOT NULL, "value" numeric NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE NOT NULL, "end_date" TIMESTAMP WITH TIME ZONE NOT NULL, "type" text NOT NULL, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8ac543d2cddcf990f692984b917" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."plan_variant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "payment_settings" uuid NOT NULL, "name" text NOT NULL, "default_value" numeric NOT NULL, "is_default" boolean NOT NULL, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_0b62512c4a6c0945084a77e4e1e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."pay_plan_variant" ("variant_id" character varying NOT NULL, "pay_plan_id" uuid NOT NULL, "value" numeric NOT NULL, CONSTRAINT "PK_bb836ce1d1d99ad8d87a30ad9c9" PRIMARY KEY ("variant_id", "pay_plan_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."language" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "code" text NOT NULL, "supported" boolean NOT NULL, CONSTRAINT "PK_cc0a99e710eb3733f6fb42b1d4c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."agent_language" ("agent_id" uuid NOT NULL, "language_id" uuid NOT NULL, CONSTRAINT "PK_8842aab9c9a91b69f92aa477284" PRIMARY KEY ("agent_id", "language_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."public_profile" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "agent_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cbc966fdb35f93df14e23be606f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."contact_method" ("id" SERIAL NOT NULL, "name" text NOT NULL, "channel" text NOT NULL, "sub_type" text, "value" text NOT NULL, "is_primary" boolean NOT NULL DEFAULT false, "sms_opt_in" boolean, "agent_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ee65af2b1bc0c820a934549b8ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."email_forward" ("id" SERIAL NOT NULL, "recipient_id" text NOT NULL, "verified_last_checked" TIMESTAMP WITH TIME ZONE, "verified" boolean NOT NULL DEFAULT false, "created" TIMESTAMP WITH TIME ZONE NOT NULL, "forward_id" text NOT NULL, "recipient_created" TIMESTAMP WITH TIME ZONE, "verified_date" TIMESTAMP WITH TIME ZONE, "language" text, CONSTRAINT "PK_734c0c3095c261b10af0ef66c0d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."social" ("id" SERIAL NOT NULL, "context" text NOT NULL, "value" text NOT NULL, CONSTRAINT "PK_645aa1cff2b9f7b0e3e73d66b4d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."specialty" ("id" BIGSERIAL NOT NULL, "name" text NOT NULL, CONSTRAINT "PK_9cf4ae334dc4a1ab1e08956460e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."agent_specialty" ("agent_uuid" uuid NOT NULL, "public_profile_id" uuid NOT NULL, "specialty_id" bigint NOT NULL, CONSTRAINT "PK_44e0e62141ba0c5ef301911d73d" PRIMARY KEY ("agent_uuid", "public_profile_id", "specialty_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."mls" ("mlsId" BIGSERIAL NOT NULL, "ouid" text, "global_id" integer, "lifecycle_status" text NOT NULL, "name" text NOT NULL, "short_name" text, "website" text, "org_type" text NOT NULL, "larversion_url" text, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, "modified_by" text NOT NULL, "address_id" uuid, CONSTRAINT "PK_305dab3fd4701ed4e20a909882d" PRIMARY KEY ("mlsId"))`);
        await queryRunner.query(`CREATE TABLE "core"."agent_mls" ("agent_id" uuid NOT NULL, "mls_id" bigint NOT NULL, CONSTRAINT "PK_6456ca7bc0bf569622f7edef94c" PRIMARY KEY ("agent_id", "mls_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."active_location" ("name" text NOT NULL, "agent_id" uuid NOT NULL, "postal_code" text NOT NULL, "city" text NOT NULL, "is_primary" boolean NOT NULL, CONSTRAINT "PK_4b916ae5038c6500269ffb9bf75" PRIMARY KEY ("name", "agent_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."line_of_business" ("id" BIGSERIAL NOT NULL, "name" text NOT NULL, CONSTRAINT "PK_38eeccc38228d3292b3b17d7bb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."license" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expiration_date" date, "is_primary" boolean NOT NULL, "type" character varying(50) NOT NULL, "first_name" text NOT NULL, "middle_name" text, "last_name" text NOT NULL, "suffix" text, "number" text NOT NULL, "line_of_business_id" bigint NOT NULL, "state_id" uuid NOT NULL, CONSTRAINT "PK_f168ac1ca5ba87286d03b2ef905" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."note" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor" text NOT NULL, "body" text NOT NULL, "date" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_96d0c172a4fba276b1bbed43058" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."lifecycle_event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor" text NOT NULL, "effective_date" TIMESTAMP WITH TIME ZONE NOT NULL, "type" text NOT NULL, "active" boolean NOT NULL, "note_id" uuid, CONSTRAINT "PK_b177ca4094a0ad252a3d4fbe1db" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."license_event" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "license_id" uuid NOT NULL, "actor" text NOT NULL, "date" TIMESTAMP WITH TIME ZONE NOT NULL, "type" text NOT NULL, "status" text NOT NULL, CONSTRAINT "PK_231e1b96cadf77c359ab5e29aa3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."relationship" ("subject_agent_id" uuid NOT NULL, "object_agent_id" uuid NOT NULL, "type" text NOT NULL, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, "created" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_e007321642d496398c3061b8a0f" PRIMARY KEY ("subject_agent_id", "object_agent_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."sponsor_configuration" ("agent_id" uuid NOT NULL, "uuid" uuid NOT NULL, "buffer" integer NOT NULL, "sponsor_buffer_override" boolean NOT NULL, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_3bd437c9c4156a640041aada603" PRIMARY KEY ("agent_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."country" ("country_id" SERIAL NOT NULL, "name" text NOT NULL, "alpha_2" character varying(2) NOT NULL, "alpha_3" character varying(3) NOT NULL, "number" integer NOT NULL, "dialing_code" integer NOT NULL, CONSTRAINT "UQ_2cba84a119181c84721bdfcb559" UNIQUE ("alpha_2"), CONSTRAINT "UQ_37ef805396783b4cb210931c32e" UNIQUE ("alpha_3"), CONSTRAINT "UQ_9b0f16e109c6741810c08f99ebf" UNIQUE ("number"), CONSTRAINT "PK_220fe368500f103cf873b01f159" PRIMARY KEY ("country_id"))`);
        
        // Seed ISO 3166-1 country data
        for (const country of COUNTRIES) {
            await queryRunner.query(
                `INSERT INTO "core"."country" ("name", "alpha_2", "alpha_3", "number", "dialing_code") VALUES ($1, $2, $3, $4, $5)`,
                [country.name, country.alpha2, country.alpha3, country.number, country.dialingCode]
            );
        }
        
        await queryRunner.query(`CREATE TABLE "core"."region" ("id" BIGSERIAL NOT NULL, "name" text NOT NULL, CONSTRAINT "PK_5f48ffc3af96bc486f5f3f3a6da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."state" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "code" text NOT NULL, "is_active" boolean NOT NULL, "email" text, "signature_distribution_email" text, "last_modified" TIMESTAMP WITH TIME ZONE NOT NULL, "modified_by" text NOT NULL, "region_id" bigint NOT NULL, CONSTRAINT "PK_549ffd046ebab1336c3a8030a12" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."program" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, CONSTRAINT "PK_3bade5945afbafefdd26a3a29fb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."state_program" ("state_id" uuid NOT NULL, "program_id" uuid NOT NULL, CONSTRAINT "PK_34616f86d0ce70cf7a2fa3b3a69" PRIMARY KEY ("state_id", "program_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."organization_contact" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "email" text, "phone" text, "address" text, CONSTRAINT "PK_1b315ca37fec4b8bdbdf1b59d28" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."w9" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tin" text NOT NULL, "legal_name" text NOT NULL, "business_name" text, "federal_tax_classification" text NOT NULL, "federal_tax_classification_other" text, "exempt_payee_code" text, "exemption_from_fatca_reporting_code" text, "signature_date" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5879bda5407305a0b5efc98234a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."w9_address" ("w9_id" uuid NOT NULL, "address_id" uuid NOT NULL, CONSTRAINT "PK_77691a4ca50a7d82515aff38536" PRIMARY KEY ("w9_id", "address_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."tax" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tax_id" text NOT NULL, "type" text NOT NULL, "jurisdiction" text NOT NULL, "rate" numeric(10,4), "effective_date" TIMESTAMP WITH TIME ZONE, "expiration_date" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_2c1e62c595571139e2fb0e9c319" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."office_address" ("office_id" uuid NOT NULL, "address_id" uuid NOT NULL, CONSTRAINT "PK_cf2885779369d5f8aedefa01285" PRIMARY KEY ("office_id", "address_id"))`);
        await queryRunner.query(`CREATE TABLE "core"."artifact" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" text NOT NULL, "name" text NOT NULL, "url" text, "storage_key" text, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1f238d1d4ef8f85d0c0b8616fa3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."custom_flag" ("flagId" BIGSERIAL NOT NULL, "name" text NOT NULL, "type" text NOT NULL, "scope" text NOT NULL, "active" boolean NOT NULL, "delete_in_progress" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_6da375da9920e2e2969998b3ae5" PRIMARY KEY ("flagId"))`);
        await queryRunner.query(`CREATE TABLE "core"."fee" ("id" BIGSERIAL NOT NULL, "name" text NOT NULL, "active" boolean NOT NULL, "value" numeric(10,2) NOT NULL, "paid_by" text, "is_third_party" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_ee7e51cc563615bc60c2b234635" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "core"."approval" ("approvalId" BIGSERIAL NOT NULL, "approval_state" text NOT NULL, "decision_date" TIMESTAMP WITH TIME ZONE, "counters" integer, "template" text, "note" text, "prerequisite" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_02de44a875038b4b24888b7df16" PRIMARY KEY ("approvalId"))`);
        await queryRunner.query(`ALTER TABLE "core"."agent" ADD CONSTRAINT "FK_14ce21569e369a956eb6ddb2418" FOREIGN KEY ("agent_company_id") REFERENCES "core"."agent_company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_address" ADD CONSTRAINT "FK_ed7593c82395637aae5cf16b8a1" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_address" ADD CONSTRAINT "FK_d3f14a22292694dfea3c4a76ce0" FOREIGN KEY ("address_id") REFERENCES "core"."address"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_external_reference" ADD CONSTRAINT "FK_06901b006017fd684530a1e83be" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_external_reference" ADD CONSTRAINT "FK_371e073358b18d22272471303f3" FOREIGN KEY ("external_reference_id") REFERENCES "core"."external_reference"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."office_external_reference" ADD CONSTRAINT "FK_bf9d6c6c7c8ce63e0326f4a51b4" FOREIGN KEY ("office_id") REFERENCES "core"."office"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."office_external_reference" ADD CONSTRAINT "FK_21ff193616770559463efbf0396" FOREIGN KEY ("external_reference_id") REFERENCES "core"."external_reference"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."company_external_reference" ADD CONSTRAINT "FK_7bd4e4fea1796610564375c3c08" FOREIGN KEY ("company_id") REFERENCES "core"."company"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."company_external_reference" ADD CONSTRAINT "FK_a68028cbd877226314c8ca64e3a" FOREIGN KEY ("external_reference_id") REFERENCES "core"."external_reference"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_office" ADD CONSTRAINT "FK_f5ec523ddd694262dfccc237284" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_office" ADD CONSTRAINT "FK_a9e9433cfd2dda289a647c12c45" FOREIGN KEY ("office_id") REFERENCES "core"."office"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."payment_settings" ADD CONSTRAINT "FK_c6c5a8a6ed6f2e305f9d6a5c59d" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."payment_settings" ADD CONSTRAINT "FK_7a2c7a6c88abf797930ffc653ea" FOREIGN KEY ("pay_plan_id") REFERENCES "core"."pay_plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."payment_settings_variant" ADD CONSTRAINT "FK_2bb8dceb306b3665661162ab7f7" FOREIGN KEY ("payment_settings") REFERENCES "core"."payment_settings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."pay_plan_variant" ADD CONSTRAINT "FK_8decb671307ed20ad34ee9860bf" FOREIGN KEY ("pay_plan_id") REFERENCES "core"."pay_plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_language" ADD CONSTRAINT "FK_655274b2246207a662e3940b0d4" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_language" ADD CONSTRAINT "FK_c58ded607e284db17d03e9eb20b" FOREIGN KEY ("language_id") REFERENCES "core"."language"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."public_profile" ADD CONSTRAINT "FK_eecbfbc7a84edead08eb36569a0" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."contact_method" ADD CONSTRAINT "FK_9f5089b30e8bed603cb632c1292" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_specialty" ADD CONSTRAINT "FK_45f4f33bd107799801e5b58cfaa" FOREIGN KEY ("agent_uuid") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_specialty" ADD CONSTRAINT "FK_8a2867d41502fcf87b7f86b9435" FOREIGN KEY ("public_profile_id") REFERENCES "core"."public_profile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_specialty" ADD CONSTRAINT "FK_603cf1d694df3553853a64f7700" FOREIGN KEY ("specialty_id") REFERENCES "core"."specialty"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."mls" ADD CONSTRAINT "FK_7074a63c12a6454117ad5c3f3a3" FOREIGN KEY ("address_id") REFERENCES "core"."address"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_mls" ADD CONSTRAINT "FK_65aaa3aaf76c2e3a557e4b72bc7" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."agent_mls" ADD CONSTRAINT "FK_b0f6195e4793254861d50da989a" FOREIGN KEY ("mls_id") REFERENCES "core"."mls"("mlsId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."active_location" ADD CONSTRAINT "FK_7c84c989350ac029668479b6933" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."license" ADD CONSTRAINT "FK_289562756cc37e8d157d1f765ff" FOREIGN KEY ("line_of_business_id") REFERENCES "core"."line_of_business"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."lifecycle_event" ADD CONSTRAINT "FK_e4505f8f9ac2216166bdec75cc9" FOREIGN KEY ("note_id") REFERENCES "core"."note"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."license_event" ADD CONSTRAINT "FK_8af0ee4cdd3e606b0912283ff2c" FOREIGN KEY ("license_id") REFERENCES "core"."license"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."relationship" ADD CONSTRAINT "FK_02daa286e72a57e9827ff64580f" FOREIGN KEY ("subject_agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."relationship" ADD CONSTRAINT "FK_8c55ce25553956a1f009b5beda9" FOREIGN KEY ("object_agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."sponsor_configuration" ADD CONSTRAINT "FK_3bd437c9c4156a640041aada603" FOREIGN KEY ("agent_id") REFERENCES "core"."agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."state" ADD CONSTRAINT "FK_8349ce36d37d8f89fd9dc8fa002" FOREIGN KEY ("region_id") REFERENCES "core"."region"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."state_program" ADD CONSTRAINT "FK_a9ec7704f7c2a41971e32f37629" FOREIGN KEY ("state_id") REFERENCES "core"."state"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."state_program" ADD CONSTRAINT "FK_e7e44a9cccc1cf53b320659d265" FOREIGN KEY ("program_id") REFERENCES "core"."program"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."w9_address" ADD CONSTRAINT "FK_354b1ce03fc57661b01ed3fb54f" FOREIGN KEY ("w9_id") REFERENCES "core"."w9"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."w9_address" ADD CONSTRAINT "FK_74a7167ce3bb8d99e684ba5f245" FOREIGN KEY ("address_id") REFERENCES "core"."address"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."office_address" ADD CONSTRAINT "FK_f43f4200662b0ce7beddd29c3f5" FOREIGN KEY ("office_id") REFERENCES "core"."office"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "core"."office_address" ADD CONSTRAINT "FK_78be10b4116a9772d6f763c4301" FOREIGN KEY ("address_id") REFERENCES "core"."address"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "core"."office_address" DROP CONSTRAINT "FK_78be10b4116a9772d6f763c4301"`);
        await queryRunner.query(`ALTER TABLE "core"."office_address" DROP CONSTRAINT "FK_f43f4200662b0ce7beddd29c3f5"`);
        await queryRunner.query(`ALTER TABLE "core"."w9_address" DROP CONSTRAINT "FK_74a7167ce3bb8d99e684ba5f245"`);
        await queryRunner.query(`ALTER TABLE "core"."w9_address" DROP CONSTRAINT "FK_354b1ce03fc57661b01ed3fb54f"`);
        await queryRunner.query(`ALTER TABLE "core"."state_program" DROP CONSTRAINT "FK_e7e44a9cccc1cf53b320659d265"`);
        await queryRunner.query(`ALTER TABLE "core"."state_program" DROP CONSTRAINT "FK_a9ec7704f7c2a41971e32f37629"`);
        await queryRunner.query(`ALTER TABLE "core"."state" DROP CONSTRAINT "FK_8349ce36d37d8f89fd9dc8fa002"`);
        await queryRunner.query(`ALTER TABLE "core"."sponsor_configuration" DROP CONSTRAINT "FK_3bd437c9c4156a640041aada603"`);
        await queryRunner.query(`ALTER TABLE "core"."relationship" DROP CONSTRAINT "FK_8c55ce25553956a1f009b5beda9"`);
        await queryRunner.query(`ALTER TABLE "core"."relationship" DROP CONSTRAINT "FK_02daa286e72a57e9827ff64580f"`);
        await queryRunner.query(`ALTER TABLE "core"."license_event" DROP CONSTRAINT "FK_8af0ee4cdd3e606b0912283ff2c"`);
        await queryRunner.query(`ALTER TABLE "core"."lifecycle_event" DROP CONSTRAINT "FK_e4505f8f9ac2216166bdec75cc9"`);
        await queryRunner.query(`ALTER TABLE "core"."license" DROP CONSTRAINT "FK_289562756cc37e8d157d1f765ff"`);
        await queryRunner.query(`ALTER TABLE "core"."active_location" DROP CONSTRAINT "FK_7c84c989350ac029668479b6933"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_mls" DROP CONSTRAINT "FK_b0f6195e4793254861d50da989a"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_mls" DROP CONSTRAINT "FK_65aaa3aaf76c2e3a557e4b72bc7"`);
        await queryRunner.query(`ALTER TABLE "core"."mls" DROP CONSTRAINT "FK_7074a63c12a6454117ad5c3f3a3"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_specialty" DROP CONSTRAINT "FK_603cf1d694df3553853a64f7700"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_specialty" DROP CONSTRAINT "FK_8a2867d41502fcf87b7f86b9435"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_specialty" DROP CONSTRAINT "FK_45f4f33bd107799801e5b58cfaa"`);
        await queryRunner.query(`ALTER TABLE "core"."contact_method" DROP CONSTRAINT "FK_9f5089b30e8bed603cb632c1292"`);
        await queryRunner.query(`ALTER TABLE "core"."public_profile" DROP CONSTRAINT "FK_eecbfbc7a84edead08eb36569a0"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_language" DROP CONSTRAINT "FK_c58ded607e284db17d03e9eb20b"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_language" DROP CONSTRAINT "FK_655274b2246207a662e3940b0d4"`);
        await queryRunner.query(`ALTER TABLE "core"."pay_plan_variant" DROP CONSTRAINT "FK_8decb671307ed20ad34ee9860bf"`);
        await queryRunner.query(`ALTER TABLE "core"."payment_settings_variant" DROP CONSTRAINT "FK_2bb8dceb306b3665661162ab7f7"`);
        await queryRunner.query(`ALTER TABLE "core"."payment_settings" DROP CONSTRAINT "FK_7a2c7a6c88abf797930ffc653ea"`);
        await queryRunner.query(`ALTER TABLE "core"."payment_settings" DROP CONSTRAINT "FK_c6c5a8a6ed6f2e305f9d6a5c59d"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_office" DROP CONSTRAINT "FK_a9e9433cfd2dda289a647c12c45"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_office" DROP CONSTRAINT "FK_f5ec523ddd694262dfccc237284"`);
        await queryRunner.query(`ALTER TABLE "core"."company_external_reference" DROP CONSTRAINT "FK_a68028cbd877226314c8ca64e3a"`);
        await queryRunner.query(`ALTER TABLE "core"."company_external_reference" DROP CONSTRAINT "FK_7bd4e4fea1796610564375c3c08"`);
        await queryRunner.query(`ALTER TABLE "core"."office_external_reference" DROP CONSTRAINT "FK_21ff193616770559463efbf0396"`);
        await queryRunner.query(`ALTER TABLE "core"."office_external_reference" DROP CONSTRAINT "FK_bf9d6c6c7c8ce63e0326f4a51b4"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_external_reference" DROP CONSTRAINT "FK_371e073358b18d22272471303f3"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_external_reference" DROP CONSTRAINT "FK_06901b006017fd684530a1e83be"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_address" DROP CONSTRAINT "FK_d3f14a22292694dfea3c4a76ce0"`);
        await queryRunner.query(`ALTER TABLE "core"."agent_address" DROP CONSTRAINT "FK_ed7593c82395637aae5cf16b8a1"`);
        await queryRunner.query(`ALTER TABLE "core"."agent" DROP CONSTRAINT "FK_14ce21569e369a956eb6ddb2418"`);
        await queryRunner.query(`DROP TABLE "core"."approval"`);
        await queryRunner.query(`DROP TABLE "core"."fee"`);
        await queryRunner.query(`DROP TABLE "core"."custom_flag"`);
        await queryRunner.query(`DROP TABLE "core"."artifact"`);
        await queryRunner.query(`DROP TABLE "core"."office_address"`);
        await queryRunner.query(`DROP TABLE "core"."tax"`);
        await queryRunner.query(`DROP TABLE "core"."w9_address"`);
        await queryRunner.query(`DROP TABLE "core"."w9"`);
        await queryRunner.query(`DROP TABLE "core"."organization_contact"`);
        await queryRunner.query(`DROP TABLE "core"."state_program"`);
        await queryRunner.query(`DROP TABLE "core"."program"`);
        await queryRunner.query(`DROP TABLE "core"."state"`);
        await queryRunner.query(`DROP TABLE "core"."region"`);
        await queryRunner.query(`DROP TABLE "core"."country"`);
        await queryRunner.query(`DROP TABLE "core"."sponsor_configuration"`);
        await queryRunner.query(`DROP TABLE "core"."relationship"`);
        await queryRunner.query(`DROP TABLE "core"."license_event"`);
        await queryRunner.query(`DROP TABLE "core"."lifecycle_event"`);
        await queryRunner.query(`DROP TABLE "core"."note"`);
        await queryRunner.query(`DROP TABLE "core"."license"`);
        await queryRunner.query(`DROP TABLE "core"."line_of_business"`);
        await queryRunner.query(`DROP TABLE "core"."active_location"`);
        await queryRunner.query(`DROP TABLE "core"."agent_mls"`);
        await queryRunner.query(`DROP TABLE "core"."mls"`);
        await queryRunner.query(`DROP TABLE "core"."agent_specialty"`);
        await queryRunner.query(`DROP TABLE "core"."specialty"`);
        await queryRunner.query(`DROP TABLE "core"."social"`);
        await queryRunner.query(`DROP TABLE "core"."email_forward"`);
        await queryRunner.query(`DROP TABLE "core"."contact_method"`);
        await queryRunner.query(`DROP TABLE "core"."public_profile"`);
        await queryRunner.query(`DROP TABLE "core"."agent_language"`);
        await queryRunner.query(`DROP TABLE "core"."language"`);
        await queryRunner.query(`DROP TABLE "core"."pay_plan_variant"`);
        await queryRunner.query(`DROP TABLE "core"."plan_variant"`);
        await queryRunner.query(`DROP TABLE "core"."payment_settings_variant"`);
        await queryRunner.query(`DROP TABLE "core"."payment_settings"`);
        await queryRunner.query(`DROP TABLE "core"."pay_plan"`);
        await queryRunner.query(`DROP TABLE "core"."agent_office"`);
        await queryRunner.query(`DROP TABLE "core"."company_external_reference"`);
        await queryRunner.query(`DROP TABLE "core"."office_external_reference"`);
        await queryRunner.query(`DROP TABLE "core"."agent_external_reference"`);
        await queryRunner.query(`DROP TABLE "core"."external_reference"`);
        await queryRunner.query(`DROP TABLE "core"."office"`);
        await queryRunner.query(`DROP TABLE "core"."company"`);
        await queryRunner.query(`DROP TABLE "core"."agent_address"`);
        await queryRunner.query(`DROP TABLE "core"."agent"`);
        await queryRunner.query(`DROP TABLE "core"."agent_company"`);
        await queryRunner.query(`DROP TABLE "core"."address"`);
    }

}
