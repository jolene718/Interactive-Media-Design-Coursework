const { createApp } = require('./app');

const port = Number(process.env.PORT || 3000);
const app = createApp();

app.listen(port, function() {
  console.log(`Circuit Hero server running at http://127.0.0.1:${port}`);
});
