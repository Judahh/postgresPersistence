import { DefaultInitializer } from 'default-initializer';

export default interface BaseDAODefaultInitializer extends DefaultInitializer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pool: any;
}
