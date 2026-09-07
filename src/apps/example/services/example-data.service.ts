import type { ExampleData } from '../data/example-data.types';

/** Services own non-UI data preparation and cleanup once behavior is introduced. */
export interface ExampleDataService {
  prepareSyntheticData(): Promise<ExampleData>;
  cleanupSyntheticData(data: ExampleData): Promise<void>;
}
