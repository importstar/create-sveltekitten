import { describeItemsApiContract } from './testing/items-api-contract';
import { createFakeItemsApi } from './testing/fake-items-api';

// The real `itemsApi` (api.ts) talks to /api/items over fetch; its server side is
// covered by service.test.ts. Add it here once you run tests against a live server.
describeItemsApiContract('createFakeItemsApi', () => createFakeItemsApi());
