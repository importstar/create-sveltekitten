import { createContext } from 'svelte';
import { itemsApi as defaultItemsApi } from './api';
import type { ItemsApi } from './contract';

const [getItemsApi, setItemsApi, hasItemsApi] = createContext<ItemsApi>();

/**
 * Provides an `ItemsApi` to every component below. The root layout provides the real
 * one; a test or component harness can provide `createFakeItemsApi()` instead.
 */
export { setItemsApi };

/** The provided `ItemsApi`, or the real one when none was provided. Call during component init. */
export function useItemsApi(): ItemsApi {
	return hasItemsApi() ? getItemsApi() : defaultItemsApi;
}
