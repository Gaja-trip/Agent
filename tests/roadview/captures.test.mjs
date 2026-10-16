import test from 'node:test';
import assert from 'node:assert/strict';
import { captureList, chooseCaptures, readCaptureDates } from '../../roadview/captures.mjs';
const data = { panoId: 7, date: '2023-08-14 13:02:52', getPastList: () => [
  {panoId:1,date:'2010-04-11 14:18:52'},{panoId:2,date:'2011-08-28'},
  {panoId:3,date:'2015-06-07'},{panoId:4,date:'2018-05-25'},
  {panoId:5,date:'2020-05-20'},{panoId:6,date:'2021-06-10'},
]};
test('real capture records include current and past dates in newest-first order', () => {
  const list=captureList(data);
  assert.deepEqual(list.map(x=>x.panoId),[7,6,5,4,3,2,1]);
  assert.deepEqual(chooseCaptures(list).map(x=>x.panoId),[7,5,3,1]);
});
test('missing history leaves empty slots instead of repeating current imagery', () => {
  const list=captureList({panoId:7,date:'2023-08-14'});
  assert.deepEqual(chooseCaptures(list).map(x=>x?.panoId??null),[7,null,null,null]);
  assert.deepEqual(chooseCaptures([]),[null,null,null,null]);
});
test('duplicate dates and malformed records cannot create fake time differences', () => {
  assert.equal(captureList({panoId:7,date:'2023-08-14',pasts:[{panoId:8,date:'2023-08-14'},{panoId:9,date:'invalid'},{panoId:0,date:'2010-01-01'}]}).length,1);
});
test('navigation preserves preferred dates with distinct nearest available captures', () => {
  const result=chooseCaptures(captureList(data),['2023-01-01','2020-06-01','2016-01-01','2010-01-01']);
  assert.deepEqual(result.map(x=>x.panoId),[7,5,3,1]);
  assert.equal(new Set(chooseCaptures(captureList(data),Array(4).fill('2020-05-20')).map(x=>x.panoId)).size,4);
});
test('shared capture dates restore independently and ignore malformed tokens',()=>{
  assert.deepEqual(readCaptureDates('?dates=2023-08-14,2020-05-20,invalid,2010-04-11'),['2023-08-14','2020-05-20','','2010-04-11']);
});
