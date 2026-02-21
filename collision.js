// we will be having a list of satellites and a list of debris. And we will be checking if any 2 of them are dangerously close.

function computeDistance(sat1, sat2){
    // Radius of the Earth in kilometers.
    const R = 6371; // We need this, in order to convert the latitudes and longitudes into actual 3D coordinates.
    const toRad = deg => deg * Math.PI / 180; // Convert degrees to radians, because Math functions in JavaScript use radians, but the lat and long are in degrees.

    // spherical to cartesian conversion
    const x1 = (R + sat1.alt_km) * Math.cos(toRad(sat1.lat)) * Math.cos(toRad(sat1.lng));    
    const y1 = (R + sat1.alt_km) * Math.cos(toRad(sat1.lat)) * Math.sin(toRad(sat1.lng));    
    const z1 = (R + sat1.alt_km) * Math.sin(toRad(sat1.lat));

    const x2 = (R + sat2.alt_km) * Math.cos(toRad(sat2.lat)) * Math.cos(toRad(sat2.lng));
    const y2 = (R + sat2.alt_km) * Math.cos(toRad(sat2.lat)) * Math.sin(toRad(sat2.lng));
    const z2 = (R + sat2.alt_km) * Math.sin(toRad(sat2.lat));

    // calculating the straight-line distance between the two satellites in km.
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
}

function getRiskLevel(distance_km){
    if (distance_km <= 5) return "High Risk";
    if (distance_km <= 25) return "Medium Risk";
    if (distance_km <= 50) return "Low Risk";
    return null; // No risk. returning null to indicate that we don't need to report this pair of satellites, in below function.
}

function detectCollisions(objects){
    const collisions = []; // we will push risky pairs of satellites into this array.
    const ALTITUDE_BAND = 50; // only check 2 objects for collision, if they are within 50 km of each other in altitude.
    // This is an optimization. 

    // checking every unique pair of satellites.
    for (let i = 0; i < objects.length; i++){
        for (let j = i+1; j < objects.length; j++){

            // if the 2 objects are not withing 50km of each other in altitude, skip the further calculations.
            if (Math.abs(objects[i].alt_km - objects[j].alt_km) > ALTITUDE_BAND) continue;

            const dist = computeDistance(objects[i], objects[j]);
            const risk = getRiskLevel(dist);

            if (risk){ // this only runs if the risk is HIGH, MEDIUM or LOW.
                collisions.push({
                    sat1: objects[i].id,
                    sat2: objects[j].id,
                    distance_km: parseFloat(dist.toFixed(2)), // rounding to 2 decimal places for better readability
                    risk,
                    time_to_closest: "00:00:00" // Placeholder. It tells time to collision.
                });
            }

            return collisions;
        }
    }
}

module.exports = { computeDistance, getRiskLevel, detectCollisions };

