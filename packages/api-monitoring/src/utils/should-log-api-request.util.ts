import { Request } from 'express';

/**
 * Determines whether an incoming request should be logged for API monitoring.
 * 
 * This is a POLICY decision to prevent development and internal UI traffic
 * from polluting production API monitoring data.
 * 
 * Returns false for:
 * - Development environment (NODE_ENV === 'development')
 * - Localhost/internal IP addresses
 * - Docker bridge/private network ranges
 * - Requests with X-Internal-Request header
 * 
 * Returns true only for legitimate external API callers.
 * 
 * @param req - Express request object
 * @returns true if the request should be logged, false otherwise
 */
export function shouldLogApiRequest(req: Request): boolean {
	// Policy: Never log in local development environments only
	// AWS dev/test/prod environments should be logged
	const nodeEnv = process.env.NODE_ENV?.toLowerCase();
	if (nodeEnv === 'development' || nodeEnv === 'local') {
		return false;
	}

	// Policy: Skip internal requests marked with header
	const internalHeader = req.get('x-internal-request');
	if (internalHeader === 'true') {
		return false;
	}

	// Extract and normalize IP address
	const ipAddress = extractIpAddress(req);
	if (!ipAddress) {
		// If we can't determine IP, err on the side of caution and skip
		return false;
	}

	// Check if IP is localhost or internal
	if (isLocalhostOrInternal(ipAddress)) {
		return false;
	}

	// Check Origin and Referer headers for localhost URLs
	const origin = req.get('origin');
	if (origin && isLocalhostUrl(origin)) {
		return false;
	}

	const referer = req.get('referer');
	if (referer && isLocalhostUrl(referer)) {
		return false;
	}

	// All checks passed - this is a legitimate external API caller
	return true;
}

/**
 * Extract client IP address from request.
 * Handles proxies and load balancers.
 */
function extractIpAddress(request: Request): string | undefined {
	// Check X-Forwarded-For header (from proxies/load balancers)
	const forwardedFor = request.get('x-forwarded-for');
	if (forwardedFor) {
		// X-Forwarded-For can contain multiple IPs, take the first one
		const ips = forwardedFor.split(',').map((ip) => ip.trim());
		const ip = ips[0];
		if (ip) {
			return ip;
		}
	}

	// Check X-Real-IP header
	const realIp = request.get('x-real-ip');
	if (realIp) {
		return realIp;
	}

	// Fall back to request IP or socket remote address
	const ip = request.ip || request.socket?.remoteAddress;
	if (ip) {
		return ip;
	}

	return undefined;
}

/**
 * Check if an IP address is localhost or internal/private.
 * 
 * Handles:
 * - IPv4 addresses (127.0.0.1, 192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 * - IPv6 addresses (::1, fc00::/7, fe80::/10)
 * - IPv6-mapped IPv4 addresses (::ffff:172.20.0.5)
 */
function isLocalhostOrInternal(ip: string): boolean {
	if (!ip) {
		return false;
	}

	// Remove IPv6 brackets if present
	let cleanIp = ip.replace(/^\[|\]$/g, '').trim();
	
	// Check for localhost strings
	if (cleanIp === 'localhost' || cleanIp === '127.0.0.1' || cleanIp === '::1') {
		return true;
	}

	// Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1 or ::ffff:172.20.0.5)
	// This is the most common case for Docker internal networks
	if (cleanIp.startsWith('::ffff:')) {
		const ipv4Part = cleanIp.substring(7); // Remove '::ffff:' prefix
		
		// Quick check: if it starts with 10., 172., or 192.168., it's private
		if (
			ipv4Part.startsWith('10.') ||
			ipv4Part.startsWith('192.168.') ||
			(ipv4Part.startsWith('172.') && is172PrivateRange(ipv4Part))
		) {
			return true;
		}
		
		// Check if the IPv4 part is localhost
		if (ipv4Part === '127.0.0.1' || ipv4Part === '0.0.0.0') {
			return true;
		}
		
		// Fallback: full private IP check
		if (isPrivateIpv4(ipv4Part)) {
			return true;
		}
	}

	// Check for IPv6 private ranges (fc00::/7, fe80::/10)
	if (cleanIp.startsWith('fc00:') || cleanIp.startsWith('fe80:')) {
		return true;
	}

	// Check if it's a pure IPv4 address in private ranges
	if (isPrivateIpv4(cleanIp)) {
		return true;
	}

	return false;
}

/**
 * Quick check if an IP address is in the 172.16-31.x.x range.
 * This is more efficient than full parsing for the common Docker case.
 */
function is172PrivateRange(ip: string): boolean {
	// Match 172.16-31.x.x pattern
	const match = ip.match(/^172\.(1[6-9]|2[0-9]|3[01])\./);
	return match !== null;
}

/**
 * Check if an IPv4 address is in private/internal ranges.
 * 
 * Private ranges:
 * - 10.0.0.0/8 (10.0.0.0 to 10.255.255.255)
 * - 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
 * - 192.168.0.0/16 (192.168.0.0 to 192.168.255.255)
 */
function isPrivateIpv4(ip: string): boolean {
	// Match IPv4 address pattern
	const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
	const match = ip.match(ipv4Regex);
	
	if (!match) {
		return false;
	}

	const octet1 = parseInt(match[1], 10);
	const octet2 = parseInt(match[2], 10);
	const octet3 = parseInt(match[3], 10);
	const octet4 = parseInt(match[4], 10);

	// Validate octets are in valid range (0-255)
	if (
		octet1 > 255 || octet2 > 255 || octet3 > 255 || octet4 > 255 ||
		octet1 < 0 || octet2 < 0 || octet3 < 0 || octet4 < 0
	) {
		return false;
	}

	// Check 10.0.0.0/8
	if (octet1 === 10) {
		return true;
	}

	// Check 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
	if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
		return true;
	}

	// Check 192.168.0.0/16
	if (octet1 === 192 && octet2 === 168) {
		return true;
	}

	return false;
}

/**
 * Check if a URL string contains localhost.
 */
function isLocalhostUrl(urlString: string): boolean {
	if (!urlString) {
		return false;
	}

	const urlLower = urlString.toLowerCase();
	
	// Quick string checks
	if (
		urlLower.includes('localhost') ||
		urlLower.includes('127.0.0.1') ||
		urlLower.startsWith('http://localhost') ||
		urlLower.startsWith('https://localhost') ||
		urlLower.startsWith('http://127.0.0.1') ||
		urlLower.startsWith('https://127.0.0.1')
	) {
		return true;
	}

	// Try parsing as URL for more precise check
	try {
		let url: URL;
		if (urlString.startsWith('http://') || urlString.startsWith('https://')) {
			url = new URL(urlString);
		} else {
			url = new URL(`https://${urlString}`);
		}

		const hostname = url.hostname.toLowerCase();
		return (
			hostname === 'localhost' ||
			hostname === '127.0.0.1' ||
			hostname === '::1' ||
			hostname.startsWith('localhost:') ||
			hostname.startsWith('127.0.0.1:') ||
			hostname.startsWith('[::1]:')
		);
	} catch {
		// If URL parsing fails, rely on string check above
		return false;
	}
}

