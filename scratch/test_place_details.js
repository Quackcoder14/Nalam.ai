const apiKey = '28uFFFim02RVYxK4zmQE5BRXsd5V5J4r9sVjYzAZ';

// Test place details endpoint to get lat/lng
async function getPlaceDetails(placeId) {
  const url = `https://api.olamaps.io/places/v1/details?place_id=${placeId}&api_key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('Place detail status:', data.status);
  const loc = data.result?.geometry?.location;
  console.log('Location:', loc);
  console.log('Name:', data.result?.name);
  return data;
}

// Test reverse geocoding
async function testReverse(lat, lng) {
  const url = `https://api.olamaps.io/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log('\nReverse geocode status:', data.status);
  console.log('Address:', data.results?.[0]?.formatted_address);
}

(async () => {
  // Use the place_id from previous test
  await getPlaceDetails('ola-platform:5000330575597');
  await testReverse(13.0604, 80.2512);
})();
