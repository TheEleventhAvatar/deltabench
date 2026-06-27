import { TraceStorage, TraceSearchFilters, TraceEntry } from '../types';

export class TraceSearch {
  private storage: TraceStorage;

  constructor(storage: TraceStorage) {
    this.storage = storage;
  }

  async search(filters: TraceSearchFilters): Promise<TraceEntry[]> {
    return this.storage.search(filters);
  }
}
