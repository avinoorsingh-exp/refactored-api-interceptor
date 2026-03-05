// test/setup-e2e.ts
import { setupServer } from 'msw/node';
import 'reflect-metadata'

// Mock server for downstream providers
export const mockServer = setupServer();

beforeAll(() => {
  mockServer.listen({
    // Let SuperTest -> Nest (localhost) calls pass through unmocked.
    onUnhandledRequest(req, print) {
      const url = new URL(req.url)
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        return // bypass localhost app routes
      }
      // keep strict for anything else so we don't accidentally hit the network
      print.error()
    },
  })
});

afterAll(() => {
  mockServer.close();
});

beforeEach(() => {
  mockServer.resetHandlers();
});

// Set global test timeout
jest.setTimeout(30000);

// Set environment variables for testing
// Use 'local' to avoid AWS Secrets Manager loading in tests
process.env.NODE_ENV = 'local';
process.env.ADDRESS_PROVIDER_SMARTY_URL = 'http://localhost:3010';
process.env.ADDRESS_PROVIDER_BATCHDATA_URL = 'http://localhost:3011';
process.env.PROPERTY_PROVIDER_BATCHDATA_URL = 'http://localhost:3012';
process.env.PHONE_PROVIDER_BATCHDATA_URL = 'http://localhost:3013';
process.env.DEMOGRAPHICS_PROVIDER_CENSUS_URL = 'http://localhost:3014';
process.env.AGENT_SERVICE_URL = 'http://localhost:3001';
process.env.S2S_INTERNAL_KEY = 'test-key';
process.env.PORT = '3000';
process.env.LOG_LEVEL = 'error';
process.env.ALLOWED_ORIGINS = '*';