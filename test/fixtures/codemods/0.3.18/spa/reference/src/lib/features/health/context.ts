import { createContext } from 'svelte';
import { healthApi as defaultHealthApi } from './api';
import type { HealthApi } from './contract';

const [getHealthApi, setHealthApi, hasHealthApi] = createContext<HealthApi>();

/** Provides a `HealthApi` to every component below (the root layout provides the real one). */
export { setHealthApi };

/** The provided `HealthApi`, or the real one when none was provided. Call during component init. */
export function useHealthApi(): HealthApi {
	return hasHealthApi() ? getHealthApi() : defaultHealthApi;
}
