// satellites.js
// This is the shared internal module for the Backend Team 

let satelliteStorage = []; // Our in-memory list of satellite objects [cite: 55, 143]

/**
 * BE-1 & BE-2 call this to get the current list for the /api/data response
 * or for running collision logic[cite: 142].
 */
const getSatellites = () => {
    return satelliteStorage;
};

/**
 * BE-2 calls this when a user submits a new TLE via POST /api/satellite/add[cite: 33, 55].
 */
const addSatellite = (satelliteObject) => {
    satelliteStorage.push(satelliteObject);
    return satelliteObject;
};

/**
 * BE-2 calls this when a user triggers DELETE /api/satellite/:id[cite: 89, 92].
 */
const removeSatellite = (id) => {
    const index = satelliteStorage.findIndex(s => s.id === id);
    if (index !== -1) {
        return satelliteStorage.splice(index, 1)[0];
    }
    return null;
};

module.exports = {
    getSatellites,
    addSatellite,
    removeSatellite
};