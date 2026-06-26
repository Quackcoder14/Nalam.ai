const apiKey = '28uFFFim02RVYxK4zmQE5BRXsd5V5J4r9sVjYzAZ';
const url = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`;

fetch(url)
  .then(res => res.text())
  .then(text => console.log('Response:', text.substring(0, 100)))
  .catch(err => console.error('Error:', err));
