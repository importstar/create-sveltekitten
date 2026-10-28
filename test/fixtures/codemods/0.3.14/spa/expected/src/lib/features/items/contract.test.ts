import { describeItemsApiContract } from './testing/items-api-contract';
import { createFakeItemsApi } from './testing/fake-items-api';
import { createMockItemsApi } from './api';

describeItemsApiContract('createFakeItemsApi', () => createFakeItemsApi());
describeItemsApiContract('createMockItemsApi (api.ts)', () => createMockItemsApi([], 0));
