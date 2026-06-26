// Test the Ola Maps Places nearby search API
const apiKey = '28uFFFim02RVYxK4zmQE5BRXsd5V5J4r9sVjYzAZ';

// Chennai coords for test
const lat = 13.0604;
const lng = 80.2512;

async function testNearby(type) {
  const url = `https://api.olamaps.io/places/v1/nearbysearch?location=${lat},${lng}&radius=3000&types=${type}&api_key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(`\n--- ${type} ---`);
  console.log('Status:', data.status);
  console.log('Count:', data.predictions?.length || data.results?.length || 0);
  if (data.predictions?.[0]) console.log('Sample:', JSON.stringify(data.predictions[0], null, 2).substring(0, 300));
  if (data.results?.[0]) console.log('Sample:', JSON.stringify(data.results[0], null, 2).substring(0, 300));
  if (data.error) console.log('Error:', data.error);
}

async function testAutocomplete() {
  const url = `https://api.olamaps.io/places/v1/autocomplete?input=hospital+chennai&api_key=${apiKey}&location=${lat},${lng}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('\n--- autocomplete hospital ---');
  console.log('Status:', data.status);
  console.log('Count:', data.predictions?.length);
  if (data.predictions?.[0]) console.log('Sample:', JSON.stringify(data.predictions[0], null, 2).substring(0, 400));
}

(async () => {
  await testNearby('hospital');
  await testNearby('pharmacy');
  await testAutocomplete();
})();
