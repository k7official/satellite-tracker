require('dotenv').config(); // Load SP_USER and SP_PASS from .env [cite: 147]
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron'); // For the 90-second refresh [cite: 147]
const { getSatellites, setSatellites, propagateLocation } = require('./satellites');
const mockData = require('./mock_data.json');
const { detectCollisions } = require('./collision');
const { kesslerScore } = require('./utils/riskScore'); // Risk utility
const app = express();
const PORT = 3000;

// Space-Track Credentials from your .env file
const SP_USER = process.env.SP_USER;
const SP_PASS = process.env.SP_PASS;

// Middleware
app.use(cors()); // [cite: 147]
app.use(express.json()); // [cite: 147]
// Mount the BE-2 satellite management routes
const satelliteRoutes = require('./routes/satellite'); // Adjust path if needed
app.use('/api/satellite', satelliteRoutes);

/**
 * BE-1: Core Fetching Logic
 * Pulls TLEs from Space-Track and updates our in-memory storage[cite: 27, 124].
 */
async function fetchTles() {
    try {
        console.log("Authenticating with Space-Track...");

        // STEP 1: LOGIN [cite: 122]
        const loginResponse = await axios.post(
            'https://www.space-track.org/ajaxauth/login',
            new URLSearchParams({
                'identity': process.env.SP_USER,
                'password': process.env.SP_PASS
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        // Extract just the session part of the cookie string
        const setCookieHeader = loginResponse.headers['set-cookie'];
        if (!setCookieHeader) {
            console.error("Login failed: No cookie returned.");
            return;
        }
        const sessionCookie = setCookieHeader[0].split(';')[0]; 

        console.log("Login successful. Fetching TLE data...");

        // STEP 2: FETCH DATA [cite: 10, 27]
        // Corrected URL based on Space-Track documentation 
        const queryUrl = 'https://www.space-track.org/basicspacedata/query/class/gp/decay_date/null-val/epoch/%3Enow-10/limit/100/format/json';
        
        const dataResponse = await axios.get(queryUrl, {
            headers: { 'Cookie': sessionCookie }
        });

        const rawData = dataResponse.data;
        
        if (!Array.isArray(rawData)) {
            console.error("Data error: Space-Track returned non-array format.");
            return;
        }

        // STEP 3: PROPAGATE [cite: 27, 54]
        const processedSats = rawData.map(s => 
            propagateLocation(s.TLE_LINE1, s.TLE_LINE2, s.OBJECT_NAME, s.NORAD_CAT_ID)
        );

        setSatellites(processedSats);
        console.log("First Satellite Sample: ", getSatellites()[0]);
        console.log(`Successfully updated ${processedSats.length} satellites at ${new Date().toLocaleTimeString()}`);

    } catch (error) {
        if (error.response) {
            console.error(`Space-Track Error: ${error.response.status}`);
            if (error.response.status === 404) {
                console.error("Check the queryUrl for typos or deprecated endpoints.");
            }
        } else {
            console.error("Connection Error:", error.message);
        }
    }
}

/**
 * BE-1: Automation
 * Refresh TLE data every 90 seconds to stay within rate limits[cite: 27, 124, 145].
 */
cron.schedule('*/90 * * * * *', () => {
    fetchTles();
});

// Initial fetch on server start [cite: 122]
fetchTles();

/**
 * BE-1: Propagation Loop
 * Recalculate positions every 5 seconds based on TLEs already in memory.
 * This makes the satellites move smoothly on the FE globe.
 */
setInterval(() => {
    const currentSats = getSatellites();
    if (currentSats.length > 0) {
        const updatedSats = currentSats.map(s => {
            // Safety check: Only propagate if TLE data exists
            if (s.tle1 && s.tle2) {
                return propagateLocation(s.tle1, s.tle2, s.name, s.id);
            }
            return s; // Keep it as is if no TLE (it just won't move)
        });
        setSatellites(updatedSats);
        //console.log("BE-2 sees satellite count:", getSatellites().length);
        // console.log("Positions propagated for current time.");
    }
}, 5000); // 5 seconds


/**
 * Main Data Endpoint
 * Returns live data from BE-1 (satellites) and eventually BE-2 (collisions)[cite: 27, 31].
 */
app.get('/api/data', (req, res) => {
    const allObjects = getSatellites();
    console.log(allObjects);
    
    if (allObjects.length === 0) {
        return res.json(mockData);
    }

    // BE-2 : Integration: Split objects into Satellites and Debris
    // Typically, TLE names with "DEB", "R/B", or "COOLANT" are debris
    const debris = allObjects.filter(s => 
        s.name.includes("DEB") || 
        s.name.includes("R/B") || 
        s.name.includes("COOLANT")
    );
    
    const activeSatellites = allObjects.filter(s => !debris.includes(s));

    // BE-2 Integration: Run the collision detection algorithm
    const collisions = detectCollisions(allObjects);

    res.json({
        satellites: activeSatellites,
        debris: debris, 
        collisions: collisions,
        risk_assessment: kesslerScore(allObjects), // Optional: include the Kessler score
        last_updated: new Date().toISOString()
    });
});

/**
 * PHASE 2: ISS Specific Endpoint (Demo 1)
 * Fetches real-time ISS data from N2YO API. 
 */
app.get('/api/iss', async (req, res) => {
    try {
        const N2YO_KEY = process.env.N2YO_API_KEY;
        const ISS_ID = '25544'; // NORAD ID for the ISS
        
        // Fetch position for 1 second (returns current lat/lng/alt)
        const url = `https://api.n2yo.com/rest/v1/satellite/positions/${ISS_ID}/0/0/0/1/&apiKey=${N2YO_KEY}`;
        
        const response = await axios.get(url);
        const data = response.data.positions[0];

        res.json({
            id: "ISS",
            name: "ISS (ZARYA)",
            lat: data.satlatitude,
            lng: data.satlongitude,
            alt_km: data.sataltitude,
            speed_kms: 7.66, // Standard LEO speed [cite: 38]
            type: "station", // Matches contract for FE color-coding [cite: 38]
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("N2YO API Error:", error.message);
        res.status(500).json({ error: "Could not fetch live ISS position" });
    }
});

app.listen(PORT, () => {
    console.log(`BE-1 Server running at http://localhost:${PORT}`);
});