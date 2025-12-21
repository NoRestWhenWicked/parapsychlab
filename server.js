const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());

// Proxy endpoint for OpenSky API
app.get('/api/opensky/all', async (req, res) => {
    try {
        const { lamin, lomin, lamax, lomax } = req.query;

        // Log the request for debugging
        console.log(`Fetching planes for bounding box: [${lamin}, ${lomin}, ${lamax}, ${lomax}]`);

        const response = await axios.get('https://opensky-network.org/api/states/all', {
            params: {
                lamin,
                lomin,
                lamax,
                lomax
            },
            timeout: 5000
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data from OpenSky:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Failed to fetch data from OpenSky' });
        }
    }
});

app.listen(port, () => {
    console.log(`Backend proxy server running at http://localhost:${port}`);
});
