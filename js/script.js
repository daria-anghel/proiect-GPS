// ==========================================
// 1. VARIABILE GLOBALE
// ==========================================
let map, userMarker, routeLayer, destinationMarker;
let userCoords, selectedDestination = null;
let trafficLayers = [];

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

const zoneRisc = [
    { nume: "Bartolomeu", lat: 45.6620, lon: 25.5750, raza: 0.6 },
    { nume: "Zona Roman", lat: 45.6350, lon: 25.6150, raza: 0.5 },
    { nume: "Zona Gării", lat: 45.6600, lon: 25.6100, raza: 0.4 },
    { nume: "Gemenii (DJ 103A / Profi)", lat: 45.6482, lon: 25.6258, raza: 0.4 }
];

// ==========================================
// 2. FUNCȚII UTILITARE & TIMP
// ==========================================

function seteazaOraActuala() {
    const acum = new Date();
    const ore = String(acum.getHours()).padStart(2, '0');
    const minute = String(acum.getMinutes()).padStart(2, '0');
    const inputOra = document.getElementById('oraPlecareInput');
    if (inputOra) inputOra.value = `${ore}:${minute}`;
}

function closeWelcome() {
    const welcome = document.getElementById('welcome-message');
    if (welcome) {
        welcome.classList.add('fade-out'); // Adaugă animația de dispariție
        setTimeout(() => {
            welcome.style.display = 'none'; // Ascunde elementul definitiv
        }, 500);
    }
}

function calculeazaDistanta(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function actualizeazaCuloriTrafic() {
    if (!map) return;
    trafficLayers.forEach(l => map.removeLayer(l));
    trafficLayers = [];
    const oraInput = document.getElementById('oraPlecareInput');
    const ora = oraInput && oraInput.value ? parseInt(oraInput.value.split(':')[0]) : new Date().getHours();

    for (let z in traficZones) {
        const aglomerat = traficZones[z].peakHours.includes(ora);
        const culoare = aglomerat ? "#ff4444" : "#44ff44";
        const poly = L.polygon(traficZones[z].coords, { color: culoare, fillOpacity: 0.4, weight: 2 }).addTo(map);
        trafficLayers.push(poly);
    }
}

// ==========================================
// 3. NAVIGARE AUTOMATĂ
// ==========================================

async function cautaRuta() {
    if (!map || !userCoords) return;
    
    const inputField = document.getElementById('destinatie');
    const destinatieText = inputField.value.trim();
    const mod = document.getElementById('modDeplasare').value;

    let lat, lon;

    if (selectedDestination) {
        lat = selectedDestination.lat;
        lon = selectedDestination.lon;
    } else {
        if (!destinatieText) return;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinatieText + ", Brasov")}`);
        const data = await res.json();
        if (data.length === 0) return;
        lat = parseFloat(data[0].lat);
        lon = parseFloat(data[0].lon);
    }

    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjVlNTNhMjUxYWE2ODQ0ZTdhY2JiNzhjMTI1ZGVmZWFhIiwiaCI6Im11cm11cjY0In0=";
    const url = `https://api.openrouteservice.org/v2/directions/${mod}?api_key=${apiKey}&start=${userCoords[1]},${userCoords[0]}&end=${lon},${lat}`;

    try {
        const routeRes = await fetch(url);
        const routeData = await routeRes.json();

        if (routeData.features && routeData.features.length > 0) {
            if (routeLayer) map.removeLayer(routeLayer);
            if (destinationMarker) map.removeLayer(destinationMarker);

            const coords = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
            routeLayer = L.polyline(coords, { color: '#0066ff', weight: 6 }).addTo(map);
            
            destinationMarker = L.marker([lat, lon]).addTo(map);
            map.fitBounds(routeLayer.getBounds());

            let alertaHtml = "";
            for (let zona of zoneRisc) {
                if (calculeazaDistanta(lat, lon, zona.lat, zona.lon) <= zona.raza) {
                    alertaHtml = `<div class="warning-box">⚠️ Atenție: Zonă risc ${zona.nume}!</div>`;
                    break;
                }
            }

            const card = document.getElementById('route-details-card');
            if (card) {
                card.style.display = 'block';
                document.getElementById('card-content').innerHTML = `
                    <b>Timp:</b> ${Math.round(routeData.features[0].properties.summary.duration / 60)} min<br>
                    <b>Dist:</b> ${(routeData.features[0].properties.summary.distance / 1000).toFixed(1)} km
                    ${alertaHtml}
                `;
            }
        }
    } catch (e) { console.log(e); }
}

// ==========================================
// 4. INIȚIALIZARE
// ==========================================

function initMap() {
    map = L.map('map').setView([45.6579, 25.6012], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    zoneRisc.forEach(z => {
        L.circle([z.lat, z.lon], { color: 'orange', weight: 2, dashArray: '5, 10', fillOpacity: 0.1, radius: z.raza * 1000 }).addTo(map);
    });

    navigator.geolocation.watchPosition(pos => {
        userCoords = [pos.coords.latitude, pos.coords.longitude];
        if (!userMarker) {
            userMarker = L.marker(userCoords, { icon: L.divIcon({className: 'user-location-icon', iconSize: [12, 12]}) }).addTo(map);
        } else {
            userMarker.setLatLng(userCoords);
        }
    }, (err) => {}, { enableHighAccuracy: true });

    map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        selectedDestination = { lat, lon: lng };
        document.getElementById('destinatie').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        await cautaRuta();
    });

    seteazaOraActuala();
    actualizeazaCuloriTrafic();
    
    // Închidere automată mesaj bun venit după 8 secunde
    setTimeout(closeWelcome, 8000);
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    
    document.getElementById('btn-search').addEventListener('click', () => {
        selectedDestination = null; 
        cautaRuta();
    });

    document.getElementById('destinatie').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            selectedDestination = null;
            cautaRuta();
        }
    });

    document.getElementById('oraPlecareInput').addEventListener('change', actualizeazaCuloriTrafic);
});