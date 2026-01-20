// ==========================================
// 1. VARIABILE GLOBALE ȘI CONFIGURARE
// ==========================================
let map, userMarker, routeLayer, destinationMarker, selectedPointMarker;
let userCoords, selectedDestination = null;
let trafficLayers = [];

// Poligoane pentru vizualizarea traficului
const traficZones = {
    "Calea București": {
        coords: [[45.6350, 25.6150], [45.6320, 25.6350], [45.6150, 25.6550], [45.6100, 25.6450]],
        peakHours: [7, 8, 9, 16, 17, 18]
    },
    "Centrul Civic": {
        coords: [[45.6550, 25.6050], [45.6580, 25.6150], [45.6520, 25.6200], [45.6480, 25.6100]],
        peakHours: [8, 9, 12, 16, 17, 18, 19]
    },
    "Bartolomeu": {
        coords: [[45.6620, 25.5750], [45.6680, 25.5850], [45.6600, 25.5950], [45.6550, 25.5850]],
        peakHours: [7, 8, 16, 17, 18]
    },
    "Gemenii / DJ 103A": {
        coords: [[45.6495, 25.6240], [45.6510, 25.6280], [45.6470, 25.6310], [45.6455, 25.6265]],
        peakHours: [7, 8, 9, 16, 17, 18, 19]
    }
};

// Zone de risc (Cercuri de avertizare) - Raze reduse pentru precizie
const zoneRisc = [
    { nume: "Bartolomeu", lat: 45.6620, lon: 25.5750, raza: 0.6 },
    { nume: "Zona Roman", lat: 45.6350, lon: 25.6150, raza: 0.5 },
    { nume: "Zona Gării", lat: 45.6600, lon: 25.6100, raza: 0.4 },
    { nume: "Gemenii (DJ 103A / Profi)", lat: 45.6482, lon: 25.6258, raza: 0.4 }
];

// ==========================================
// 2. FUNCȚII UTILITARE
// ==========================================

// Calcul distanță între coordonate (Formula Haversine)
function calculeazaDistanta(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Actualizare vizuală a poligoanelor de trafic
function actualizeazaCuloriTrafic() {
    trafficLayers.forEach(l => map.removeLayer(l));
    trafficLayers = [];
    
    const oraInput = document.getElementById('oraPlecareInput').value;
    const ora = oraInput ? parseInt(oraInput.split(':')[0]) : new Date().getHours();

    for (let z in traficZones) {
        const aglomerat = traficZones[z].peakHours.includes(ora);
        const culoare = aglomerat ? "#ff4444" : "#44ff44";
        const poly = L.polygon(traficZones[z].coords, { 
            color: culoare, 
            fillOpacity: 0.4,
            weight: 2 
        }).addTo(map);
        poly.bindTooltip(z + (aglomerat ? " (Trafic Mare)" : " (Trafic Liber)"));
        trafficLayers.push(poly);
    }
}

// ==========================================
// 3. LOGICĂ RUTARE ȘI CĂUTARE
// ==========================================

async function cautaRuta() {
    if (!map || !userCoords) return alert("Așteaptă localizarea GPS!");
    
    const textInput = document.getElementById('destinatie').value.trim();
    if (!textInput) return;

    let lat, lon;

    // Prioritate: Punct selectat prin click pe hartă
    if (selectedDestination) {
        lat = selectedDestination.lat;
        lon = selectedDestination.lon;
    } else {
        // Căutare prin text (Nominatim API)
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(textInput + ", Brasov")}`);
            const data = await res.json();
            if (data.length === 0) return alert("Locație negăsită în Brașov!");
            lat = parseFloat(data[0].lat);
            lon = parseFloat(data[0].lon);
        } catch (e) {
            console.error("Eroare la căutare:", e);
            return;
        }
    }

    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjVlNTNhMjUxYWE2ODQ0ZTdhY2JiNzhjMTI1ZGVmZWFhIiwiaCI6Im11cm11cjY0In0=";
    const mod = document.getElementById('modDeplasare').value;
    const url = `https://api.openrouteservice.org/v2/directions/${mod}?api_key=${apiKey}&start=${userCoords[1]},${userCoords[0]}&end=${lon},${lat}`;

    try {
        const routeRes = await fetch(url);
        const routeData = await routeRes.json();

        if (routeData.features && routeData.features.length > 0) {
            if (routeLayer) map.removeLayer(routeLayer);
            if (destinationMarker) map.removeLayer(destinationMarker);

            const coords = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
            routeLayer = L.polyline(coords, { color: '#0066ff', weight: 5 }).addTo(map);
            destinationMarker = L.marker([lat, lon]).addTo(map).bindPopup(textInput).openPopup();
            map.fitBounds(routeLayer.getBounds());

            // Verificare zonă risc la destinație
            let alertaHtml = "";
            zoneRisc.forEach(z => {
                if (calculeazaDistanta(lat, lon, z.lat, z.lon) <= z.raza) {
                    alertaHtml = `<div class="warning-box" style="background:#ffcc00; color:black; padding:10px; border-radius:8px; margin-top:10px; font-weight:bold; border-left:5px solid #cc3300;">
                                    ⚠️ Atenție: Zona de risc ${z.nume}! Ai grijă la bunuri.
                                  </div>`;
                }
            });

            document.getElementById('route-details-card').style.display = 'block';
            document.getElementById('card-content').innerHTML = `
                <b>Timp estimat:</b> ${Math.round(routeData.features[0].properties.summary.duration / 60)} min<br>
                <b>Distanță:</b> ${(routeData.features[0].properties.summary.distance / 1000).toFixed(1)} km
                ${alertaHtml}
            `;
        }
    } catch (e) {
        console.error("Eroare la calcularea rutei:", e);
    }
}

// ==========================================
// 4. INIȚIALIZARE HARTĂ
// ==========================================

function initMap() {
    map = L.map('map', { zoomSnap: 0.1 }).setView([45.6579, 25.6012], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Desenare permanentă cercuri risc
    zoneRisc.forEach(z => {
        L.circle([z.lat, z.lon], { 
            color: 'orange', 
            weight: 2, 
            dashArray: '5, 10', 
            fillOpacity: 0.1, 
            radius: z.raza * 1000 
        }).addTo(map).bindTooltip("Zonă risc: " + z.nume);
    });

    // Geolocație utilizator
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(pos => {
            userCoords = [pos.coords.latitude, pos.coords.longitude];
            if (!userMarker) {
                userMarker = L.marker(userCoords, { 
                    icon: L.divIcon({ className: 'user-location-icon', iconSize: [16, 16] }) 
                }).addTo(map).bindPopup("Ești aici!");
            } else {
                userMarker.setLatLng(userCoords);
            }
        });
    }

    // Click pe hartă pentru a alege destinația
    map.on('click', e => {
        const { lat, lng } = e.latlng;
        selectedDestination = { lat, lon: lng };
        document.getElementById('destinatie').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        
        if (selectedPointMarker) map.removeLayer(selectedPointMarker);
        selectedPointMarker = L.marker([lat, lng]).addTo(map).bindPopup("Destinație setată").openPopup();
    });

    actualizeazaCuloriTrafic();
}

// Mesaj de bun venit
function closeWelcome() {
    const el = document.getElementById('welcome-message');
    if (el) el.style.display = 'none';
}

// Evenimente DOM
document.addEventListener('DOMContentLoaded', () => {
    initMap();

    // Căutare la buton
    document.getElementById('btn-search').addEventListener('click', () => {
        selectedDestination = null; // Resetăm selecția manuală pentru a folosi textul
        cautaRuta();
    });

    // Căutare la tasta Enter
    document.getElementById('destinatie').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            selectedDestination = null;
            cautaRuta();
        }
    });

    // Schimbare oră -> update trafic
    document.getElementById('oraPlecareInput').addEventListener('change', actualizeazaCuloriTrafic);
    
    setTimeout(closeWelcome, 6000);
});