import type { ExamplePage } from '../pages/example.page';
import type { ExampleDataService } from '../services/example-data.service';

/** Small typed fixture context; it contains composition only, never a workflow. */
export interface ExampleFixtureContext {
  readonly examplePage: ExamplePage;
  readonly dataService: ExampleDataService;
}
