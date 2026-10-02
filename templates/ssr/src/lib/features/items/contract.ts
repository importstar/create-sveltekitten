import type { Item, CreateItemInput } from './schema';

/** What any items API implementation must do — see the contract tests. */
export interface ItemsApi {
	fetchItems(): Promise<Item[]>;
	createItem(input: CreateItemInput): Promise<Item>;
	toggleItem(id: string, completed: boolean): Promise<Item>;
	deleteItem(id: string): Promise<void>;
}
