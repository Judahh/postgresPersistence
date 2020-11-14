import { promises } from 'fs';

export default class Utils {
  public static async init(pool): Promise<void> {
    await Utils.dropTables(pool);
    let script = await promises.readFile(
      './database/createExtension.sql',
      'utf8'
    );
    await pool.query(script);
    script = await promises.readFile('./database/createTables.sql', 'utf8');
    await pool.query(script);
  }

  public static async dropTables(pool): Promise<void> {
    const dropTables = await promises.readFile(
      './database/dropTables.sql',
      'utf8'
    );
    await pool.query(dropTables);
  }

  public static async deleteTables(pool): Promise<void> {
    const dropTables = await promises.readFile(
      './database/deleteTables.sql',
      'utf8'
    );
    await pool.query(dropTables);
  }

  public static async end(pool): Promise<void> {
    await Utils.dropTables(pool);
    // await Utils.deleteTables(pool);
    await Utils.disconnect(pool);
  }

  public static async disconnect(pool): Promise<void> {
    await pool.end();
  }
}