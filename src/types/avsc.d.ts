// Type declarations for avsc
declare module 'avsc' {
  export interface Type {
    decode(buffer: Buffer): any;
    encode(value: any): Buffer;
    isValid(value: any): boolean;
    fromBuffer(buffer: Buffer): any;
    toBuffer(value: any): Buffer;
  }

  export function createFileDecoder(filePath: string): AsyncIterableIterator<any>;
  export function createFileEncoder(filePath: string, schema: Type): any;

  export namespace Type {
    function forSchema(schema: any): Type;
  }
}
