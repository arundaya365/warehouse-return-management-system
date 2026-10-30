import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReturnRows} from '../src/utils/backendValidation';
test('invalid return payload cannot overwrite an unrelated order',()=>{
 const row={Order_ID:'A',SKU_ID:'SKU',Nama_Barang:'Barang',Operator_ID:'QA',Waktu_Proses:'2026-10-30',Kondisi:'Good'};
 assert.equal(validateReturnRows([row],'A'),null);
 assert.match(validateReturnRows([row],'B')!,/sesuai/);
 assert.match(validateReturnRows([row,{...row,Order_ID:'B'}])!,/beberapa/);
 assert.ok(validateReturnRows([null]));assert.ok(validateReturnRows([{...row,SKU_ID:''}]));
 assert.equal(validateReturnRows([],'A'),null);
});
