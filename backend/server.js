const express = require('express');
const cors = require('cors');
const { getSatellites } = require('./satellites');
const mockData = require('./mock_data.json');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Allows Frontend to communicate with Backend [cite: 147]
app.use(express.json()); // Parses incoming JSON for POST requests [cite: 147]

/**
 * PHASE 1 & 2: Main Data Endpoint
 * Currently serves mock data so FE-1 and FE-2 are unblocked.
 * Later, you will replace 'mockData' with live results from BE-1 and BE-2.
 */
app.get('/api/data', (req, res) => {
    // Once live, this will combine your satellite data and BE-2's collision logic
    res.json(mockData); 
});

/**
 * PHASE 2: ISS Specific Endpoint
 * Used for the "Demo 1" live tracking moment[cite: 124, 131].
 */
app.get('/api/iss', (req, res) => {
    // Placeholder for N2YO API integration [cite: 124]
    res.json({ message: "ISS data coming soon" });
});

app.listen(PORT, () => {
    console.log(`BE-1 Server running at http://localhost:${PORT}`);
    console.log(`FE-2 can now connect to http://localhost:${PORT}/api/data`);
});