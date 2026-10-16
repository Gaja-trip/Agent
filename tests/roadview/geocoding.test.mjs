import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuery, normalizeAddressResponse } from '../../roadview/geocoding.mjs';
const road = {docid:'N29750882',lat:37.566370776634,lon:126.977918351844,addr:'서울 중구 세종대로 110',is_alive:'Y',building_name:'서울특별시청',zone_no:'04524',related_prefix_address:'서울 중구',related_address:'태평로1가 31^495123,1129677'};
const lot = {docid:'J147195022',lat:36.6111290626252,lon:127.493463739624,addr:'충북 청주시 서원구 분평동 1258',is_alive:'Y',related_prefix_address:'충북 청주시 서원구',related_address:'월평로 78^610386,864945;1순환로1137번길 106^610314,864922'};
test('road and land-lot results use WGS84, preserving address labels',()=>{
  const response=normalizeAddressResponse({List:[road,lot],total_count:2});
  assert.equal(response.results[0].lat,37.566370776634);assert.equal(response.results[0].lng,126.977918351844);
  assert.equal(response.results[0].alternate,'서울 중구 태평로1가 31');assert.equal(response.results[0].building,'서울특별시청');
  assert.equal(response.results[1].alternate,'충북 청주시 서원구 월평로 78');assert.equal(response.total,2);
});
test('ambiguous addresses retain distinct choices, with an honest bounded result count',()=>{
  const results=Array.from({length:12},(_,i)=>({...road,addr:`서울 중구 세종대로 ${i+100}`,docid:`N${i}`}));
  const response=normalizeAddressResponse({List:results,total_count:12});
  assert.equal(response.results.length,8);assert.equal(response.total,12);
});
test('duplicate, retired, empty, and invalid-coordinate records cannot become destinations',()=>{
  const response=normalizeAddressResponse({List:[road,road,{...road,lat:'bad'},{...lot,lon:0},{...lot,is_alive:'N'},{...road,addr:''},{...road,lat:50}],total_count:7});
  assert.equal(response.results.length,1);
});
test('empty search results differ from a failed provider response',()=>{
  assert.deepEqual(normalizeAddressResponse({List:[],total_count:0}),{results:[],total:0});
  for(const bad of [null,{}, {error:'unavailable'}, {List:'invalid'}]) assert.throws(()=>normalizeAddressResponse(bad),/응답/);
});
test('query validation normalizes whitespace and rejects unusable input',()=>{
  assert.equal(normalizeQuery('  서울  중구\n세종대로 110 '),'서울 중구 세종대로 110');
  for(const bad of ['', ' ', '서', 'a'.repeat(151)]) assert.throws(()=>normalizeQuery(bad));
});
