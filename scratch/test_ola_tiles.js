const apiKey = '28uFFFim02RVYxK4zmQE5BRXsd5V5J4r9sVjYzAZ';
const url = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log('Sources:');
    for (const key in data.sources) {
      console.log(key, data.sources[key].tiles || data.sources[key].url);
    }
  })
  .catch(err => console.error('Error:', err));
