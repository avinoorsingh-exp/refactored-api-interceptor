// services/orchestrator/src/common/problem-details.filter.spec.ts
import { ArgumentsHost, HttpException, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { AxiosError } from 'axios';
import { ProblemDetailsFilter } from './problem-details.filter.js';
import { LoggerService } from '../core/logger.service.js';
import { UpstreamHttpError } from './ecs-http-client.js';
import { Problems, ProblemTypes, ProblemTitles, isProblemDetails } from '@exprealty/shared-domain';

describe('ProblemDetailsFilter', () => {
    let filter: ProblemDetailsFilter;
    let mockLogger: jest.Mocked<LoggerService>;
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockArgumentsHost: ArgumentsHost;

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            getMetrics: jest.fn(),
        } as any;

        mockRequest = {
            path: '/v1/countries',
            headers: {
                'x-request-id': 'test-request-id-123',
            },
        } as any;

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        } as any;

        mockArgumentsHost = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue(mockRequest),
                getResponse: jest.fn().mockReturnValue(mockResponse),
            }),
        } as any;

        filter = new ProblemDetailsFilter(mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('catch - UpstreamHttpError with upstreamProblem', () => {
        it('should handle error with upstreamProblem property', () => {
            const upstreamProblem = {
                type: ProblemTypes.BadGateway,
                title: ProblemTitles[ProblemTypes.BadGateway],
                status: 502,
                detail: 'Upstream service error',
                instance: '/upstream/path',
                traceId: 'upstream-trace-id',
            };

            const error = {
                upstreamProblem,
                message: 'Upstream error',
            };

            filter.catch(error, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(502);
            expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
            expect(mockResponse.json).toHaveBeenCalledWith({
                ...upstreamProblem,
                instance: '/v1/countries',
                traceId: 'test-request-id-123',
            });
            expect(mockLogger.warn).toHaveBeenCalledWith('Upstream provider error (HttpClient)', expect.any(Object));
        });

        it('should use instance from error if request path is empty', () => {
            const emptyPathRequest = {
                ...mockRequest,
                path: '',
            } as Request;
            const upstreamProblem = {
                type: ProblemTypes.BadGateway,
                title: ProblemTitles[ProblemTypes.BadGateway],
                status: 502,
                detail: 'Upstream service error',
                instance: '/upstream/path',
            };

            const error = { upstreamProblem };
            const argumentsHost = {
                switchToHttp: jest.fn().mockReturnValue({
                    getRequest: jest.fn().mockReturnValue(emptyPathRequest),
                    getResponse: jest.fn().mockReturnValue(mockResponse),
                }),
            } as any;

            filter.catch(error, argumentsHost);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    instance: '/upstream/path',
                }),
            );
        });
    });

    describe('catch - UpstreamHttpError instance', () => {
        it('should handle UpstreamHttpError directly', () => {
            const problem = {
                type: ProblemTypes.Timeout,
                title: ProblemTitles[ProblemTypes.Timeout],
                status: 504,
                detail: 'Request timeout',
                instance: '/timeout/path',
            };

            const error = new UpstreamHttpError('Timeout', 504, problem);

            filter.catch(error, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(504);
            expect(mockResponse.json).toHaveBeenCalledWith({
                ...problem,
                instance: '/v1/countries',
                traceId: 'test-request-id-123',
            });
            expect(mockLogger.warn).toHaveBeenCalledWith('Upstream provider error (wrapped)', expect.any(Object));
        });
    });

    describe('catch - AxiosError', () => {
        it('should handle AxiosError with Problem Details response', () => {
            const problemDetails = {
                type: ProblemTypes.NotFound,
                title: ProblemTitles[ProblemTypes.NotFound],
                status: 404,
                detail: 'Resource not found',
                instance: '/not-found',
            };

            const axiosError = new AxiosError('Not Found');
            axiosError.response = {
                status: 404,
                data: problemDetails,
            } as any;
            axiosError.config = {} as any;

            filter.catch(axiosError, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                ...problemDetails,
                instance: '/v1/countries',
                traceId: 'test-request-id-123',
            });
            expect(mockLogger.warn).toHaveBeenCalledWith('Provider returned Problem Details', expect.any(Object));
        });

        it('should handle AxiosError with structured error response', () => {
            const axiosError = new AxiosError('Bad Request');
            axiosError.response = {
                status: 400,
                data: {
                    message: 'Validation failed',
                },
            } as any;
            axiosError.config = {
                url: 'http://provider/api/endpoint',
            } as any;

            filter.catch(axiosError, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Validation,
                    status: 400,
                    detail: 'Validation failed',
                }),
            );
            expect(mockLogger.warn).toHaveBeenCalledWith('Provider HTTP error', expect.any(Object));
        });

        it('should handle AxiosError with detail field', () => {
            const axiosError = new AxiosError('Error');
            axiosError.response = {
                status: 500,
                data: {
                    detail: 'Internal server error detail',
                },
            } as any;
            axiosError.config = {} as any;

            filter.catch(axiosError, mockArgumentsHost);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: 'Internal server error detail',
                }),
            );
        });

        it('should handle AxiosError without response', () => {
            const axiosError = new AxiosError('Network Error');
            axiosError.config = {} as any;

            filter.catch(axiosError, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(502);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.BadGateway,
                    status: 502,
                    detail: 'Network Error',
                }),
            );
        });

        it('should handle AxiosError without response', () => {
            const axiosError = new AxiosError('Network Error');
            axiosError.config = {} as any;

            filter.catch(axiosError, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(502);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.BadGateway,
                    status: 502,
                    detail: 'Network Error',
                }),
            );
        });

        it('should handle AxiosError with object responseData without message or detail (line 166)', () => {
            const axiosError = new AxiosError('Fallback error message');
            axiosError.response = {
                status: 500,
                data: {
                    // Object without message or detail properties
                    someOtherField: 'value',
                },
            } as any;
            axiosError.config = {
                url: 'http://provider/api/endpoint',
            } as any;

            filter.catch(axiosError, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Internal,
                    status: 500,
                    detail: 'Fallback error message', // Should use error.message
                }),
            );
            expect(mockLogger.warn).toHaveBeenCalledWith('Provider HTTP error', expect.any(Object));
        });
    });

    describe('catch - HttpException', () => {
        it('should handle BadRequestException with validation errors (_zodIssues)', () => {
            const exceptionResponse = {
                _zodIssues: [
                    {
                        path: ['name'],
                        message: 'Required',
                        code: 'invalid_type',
                    },
                    {
                        path: ['code', 0],
                        message: 'Expected string, received number',
                        code: 'invalid_type',
                    },
                ],
            };

            const exception = new BadRequestException(exceptionResponse);

            filter.catch(exception, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Validation,
                    status: 400,
                    invalidParams: [
                        {
                            name: 'name',
                            reason: 'Required',
                            in: 'body',
                        },
                        {
                            name: 'code.0',
                            reason: 'Expected string, received number',
                            in: 'body',
                        },
                    ],
                }),
            );
        });

        it('should handle BadRequestException with nested _errors format', () => {
            const exceptionResponse = {
                name: {
                    _errors: ['Name is required', 'Name must be at least 3 characters'],
                },
                address: {
                    street: {
                        _errors: ['Street is required'],
                    },
                },
            };

            const exception = new BadRequestException(exceptionResponse);

            filter.catch(exception, mockArgumentsHost);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Validation,
                    invalidParams: [
                        {
                            name: 'name',
                            reason: 'Name is required',
                            in: 'body',
                        },
                        {
                            name: 'name',
                            reason: 'Name must be at least 3 characters',
                            in: 'body',
                        },
                        {
                            name: 'address.street',
                            reason: 'Street is required',
                            in: 'body',
                        },
                    ],
                }),
            );
        });

        it('should handle BadRequestException with string message', () => {
            const exception = new BadRequestException('Invalid request');

            filter.catch(exception, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            // When status is 400, the filter treats it as validation error
            // and uses default validation message, not the custom message
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Validation,
                    status: 400,
                    detail: 'The request body failed schema validation', // Default validation message
                }),
            );
        });

        it('should handle NotFoundException', () => {
            const exception = new NotFoundException('Resource not found');

            filter.catch(exception, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.NotFound,
                    status: 404,
                    detail: 'Resource not found',
                }),
            );
        });

        it('should handle UnauthorizedException', () => {
            const exception = new UnauthorizedException('Unauthorized');

            filter.catch(exception, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Unauthorized,
                    status: 401,
                }),
            );
        });

        it('should handle HttpException with object response containing message', () => {
            const exception = new HttpException(
                { message: 'Custom error message' },
                403,
            );

            filter.catch(exception, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Forbidden,
                    status: 403,
                    detail: 'Custom error message',
                }),
            );
        });

        it('should handle HttpException with object response containing message', () => {
            const exception = new HttpException(
                { message: 'Custom error message' },
                403,
            );

            filter.catch(exception, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Forbidden,
                    status: 403,
                    detail: 'Custom error message',
                }),
            );
        });

        it('should handle HttpException with object response without message property (line 94)', () => {
            // Create HttpException with object response that has no 'message' property
            const exception = new HttpException(
                { someField: 'value', anotherField: 123 }, // Object without 'message'
                500, // Not 400, so it goes to generic HTTP exception handler
            );

            filter.catch(exception, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Internal,
                    status: 500,
                    detail: exception.message, // Should fall back to exception.message
                }),
            );
        });

        it('should handle HttpException with status 504 Gateway Timeout (line 288)', () => {
            const exception = new HttpException('Gateway Timeout', 504);

            filter.catch(exception, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(504);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Timeout,
                    status: 504,
                    detail: 'Gateway Timeout',
                }),
            );
        });

        it('should map status codes correctly', () => {
            const statusMappings = [
                { status: 400, type: ProblemTypes.Validation },
                { status: 401, type: ProblemTypes.Unauthorized },
                { status: 403, type: ProblemTypes.Forbidden },
                { status: 404, type: ProblemTypes.NotFound },
                { status: 429, type: ProblemTypes.RateLimited },
                { status: 502, type: ProblemTypes.BadGateway },
                { status: 504, type: ProblemTypes.Timeout },
                { status: 500, type: ProblemTypes.Internal },
            ];

            statusMappings.forEach(({ status, type }) => {
                jest.clearAllMocks();
                const exception = new HttpException('Error', status);
                filter.catch(exception, mockArgumentsHost);

                expect(mockResponse.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type,
                        status,
                    }),
                );
            });
        });
    });

    describe('catch - ZodError', () => {
        it('should handle ZodError directly', () => {
            const zodError = new ZodError([
                {
                    path: ['email'],
                    message: 'Invalid email',
                    code: 'invalid_string',
                    validation: 'email',
                },
                {
                    path: ['age'],
                    message: 'Expected number, received string',
                    code: 'invalid_type',
                    expected: 'number',
                    received: 'string',
                },
            ]);

            filter.catch(zodError, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Validation,
                    status: 400,
                    invalidParams: [
                        {
                            name: 'email',
                            reason: 'Invalid email',
                            in: 'body',
                        },
                        {
                            name: 'age',
                            reason: 'Expected number, received string',
                            in: 'body',
                        },
                    ],
                }),
            );
        });

        it('should handle ZodError with empty path', () => {
            const zodError = new ZodError([
                {
                    path: [],
                    message: 'Root level error',
                    code: 'custom',
                },
            ]);

            filter.catch(zodError, mockArgumentsHost);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    invalidParams: [
                        {
                            name: 'request',
                            reason: 'Root level error',
                            in: 'body',
                        },
                    ],
                }),
            );
        });
    });

    describe('catch - Generic Error', () => {
        it('should handle generic Error', () => {
            const error = new Error('Unexpected error occurred');

            filter.catch(error, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Internal,
                    status: 500,
                    detail: 'Unexpected error occurred',
                }),
            );
            expect(mockLogger.error).toHaveBeenCalledWith('Unexpected error', {
                error: 'Unexpected error occurred',
                stack: expect.any(String),
                traceId: 'test-request-id-123',
            });
        });

        it('should handle Error without message', () => {
            const error = new Error();

            filter.catch(error, mockArgumentsHost);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: 'An unexpected error occurred',
                }),
            );
        });
    });

    describe('catch - Unknown error types', () => {
        it('should handle non-Error types', () => {
            const unknownError = 'String error';

            filter.catch(unknownError, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: ProblemTypes.Internal,
                    status: 500,
                    detail: 'An unexpected error occurred',
                }),
            );
            expect(mockLogger.error).toHaveBeenCalledWith('Unknown error type', {
                error: 'String error',
                traceId: 'test-request-id-123',
            });
        });

        it('should handle null error', () => {
            filter.catch(null, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: 'An unexpected error occurred',
                }),
            );
        });

        it('should handle undefined error', () => {
            filter.catch(undefined, mockArgumentsHost);

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    detail: 'An unexpected error occurred',
                }),
            );
        });
    });

    describe('Response formatting', () => {
        it('should set Content-Type header to application/problem+json', () => {
            const error = new Error('Test error');
            filter.catch(error, mockArgumentsHost);

            expect(mockResponse.header).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
        });

        it('should use traceId from request headers', () => {
            mockRequest.headers = {
                'x-request-id': 'custom-trace-id',
            } as any;

            const error = new Error('Test');
            filter.catch(error, mockArgumentsHost);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    traceId: 'custom-trace-id',
                }),
            );
        });

        it('should use instance from request path', () => {
            const customPathRequest = {
                ...mockRequest,
                path: '/v1/custom/path',
            } as Request;
            const error = new Error('Test');
            const argumentsHost = {
                switchToHttp: jest.fn().mockReturnValue({
                    getRequest: jest.fn().mockReturnValue(customPathRequest),
                    getResponse: jest.fn().mockReturnValue(mockResponse),
                }),
            } as any;

            filter.catch(error, argumentsHost);

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    instance: '/v1/custom/path',
                }),
            );
        });
    });
});