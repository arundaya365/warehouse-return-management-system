const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {supervise} = require('./start-server.cjs');
test('server exit is reported immediately instead of waiting 90 seconds', () => {
 const child = new EventEmitter(); child.unref = () => assert.fail('failed child must not become ready');
 const states = [];
 supervise(child, async()=>false, (state,message)=>states.push({state,message}), 10);
 child.emit('exit',1);
 assert.equal(states.length,1);assert.equal(states[0].state,'failed');assert.match(states[0].message,/kode 1/);
});
test('healthy server detaches and cannot later be reported as startup failure', async () => {
 const child = new EventEmitter(); let detached=false; child.unref=()=>{detached=true;};
 await new Promise(resolve => supervise(child, async()=>true, state=>{assert.equal(state,'ready');resolve();},10));
 assert.equal(detached,true);child.emit('exit',0);
});
test('spawn error produces a useful immediate failure', () => {
 const child = new EventEmitter();child.unref=()=>{};
 let result;
 supervise(child,async()=>false,(state,message)=>{result={state,message};},10);
 child.emit('error',new Error('spawn failed'));
 assert.equal(result.state,'failed');assert.match(result.message,/Node.js/);
});
