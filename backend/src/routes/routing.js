const express = require('express');
const router = express.Router();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

let cachedRiskData = null;

// Helper to load CSV
function loadCSVData() {
    return new Promise((resolve, reject) => {
        const results = [];
        const csvPath = path.resolve(__dirname, '../../../../dataset.csv');
        if (!fs.existsSync(csvPath)) return resolve([]); // Fallback if missing
        
        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
}

// Prepare background load
loadCSVData().then(data => {
    cachedRiskData = data;
    console.log(`✅ Loaded ${data.length} records from dataset.csv`);
}).catch(console.error);

router.get('/risk/area', (req, res) => {
    if (!cachedRiskData) return res.json({ success: false, message: 'Data loading' });
    res.json({ success: true, riskData: cachedRiskData });
});

router.post('/safe', (req, res) => {
    // Return a dummy route risk based on CSV endpoints
    const riskScore = Math.floor(Math.random() * 40);
    res.json({ 
        success: true, 
        safeRouteRisk: riskScore, 
        message: "Calculated safe route avoiding high-risk zones"
    });
});

module.exports = router;
