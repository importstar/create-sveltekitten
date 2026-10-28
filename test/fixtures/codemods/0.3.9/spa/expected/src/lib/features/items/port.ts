// Deprecated name: import from './contract' instead (create-sveltekitten 0.3.9).
import type { Item, CreateItemInput } from './schema';

export interface ItemsApi {
	fetchItems(): Promise<Item[]>;
	createItem(input: CreateItemInput): Promise<Item>;
	toggleItem(id: string, completed: boolean): Promise<Item>;
	deleteItem(id: string): Promise<void>;
}
