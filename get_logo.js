const https = require('https');
https.get('https://atomberg.com', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/<img[^>]+src="([^">]+logo[^">]+)"/gi);
    console.log(matches);
  });
});
