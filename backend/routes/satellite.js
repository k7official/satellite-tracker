// backend for when user, adds or removes satellite.

const express = require('express');
const router = express.Router();
const { detectCollisions } = require('../collision');
const { getSatellites, addSatellite, removeSatellite } = require('../satellites');
const { kesslerScore } = require('../utils/riskScore');

// listens for a POST request to /api/satellite/add.
router.post('/add', (req, res) => {
    // req.body is the JSON that frontend sends. we destructure it to pull out tle_line1 and tle_line2.
    const { tle_line1, tle_line2 } = req.body; 

    if(!tle_line1 || !tle_line2){
        return res.status(400).json({ 
            error: "INVALID_TLE", 
            message: "Both TLE lines required."
        });
    }

    if(!tle_line1.trim().startsWith("1") || !tle_line2.trim().startsWith("2")){
        return res.status(400).json({ 
            error: "INVALID_TLE", 
            message: "Line 1 must start with '1', Line 2 with '2'." 
        });
    }

    const satellite = require('satellite.js');
    // two line to satellite record. It reads those two cryptic lines and produces a satrec object.
    const satrec = satellite.twoline2satrec(tle_line1, tle_line2);

    const now = new Date();
    // SGP4 algorithm. It takes the orbital parameters and the current time, and calculates exactly where the satellite is 
    // right now in space. Returns posVel which has two things: .position and .velocity.
    const posVel = satellite.propagate(satrec, now);

    if (!posVel.position){
        return res.status(400).json({ 
            error: "PROPAGATION_FAILED", 
            message: "Could not compute position from TLE." 
        });
    }

    // posVel.position gives ECI coordinates, which is fixed to the stars and not rotating with the Earth.
    // We need to return lat/lng/altitude to the frontend. So we calculate GST which converts from star-fixed to Earth-fixed coordinates.
    // Then we use eciToGeodetic to convert ECI to geodetic (lat/lng/alt), but in radians.
    const geo = satellite.eciToGeodetic(posVel.position, satellite.gstime(now)); // converting from ECI to geodetic coordinates (lat, long, alt).

    const newSat = {
        id : String(satrec.satnum), // it is a unique number, extracted from the TLE
        name : `CUSTOM-${satrec.satnum}`,
        lat : parseFloat((geo.latitude * 180 / Math.PI).toFixed(4)), // converting radians to degrees.
        lng : parseFloat((geo.longitude * 180 / Math.PI).toFixed(4)),
        alt_km : parseFloat((geo.height).toFixed(2)),
        speed_kms : 7.5, // approximate speed of LEO satellites in km/s.
        type : "payload",
        tle1: tle_line1, 
        tle2: tle_line2
    }

    // const newSat = propagateLocation(tle_line1, tle_line2, `CUSTOM-${satrec.satnum}`, String(satrec.satnum));

    addSatellite(newSat); // add new satellite to live list of satellites.
    const allObjects = getSatellites(); // get the updated list.
    
    const allCollisions = detectCollisions(allObjects); // returns all collision pairs.
    // only return those collisions which involve the new satellite.
    const newCollisions = allCollisions.filter(c => c.sat1 === newSat.id || c.sat2 === newSat.id); 

    // defaults to 200 response.
    res.json({
        added: newSat,
        satellites: allObjects,
        new_collisions: newCollisions,
        // kessler: kesslerScore(allObjects),  // { score: 43, label: "ELEVATED" }
        last_updated: now.toISOString()
    });
});

// listens for DELETE requests
router.delete('/:id', (req, res) => {
    const { id } = req.params; // get the satellite id from the URL parameter.

    const before = getSatellites(); // get the full current list
    const target = before.find(s => s.id === id); // find the satellite that we want to remove.

    // if that satellite doesn't exist.
    if (!target){
        return res.status(404).json({ 
            error: "NOT_FOUND", 
            message: `No satellite with id ${id} found.` 
        });
    }

    const collisionsBefore = detectCollisions(before);
    // calculate how many collisions the target satellite was involved in.
    const involvedBefore = collisionsBefore.filter(
        c => c.sat1 === id || c.sat2 === id
    ).length;

    removeSatellite(id); // remove the satellite from the list.
    const after = getSatellites(); // fetch the updated list.

    const collisionsAfter = detectCollisions(after); // get collisions after removal.

    const resolved = involvedBefore; // count of resolved collisions after the satellite's removal.

    res.json({
    removed: { 
      id: target.id, 
      name: target.name 
    },
    impact: {
      collisions_resolved: resolved,
      risk_delta: resolved > 0 ? "REDUCED" : "UNCHANGED",
      summary: `Removing this object resolved ${resolved} conjunction warning${resolved !== 1 ? 's' : ''}.`
    },
    satellites: after,
    collisions: collisionsAfter,
    // kessler: kesslerScore(after),
    last_updated: new Date().toISOString()
  });
});

module.exports = router;