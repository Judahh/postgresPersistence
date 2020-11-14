/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PersistenceAdapter,
  PersistencePromise,
  PersistenceInfo,
  PersistenceInputCreate,
  PersistenceInputUpdate,
  PersistenceInputRead,
  PersistenceInputDelete,
} from 'flexiblepersistence';
import { Pool } from 'pg';
import { RelationValuePostgresDB } from './relationValuePostgresDB';
import { SelectedItemValue } from './model/selectedItemValue';
export class PostgresDB implements PersistenceAdapter {
  private persistenceInfo: PersistenceInfo;
  private pool: Pool;

  private static inspectSelectedItemValue(element: any): SelectedItemValue {
    if (!(element instanceof SelectedItemValue)) {
      element = new SelectedItemValue(element, new RelationValuePostgresDB());
    }
    return element;
  }

  private static getDBVariable(element: SelectedItemValue): string {
    return '' + element.toString() + '';
  }

  private static getDBSetVariable(name, element: any): string {
    return (
      name +
      ' ' +
      PostgresDB.getDBVariable(PostgresDB.inspectSelectedItemValue(element))
    );
  }

  private static getDBSetVariables(item): string[] {
    const keys = PostgresDB.resolveKeys(item);
    return keys.map((element) => {
      return PostgresDB.getDBSetVariable(element, item[element]);
    });
  }

  private static getDBVariables(item): string {
    return PostgresDB.resolveValues(item)
      .map((element) => {
        return "'" + PostgresDB.getDBVariable(element) + "'";
      })
      .join(', ');
  }

  private static querySelectArray(
    scheme: string,
    selectedItem: any,
    selectVar?: string
  ): string {
    if (!selectVar) {
      selectVar = '*';
    }
    return PostgresDB.resolveKeys(selectedItem).length === 0
      ? `SELECT ${selectVar} FROM ${scheme} ORDER BY _id ASC`
      : `SELECT ${selectVar} FROM ${scheme} WHERE (${PostgresDB.getDBSetVariables(
          selectedItem
        ).join(', ')}) ORDER BY _id ASC`;
  }

  private static querySelectItem(
    scheme: string,
    selectedItem: any,
    selectVar?: string
  ): string {
    return (
      PostgresDB.querySelectArray(scheme, selectedItem, selectVar) + ` LIMIT 1`
    );
  }

  private static queryInsertItem(scheme: string, item: any): string {
    return `INSERT INTO ${scheme} (${PostgresDB.resolveKeys(item).join(
      ', '
    )}) VALUES (${PostgresDB.getDBVariables(item)}) RETURNING *`;
  }

  private static queryUpdate(
    scheme: string,
    selectedItem: any,
    item: any
  ): string {
    return `UPDATE ${scheme} SET ${PostgresDB.getDBSetVariables(item).join(
      ', '
    )} WHERE (${PostgresDB.getDBSetVariables(selectedItem).join(
      ', '
    )}) RETURNING *`;
  }

  private static queryUpdateArray(
    scheme: string,
    selectedItem: any,
    item: any
  ): string {
    return `${this.queryUpdate(scheme, selectedItem, item)}`;
  }

  private static queryUpdateItem(
    scheme: string,
    selectedItem: any,
    item: any
  ): string {
    return `${this.queryUpdate(scheme, selectedItem, item)}`;
  }

  private static queryDeleteItem(scheme: string, selectedItem: any): string {
    return `DELETE FROM ${scheme} WHERE _id IN (${PostgresDB.querySelectItem(
      scheme,
      selectedItem,
      '_id'
    )})`;
  }

  private static queryDeleteArray(scheme: string, selectedItem: any): string {
    return `DELETE FROM ${scheme} WHERE _id IN (${PostgresDB.querySelectArray(
      scheme,
      selectedItem,
      '_id'
    )})`;
  }

  private static resolveKeys(item: any): Array<string> {
    return item ? Object.keys(item) : [];
  }

  private static resolveValues(item: any): Array<any> {
    return item ? Object.values(item) : [];
  }

  private static queryResults(
    error,
    results,
    resolve,
    reject,
    toPromise: { selectedItem?; sentItem? },
    isItem?: boolean
  ): void {
    if (error) {
      console.log('FUCKING error');
      console.log(error);
      reject(new Error(error));
    } else {
      const result = new PersistencePromise({
        receivedItem: results
          ? isItem
            ? results.rows[0]
            : results.rows
          : results,
        selectedItem: toPromise.selectedItem,
        result: results,
        sentItem: toPromise.sentItem,
      });
      // console.log(result);
      resolve(result);
    }
  }

  constructor(persistenceInfo: PersistenceInfo) {
    this.persistenceInfo = persistenceInfo;
    this.pool = new Pool(this.persistenceInfo);
  }

  correct(input: PersistenceInputUpdate): Promise<PersistencePromise> {
    return this.update(input);
  }

  nonexistent(input: PersistenceInputDelete): Promise<PersistencePromise> {
    return this.delete(input);
  }

  create(input: PersistenceInputCreate): Promise<PersistencePromise> {
    if (input.item instanceof Array) {
      return this.createArray(input.scheme, input.item);
    } else {
      return this.createItem(input.scheme, input.item);
    }
  }
  existent(input: PersistenceInputCreate): Promise<PersistencePromise> {
    if (input.item instanceof Array) {
      return this.createArray(input.scheme, input.item);
    } else {
      return this.createItem(input.scheme, input.item);
    }
  }
  update(input: PersistenceInputUpdate): Promise<PersistencePromise> {
    if (input.single || input.id) {
      return this.updateItem(input.scheme, input.selectedItem, input.item);
    } else {
      return this.updateArray(input.scheme, input.selectedItem, input.item);
    }
  }
  read(input: PersistenceInputRead): Promise<PersistencePromise> {
    if (input.single || input.id) {
      if (input.id) return this.readItemById(input.scheme, input.id);
      return this.readItem(input.scheme, input.selectedItem);
    } else {
      return this.readArray(input.scheme, input.selectedItem);
    }
  }
  delete(input: PersistenceInputDelete): Promise<PersistencePromise> {
    if (input.single || input.id) {
      if (input.id) return this.deleteItem(input.scheme, input.id);
      return this.deleteItem(input.scheme, input.selectedItem);
    } else {
      return this.deleteArray(input.scheme, input.selectedItem);
    }
  }

  public async createItem(
    scheme: string,
    item: any
  ): Promise<PersistencePromise> {
    const query = PostgresDB.queryInsertItem(scheme, item);
    // console.log('createItem: ', item, scheme);
    return this.query(query, { sentItem: item }, true);
  }

  public async createArray(
    scheme: string,
    items: Array<any>
  ): Promise<PersistencePromise> {
    const received = Array<PersistencePromise>();
    for (const item of items) {
      received.push(await this.createItem(scheme, item));
    }
    return new Promise<PersistencePromise>((resolve) => {
      resolve(
        new PersistencePromise({
          receivedItem: received.map(({ receivedItem }) => receivedItem),
          result: received.map(({ result }) => result),
          sentItem: received.map(({ sentItem }) => sentItem),
        })
      );
    });
  }

  public updateItem(
    scheme: string,
    selectedItem: any,
    item: any
  ): Promise<PersistencePromise> {
    const query = PostgresDB.queryUpdateItem(scheme, selectedItem, item);
    return this.query(query, { selectedItem, sentItem: item }, true);
  }

  public updateArray(
    scheme: string,
    selectedItem: any,
    item: any
  ): Promise<PersistencePromise> {
    const query = PostgresDB.queryUpdateArray(scheme, selectedItem, item);
    return this.query(query, { selectedItem, sentItem: item }, true);
  }

  public readArray(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise> {
    const query = PostgresDB.querySelectArray(scheme, selectedItem);
    return this.query(query, { selectedItem });
  }

  public readItem(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise> {
    const query = PostgresDB.querySelectItem(scheme, selectedItem);
    return this.query(query, { selectedItem }, true);
  }

  public readItemById(scheme: string, id: any): Promise<PersistencePromise> {
    const query = PostgresDB.querySelectItem(scheme, { _id: id });
    return this.query(query, { selectedItem: { _id: id } }, true);
  }

  public deleteItem(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise> {
    const query = PostgresDB.queryDeleteItem(scheme, selectedItem);
    // console.log('DeleteItem :', selectedItem);
    return this.query(query, { selectedItem }, true);
  }

  public deleteArray(
    scheme: string,
    selectedItem: any
  ): Promise<PersistencePromise> {
    const query = PostgresDB.queryDeleteArray(scheme, selectedItem);
    // console.log('DeleteArray: ', query);
    return this.query(query, { selectedItem });
  }

  public getPersistenceInfo(): PersistenceInfo {
    return this.persistenceInfo;
  }

  public getPool(): Pool {
    // TODO: remove
    return this.pool;
  }

  public close(): Promise<unknown> {
    return new Promise<unknown>((resolve) => {
      this.end(resolve);
    });
  }

  private end(resolve): void {
    this.pool.end(() => {
      resolve();
    });
  }

  private async query(
    query: string,
    toPromise: { selectedItem?; sentItem? },
    isItem?: boolean
  ): Promise<PersistencePromise> {
    return new Promise<PersistencePromise>((resolve, reject) => {
      // console.log(query);

      this.pool.query(query, (error, results) => {
        PostgresDB.queryResults(
          error,
          results,
          resolve,
          reject,
          toPromise,
          isItem
        );
      });
    });
  }
}