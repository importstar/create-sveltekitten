// Composition root: wires each feature's service to its real repository. Routes import
// services from here; tests build their own with an in-memory repository instead.
import { createItemsService } from '#lib/features/items/service.js';
import { drizzleItemsRepository } from '#lib/features/items/server.js';

export const itemsService = createItemsService(drizzleItemsRepository);
