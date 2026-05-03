// Type declarations for parquetjs
declare module 'parquetjs' {
  export class ParquetSchema {
    constructor(schema: any);
  }

  export class ParquetReader {
    static openFile(filePath: string): Promise<ParquetReader>;
    getCursor(): ParquetCursor;
    close(): Promise<void>;
  }

  export interface ParquetCursor {
    next(): Promise<any>;
  }

  export class ParquetWriter {
    static openFile(schema: ParquetSchema, filePath: string): Promise<ParquetWriter>;
    appendRow(row: any): Promise<void>;
    close(): Promise<void>;
  }
}
