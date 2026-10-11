const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
	res.send('Your Express server is successfully listening!');
});

app.listen(PORT, () => {
	console.log(`Server is listening on http://localhost:${PORT}`);
});
