let map;
let marker;
let dataLayer;
let safeSpotsLayer;
let allRiskData = [];

// Init Leaflet map, handle both Stitch static image AND fullscreen map div
setTimeout(() => {
    let mapDiv = document.getElementById('leaflet-map');
    
    // If it's the Hub page, we need to replace the Stitch image
    if (!mapDiv) {
        const mapContainers = document.querySelectorAll('img[data-alt*="map"]');
        if (!mapContainers.length) return; // Not a map page at all
        
        const stitchedMap = mapContainers[0];
        const parent = stitchedMap.parentElement;
        
        mapDiv = document.createElement('div');
        mapDiv.id = 'leaflet-map';
        mapDiv.style.width = "100%";
        mapDiv.style.height = "100%";
        mapDiv.style.opacity = "0.9";
        
        parent.insertBefore(mapDiv, stitchedMap);
        stitchedMap.style.display = 'none';
    }

    // Initialize Map roughly centered on India based on your DB
    map = L.map(mapDiv).setView([21.1458, 79.0882], 5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    // Leaflet Routing Machine Integration (Dynamic Start/End)
    if (typeof L.Routing !== 'undefined') {
        const startLat = (state && state.location) ? state.location.lat : 21.1458;
        const startLon = (state && state.location) ? state.location.lon : 79.0882;

        window.routingControl = L.Routing.control({
            waypoints: [
                L.latLng(startLat, startLon), // Dynamic Start Point
                L.latLng(21.1195, 79.0497)  // Default Destination (Nagpur Landmark)
            ],
            routeWhileDragging: true,
            showAlternatives: true,
            geocoder: L.Control.Geocoder.nominatim(),
            altLineOptions: {
                styles: [
                    {color: 'black', opacity: 0.15, weight: 9}, 
                    {color: 'white', opacity: 0.8, weight: 6}, 
                    {color: 'gray', opacity: 0.5, weight: 2}
                ]
            },
            lineOptions: {
                styles: [{color: '#896790', opacity: 0.9, weight: 6, lineCap: 'round'}] // Primary Safe Route
            },
            createMarker: function(i, wp) {
                return L.marker(wp.latLng, {
                    draggable: true,
                    icon: L.icon({
                        iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', // Custom marker
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    })
                }).bindPopup(i === 0 ? "<b>Your Start</b>" : "<b>Safety Destination</b>");
            }
        }).addTo(map);

        // Allow user to CLICK to set destination
        map.on('click', function(e) {
            const waypoints = window.routingControl.getWaypoints();
            
            // Check if there's a nearby SAFE SPOT within 500m to "snap" to a safe destination
            let targetPoint = e.latLng;
            let nearestSafe = null;
            let minDist = Infinity;
            
            allRiskData.forEach(pt => {
                if(pt.safe_spot && pt.safe_spot.toLowerCase() === 'yes') {
                    const dist = e.latLng.distanceTo([pt.lat, pt.lng]);
                    if(dist < 500 && dist < minDist) {
                        minDist = dist;
                        nearestSafe = L.latLng(pt.lat, pt.lng);
                    }
                }
            });

            if(nearestSafe) {
                targetPoint = nearestSafe;
                console.log("Snapped to nearest Safe Zone: ", targetPoint);
            }

            window.routingControl.setWaypoints([
                waypoints[0].latLng, // Keep current user location/start
                targetPoint         // New clicked (and potentially snapped) destination
            ]);
            
            // Highlight the change visually
            L.popup()
                .setLatLng(targetPoint)
                .setContent(nearestSafe ? "<b>Destination: Verified Safe Zone</b>" : "<b>Custom Destination Set</b>")
                .openOn(map);
        });
    }

    dataLayer = L.layerGroup().addTo(map);
    safeSpotsLayer = L.layerGroup(); // Not added immediately

    // Fetch risk areas
    fetch(window.location.origin + '/api/routes/risk/area')
        .then(r => r.json())
        .then(data => {
            if(data.success && data.riskData) {
                allRiskData = data.riskData;
                
                allRiskData.forEach(pt => {
                    const lat = parseFloat(pt.lat);
                    const lng = parseFloat(pt.lng);
                    if (isNaN(lat) || isNaN(lng)) return;

                    const isSafe = pt.safe_spot && pt.safe_spot.toLowerCase() === 'yes';
                    
                    const color = isSafe ? '#4CAF50' : (parseFloat(pt.risk) > 0.6 ? '#F44336' : '#FF9800');
                    const fillOpa = isSafe ? 0.8 : parseFloat(pt.risk) * 0.7;
                    const radius = isSafe ? 8 : (parseInt(pt.num_incidents || 1) * 3 + 5);

                    const circle = L.circleMarker([lat, lng], {
                        radius: radius,
                        fillColor: color,
                        color: color,
                        weight: 1,
                        opacity: 1,
                        fillOpacity: fillOpa
                    }).bindPopup(`<b>${pt.location}</b><br/>${isSafe ? 'Verified Safe Zone' : pt.crime_type + ' Zone'}<br/>Risk: ${pt.risk || 'Low'}`);
                    
                    if (isSafe) {
                        circle.addTo(safeSpotsLayer);
                    } else {
                        circle.addTo(dataLayer);
                    }
                });
            }
        });

}, 200);

window.showOnlySafeZones = function() {
    if (!map) return;
    map.removeLayer(dataLayer);
    if (!map.hasLayer(safeSpotsLayer)) {
        map.addLayer(safeSpotsLayer);
    }
    // Fly to first safe spot roughly
    map.flyTo([21.1195, 79.0497], 12); 
};

window.updateMapMarker = function(coords) {
    if (!map) return;
    if (!marker) {
        map.setView([coords.lat, coords.lon], 15);
        marker = L.marker([coords.lat, coords.lon]).addTo(map)
            .bindPopup('<b>You are here</b><br>Protected').openPopup();
    } else {
        marker.setLatLng([coords.lat, coords.lon]);
    }
};

window.drawDangerZone = function(coords) {
    if (!map) return;
    const dangerCircle = L.circle([coords[1], coords[0]], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.5,
        radius: 100
    }).addTo(map);

    dangerCircle.bindPopup("Active Incident Here").openPopup();
    
    setTimeout(() => {
        if(map.hasLayer(dangerCircle)) map.removeLayer(dangerCircle);
    }, 60000);
}
