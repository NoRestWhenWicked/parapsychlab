const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());

// Proxy endpoint for OpenSky
app.get('/api/planes', async (req, res) => {
    try {
        const { lamin, lomin, lamax, lomax } = req.query;
        // Construct the URL parameters
        const params = {};
        if (lamin) params.lamin = lamin;
        if (lomin) params.lomin = lomin;
        if (lamax) params.lamax = lamax;
        if (lomax) params.lomax = lomax;

        console.log(`Fetching planes from OpenSky with params: ${JSON.stringify(params)}`);

        const response = await axios.get('https://opensky-network.org/api/states/all', {
            params,
            timeout: 5000
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data from OpenSky:', error.message);
        if (error.response) {
             res.status(error.response.status).json(error.response.data);
        } else {
             res.status(500).json({ error: 'Failed to fetch data' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
