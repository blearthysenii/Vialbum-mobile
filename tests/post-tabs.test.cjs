const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const vm = require('node:vm');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/features/posts/cities.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: moduleValue, exports: moduleValue.exports });
const { journeyCityQueries, cityFromResults, cityRegion } = moduleValue.exports;
const place = { id: 'private-place', provider: 'geoapify', provider_place_id: 'street', name: 'Private address', locality: 'Nörten-Hardenberg', country: 'Germany', country_code: 'DE', latitude: '51.123456', longitude: '9.123456' };
const city = { ...place, id: undefined, name: place.locality, provider_place_id: 'city-center', latitude: '51.63', longitude: '9.94' };

test('map deduplicates places and cities without carrying photo coordinates into requests', () => {
  const queries = journeyCityQueries({ place, photos: [{ place, latitude: '12.123456', longitude: '13.123456' }, { place: { ...place, id: 'another-street' } }] });
  assert.equal(queries.length, 1); assert.equal(queries[0].name, place.locality);
  assert.equal('latitude' in queries[0], false);
  assert.equal(JSON.stringify(queries).includes('Private address'), false);
  const resolved = cityFromResults(queries[0], [place, city]);
  assert.equal(resolved.latitude, 51.63); assert.equal(resolved.longitude, 9.94);
  assert.equal(resolved.id, 'geoapify:city-center');
});
test('map rejects address results, mismatched countries, invalid coordinates and missing locations', () => {
  const query = journeyCityQueries({ place, photos: [] })[0];
  assert.equal(cityFromResults(query, [place]), null);
  assert.equal(cityFromResults(query, [{ ...city, country_code: 'US' }]), null);
  assert.equal(cityFromResults(query, [{ ...city, latitude: '' }]), null);
  assert.equal(cityFromResults(query, [{ ...city, latitude: 'NaN' }]), null);
  assert.equal(journeyCityQueries({ place: null, photos: [{ latitude: '12', longitude: '15', place: null }] }).length, 0);
  assert.equal(cityRegion([]), null);
});
test('city viewport fits one, several and dateline-adjacent cities', () => {
  const single = cityRegion([{ latitude: 51.63, longitude: 9.94 }]);
  assert.equal(single.latitude, 51.63); assert.equal(single.latitudeDelta, 0.12);
  const multiple = cityRegion([{ latitude: 52.52, longitude: 13.4 }, { latitude: 24.47, longitude: 39.61 }]);
  assert.ok(multiple.latitude + multiple.latitudeDelta / 2 > 52.52);
  assert.ok(multiple.latitude - multiple.latitudeDelta / 2 < 24.47);
  assert.ok(cityRegion([{ latitude: 10, longitude: 179 }, { latitude: 11, longitude: -179 }]).longitudeDelta < 5);
});
test('Photos starts selected, stays mounted across tabs, and Stays replaces the Hotels placeholder', () => {
  const content = fs.readFileSync('src/features/posts/PostContent.tsx', 'utf8');
  assert.match(content, /useState<PostTab>\('photos'\)/);
  assert.match(content, /display: tab === 'photos' \? 'flex' : 'none'/);
  assert.match(content, /next > 0 && next !== width/);
  assert.match(content, /mapVisited \?/);
  const tabs = fs.readFileSync('src/features/posts/PostTabs.tsx', 'utf8');
  assert.match(tabs, /label: 'Stays'/); assert.doesNotMatch(tabs, /No hotel added|label: 'Hotels'/);
  assert.match(content, /<StaysTab journey=\{journey\}/);
  const map = fs.readFileSync('src/features/posts/PostMapTab.tsx', 'utf8');
  assert.match(map, /No location added/); assert.match(map, /showsUserLocation=\{false\}/);
});
