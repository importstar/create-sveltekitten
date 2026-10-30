import createClient from 'openapi-fetch';
import type { paths } from '#lib/api/paths/fastapi.js';
import { createItemsApi } from './api';
import { describeItemsApiContract } from './testing/items-api-contract';
import { createFakeItemsApi } from './testing/fake-items-api';
import { createFakeFastApiItemsFetch } from './testing/fake-fastapi-items';

describeItemsApiContract('createFakeItemsApi', () => createFakeItemsApi());

// The real itemsApi, against an in-memory stand-in for the FastAPI /v1/items endpoints.
describeItemsApiContract('createItemsApi', () =>
	createItemsApi(
		createClient<paths>({ baseUrl: 'http://fastapi.test', fetch: createFakeFastApiItemsFetch() })
	)
);
