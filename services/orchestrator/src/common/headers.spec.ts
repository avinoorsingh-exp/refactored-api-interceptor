// services/orchestrator/src/common/headers.spec.ts
import { AxiosHeaders } from 'axios';
import { setHeaders, setHeader } from './headers.js';
import type { InternalAxiosRequestConfig } from 'axios';

describe('setHeaders', () => {
    describe('AxiosHeaders instance', () => {
        it('should set headers on AxiosHeaders instance', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeaders(config, {
                'content-type': 'application/json',
                'authorization': 'Bearer token123',
            });

            expect(config.headers.get('content-type')).toBe('application/json');
            expect(config.headers.get('authorization')).toBe('Bearer token123');
        });

        it('should overwrite existing headers', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            config.headers.set('content-type', 'text/plain');
            setHeaders(config, {
                'content-type': 'application/json',
            });

            expect(config.headers.get('content-type')).toBe('application/json');
        });

        it('should set multiple headers on AxiosHeaders', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeaders(config, {
                'content-type': 'application/json',
                'accept': 'application/json',
                'x-request-id': 'req-123',
                'x-correlation-id': 'corr-456',
            });

            expect(config.headers.get('content-type')).toBe('application/json');
            expect(config.headers.get('accept')).toBe('application/json');
            expect(config.headers.get('x-request-id')).toBe('req-123');
            expect(config.headers.get('x-correlation-id')).toBe('corr-456');
        });

        it('should handle empty headers object with AxiosHeaders', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeaders(config, {});

            expect(config.headers).toBeInstanceOf(AxiosHeaders);
        });

        it('should handle headers with special characters', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeaders(config, {
                'x-custom-header': 'value with spaces',
                'x-encoded': 'value%20encoded',
            });

            expect(config.headers.get('x-custom-header')).toBe('value with spaces');
            expect(config.headers.get('x-encoded')).toBe('value%20encoded');
        });
    });

    describe('Plain object headers', () => {
        it('should set headers on plain object', () => {
            const config = {
                headers: {},
            } as InternalAxiosRequestConfig;

            setHeaders(config, {
                'content-type': 'application/json',
                'x-custom-header': 'custom-value',
            });

            expect(config.headers['content-type']).toBe('application/json');
            expect(config.headers['x-custom-header']).toBe('custom-value');
        });

        it('should overwrite existing headers in plain object', () => {
            const config = {
                headers: {
                    'content-type': 'text/plain',
                },
            } as unknown as InternalAxiosRequestConfig;

            setHeaders(config, {
                'content-type': 'application/json',
            });

            expect(config.headers['content-type']).toBe('application/json');
        });

        it('should set multiple headers on plain object', () => {
            const config = {
                headers: {},
            } as InternalAxiosRequestConfig;

            setHeaders(config, {
                'header1': 'value1',
                'header2': 'value2',
                'header3': 'value3',
            });

            expect(config.headers['header1']).toBe('value1');
            expect(config.headers['header2']).toBe('value2');
            expect(config.headers['header3']).toBe('value3');
        });

        it('should handle empty headers object with plain object', () => {
            const config = {
                headers: {},
            } as InternalAxiosRequestConfig;

            setHeaders(config, {});

            expect(config.headers).toEqual({});
        });

        it('should preserve existing headers not in entries', () => {
            const config = {
                headers: {
                    'existing-header': 'existing-value',
                },
            } as unknown as InternalAxiosRequestConfig;

            setHeaders(config, {
                'new-header': 'new-value',
            });

            expect(config.headers['existing-header']).toBe('existing-value');
            expect(config.headers['new-header']).toBe('new-value');
        });
    });

    describe('Edge cases', () => {
        it('should handle headers with empty string values', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeaders(config, {
                'empty-header': '',
            });

            expect(config.headers.get('empty-header')).toBe('');
        });

        it('should handle headers with numeric string values', () => {
            const config = {
                headers: {},
            } as InternalAxiosRequestConfig;

            setHeaders(config, {
                'x-numeric': '123',
            });

            expect(config.headers['x-numeric']).toBe('123');
        });

        it('should handle case-sensitive header names', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeaders(config, {
                'Content-Type': 'application/json',
                'X-Custom': 'value',
            });

            expect(config.headers.get('Content-Type')).toBe('application/json');
            expect(config.headers.get('X-Custom')).toBe('value');
        });
    });
});

describe('setHeader', () => {
    describe('AxiosHeaders instance', () => {
        it('should set single header on AxiosHeaders instance', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeader(config, 'content-type', 'application/json');

            expect(config.headers.get('content-type')).toBe('application/json');
        });

        it('should overwrite existing header', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            config.headers.set('x-custom', 'old-value');
            setHeader(config, 'x-custom', 'new-value');

            expect(config.headers.get('x-custom')).toBe('new-value');
        });

        it('should set authorization header', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeader(config, 'authorization', 'Bearer token123');

            expect(config.headers.get('authorization')).toBe('Bearer token123');
        });

        it('should set correlation ID header', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeader(config, 'x-correlation-id', 'corr-123');

            expect(config.headers.get('x-correlation-id')).toBe('corr-123');
        });
    });

    describe('Plain object headers', () => {
        it('should set single header on plain object', () => {
            const config = {
                headers: {},
            } as InternalAxiosRequestConfig;

            setHeader(config, 'authorization', 'Bearer token');

            expect(config.headers['authorization']).toBe('Bearer token');
        });

        it('should overwrite existing header in plain object', () => {
            const config = {
                headers: {
                    'x-custom': 'old-value',
                },
            } as unknown as InternalAxiosRequestConfig;

            setHeader(config, 'x-custom', 'new-value');

            expect(config.headers['x-custom']).toBe('new-value');
        });

        it('should preserve other headers when setting one', () => {
            const config = {
                headers: {
                    'existing': 'value',
                },
            } as unknown as InternalAxiosRequestConfig;

            setHeader(config, 'new-header', 'new-value');

            expect(config.headers['existing']).toBe('value');
            expect(config.headers['new-header']).toBe('new-value');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty string value', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeader(config, 'empty-header', '');

            expect(config.headers.get('empty-header')).toBe('');
        });

        it('should handle header name with special characters', () => {
            const config = {
                headers: {},
            } as InternalAxiosRequestConfig;

            setHeader(config, 'x-custom-header', 'value');

            expect(config.headers['x-custom-header']).toBe('value');
        });

        it('should handle long header values', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            const longValue = 'a'.repeat(1000);
            setHeader(config, 'x-long-header', longValue);

            expect(config.headers.get('x-long-header')).toBe(longValue);
        });
    });

    describe('Integration with setHeaders', () => {
        it('should use setHeaders internally', () => {
            const config = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeader(config, 'test-header', 'test-value');

            expect(config.headers.get('test-header')).toBe('test-value');
        });

        it('should behave consistently with setHeaders', () => {
            const config1 = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            const config2 = {
                headers: new AxiosHeaders(),
            } as InternalAxiosRequestConfig;

            setHeader(config1, 'header', 'value');
            setHeaders(config2, { header: 'value' });

            expect(config1.headers.get('header')).toBe(config2.headers.get('header'));
        });
    });
});