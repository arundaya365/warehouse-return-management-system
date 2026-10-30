import test from 'node:test';
import assert from 'node:assert/strict';
import {rowValue,summarizeValues} from '../src/utils/reportValue';
const master=[{SKU_ID:'SKU-A',BARCODE:'123',HARGA:50000},{SKU_ID:'FREE',HARGA:0},{SKU_ID:'NO-PRICE'}];
test('report value uses master SKU or barcode and counts each return unit once',()=>{
 assert.equal(rowValue({SKU_ID:' sku-a '},master),50000);
 assert.equal(rowValue({SKU_ID:'123'},master),50000);
 assert.deepEqual(summarizeValues([{SKU_ID:'SKU-A'},{SKU_ID:'SKU-A'},{SKU_ID:'FREE'}],master),{total:100000,missing:0});
});
test('unknown prices remain distinct from a known zero value',()=>{
 assert.equal(rowValue({SKU_ID:'FREE'},master),0);
 assert.equal(rowValue({SKU_ID:'NO-PRICE'},master),undefined);
 assert.equal(rowValue({SKU_ID:'UNKNOWN'},master),undefined);
 assert.deepEqual(summarizeValues([{SKU_ID:'123'},{SKU_ID:'UNKNOWN'}],master),{total:50000,missing:1});
 assert.deepEqual(summarizeValues([],master),{total:0,missing:0});
});
