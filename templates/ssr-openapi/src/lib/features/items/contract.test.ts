import createClient from 'openapi-fetch';
import type { paths } from '#lib/api/paths/openapi.js';
import { createItemsApi } from './api';
import { describeItemsApiContract } from './testing/items-api-contract';
import { createFakeItemsApi, createFakeItemsApiFetch } from './testing/fake-items-api';

describeItemsApiContract('createFakeItemsApi', () => createFakeItemsApi());

// The real itemsApi, against an in-memory stand-in for the API's /v1/items endpoints.
describeItemsApiContract('createItemsApi', () =>
	createItemsApi(
		createClient<paths>({ baseUrl: 'http://api.test', fetch: createFakeItemsApiFetch() })
	)
);
