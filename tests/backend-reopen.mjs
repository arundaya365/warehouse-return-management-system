import assert from 'node:assert/strict';
const {localDatabase}=await import('../src/db/index.ts');
const {getWarehouseData}=await import('../src/db/warehouseDb.ts');
assert.equal((await getWarehouseData()).returns.length,0,'Deleted returns must not be re-seeded on restart');
await localDatabase.close();
