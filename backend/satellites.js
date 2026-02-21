// satellites.js
const satellite = require('satellite.js');

let satelliteStorage = []; // In-memory list of satellite objects [cite: 55, 143]

/**
 * BE-1: Helper to convert TLE lines into live coordinates.
 * This uses the SGP4 propagation model.
 */
const propagateLocation = (tleLine1, tleLine2, name, id) => {
    // Initialize the satellite record from TLE [cite: 27, 53]
    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    
    // Get the position at the current time [cite: 54]
    const now = new Date();
    const positionAndVelocity = satellite.propagate(satrec, now);
    const positionEci = positionAndVelocity.position;

    // Convert ECI coordinates to Geodetic (Lat/Lng) 
    const gmst = satellite.gstime(now);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    return {
        id: id, // NORAD Catalog ID [cite: 38, 61]
        name: name, // Object Name [cite: 38, 62]
        lat: satellite.degreesLat(positionGd.latitude), // -90 to 90 [cite: 38, 63]
        lng: satellite.degreesLong(positionGd.longitude), // -180 to 180 [cite: 38, 64]
        alt_km: positionGd.height, // Altitude in km [cite: 38, 65]
        speed_kms: 7.66, // Speed placeholder for demo [cite: 38, 66]
        type: "payload", // Category for FE coloring [cite: 38, 67]
        tle1: tleLine1, // Store for re-propagation
        tle2: tleLine2
    };
};

/**
 * BE-1: Call this after fetching from Space-Track to overwrite the current list[cite: 142].
 */
const setSatellites = (newList) => {
    satelliteStorage = newList;
};

const getSatellites = () => {
    return satelliteStorage;
};

const addSatellite = (satelliteObject) => {
    satelliteStorage.push(satelliteObject);
    return satelliteObject;
};

const removeSatellite = (id) => {
    const index = satelliteStorage.findIndex(s => s.id === id);
    if (index !== -1) {
        return satelliteStorage.splice(index, 1)[0];
    }
    return null;
};

module.exports = {
    getSatellites,
    setSatellites,
    addSatellite,
    removeSatellite,
    propagateLocation
};