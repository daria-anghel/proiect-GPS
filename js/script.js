// ==========================================
// 1. VARIABILE GLOBALE ȘI CONFIGURARE
// ==========================================
let map;
let userMarker;
let routeLayer;
let userCoords;
let destinationMarker;
let geoWatchId = null;
let trafficLayers = [];

// Cheia API pentru rute (OpenRouteService)
const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjVlNTNhMjUxYWE2ODQ0ZTdhY2JiNzhjMTI1ZGVmZWFhIiwiaCI6Im11cm11cjY0In0=";

// Zone de trafic (Poligoane)
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

// Zone de risc (Cercuri portocalii)
const zoneRisc = [
    { nume: "Bartolomeu", lat: 45.6620, lon: 25.5750, raza: 0.6 },
    { nume: "Zona Roman", lat: 45.6350, lon: 25.6150, raza: 0.5 },
    { nume: "Zona Gării", lat: 45.6600, lon: 25.6100, raza: 0.4 },
    { nume: "Gemenii (DJ 103A)", lat: 45.6482, lon: 25.6258, raza: 0.4 }
];

// ==========================================
// 2. FUNCȚII UTILITARE (Matematică și Formatare)
// ==========================================

// Setează ora curentă în input
function setOraCurenta() {
    const acum = new Date();
    const oraFormatata = acum.getHours().toString().padStart(2, '0') + ":" +
        acum.getMinutes().toString().padStart(2, '0');
    const inputOra = document.getElementById('oraPlecareInput');
    if (inputOra) inputOra.value = oraFormatata;
}

// Formatare durată (ex: 75 min -> 1 h 15 min)
function formatDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

// Calcul distanță între coordonate (Formula Haversine)
function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Desenare zone trafic (Poligoane)
function actualizeazaCuloriTrafic() {
    // Ștergem straturile vechi
    trafficLayers.forEach(l => map.removeLayer(l));
    trafficLayers = [];

    const oraInput = document.getElementById('oraPlecareInput').value;
    const ora = oraInput ? parseInt(oraInput.split(':')[0]) : new Date().getHours();

    for (let z in traficZones) {
        const zona = traficZones[z];
        const aglomerat = zona.peakHours.includes(ora);

        // Roșu dacă e aglomerat, Verde dacă e liber
        const culoare = aglomerat ? "#ff4444" : "#44ff44";

        const poly = L.polygon(zona.coords, {
            color: culoare,
            fillOpacity: 0.3,
            weight: 1
        }).addTo(map);

        poly.bindTooltip(z + (aglomerat ? " (Trafic Intens)" : " (Fluid)"));
        trafficLayers.push(poly);
    }
}

// ==========================================
// 3. LOGICA PRINCIPALĂ (Harta și Rutare)
// ==========================================

function initMap() {
    // Inițializare hartă pe Brașov
    map = L.map('map', { zoomSnap: 0.1, zoomDelta: 0.5 }).setView([45.6579, 25.6012], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // 1. Desenăm cercurile de risc permanent
    zoneRisc.forEach(z => {
        L.circle([z.lat, z.lon], {
            color: 'orange',
            weight: 2,
            dashArray: '5, 10',
            fillOpacity: 0.1,
            radius: z.raza * 1000
        }).addTo(map).bindTooltip("Zonă risc: " + z.nume);
    });

    // 2. Localizare Utilizator
    const blueDotIcon = L.divIcon({
        className: 'user-location-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });

    if (navigator.geolocation) {
        geoWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                userCoords = [pos.coords.latitude, pos.coords.longitude];
                if (!userMarker) {
                    userMarker = L.marker(userCoords, { icon: blueDotIcon }).addTo(map);
                    userMarker.bindPopup("Ești aici!");
                    map.setView(userCoords, 14);
                } else {
                    userMarker.setLatLng(userCoords);
                }
            },
            (err) => console.error("Eroare geolocație:", err),
            { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
        );
    }

    setOraCurenta();
    actualizeazaCuloriTrafic();

    // 3. Click pe hartă -> Reverse Geocoding (Găsește adresa)
    map.on('click', async function (e) {
        const { lat, lng } = e.latlng;

        L.popup().setLatLng(e.latlng).setContent("Caut adresa...").openOn(map);

        try {
            // Întrebăm serverul ce adresă e acolo
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.display_name) {
                // Scurtăm un pic adresa ca să nu fie kilometrica
                let adresaScurta = data.display_name.split(',').slice(0, 3).join(',');
                document.getElementById('destinatie').value = adresaScurta;
                map.closePopup();
                cautaRuta(); // Declanșăm căutarea automat
            } else {
                // Fallback dacă nu găsește adresa
                document.getElementById('destinatie').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                map.closePopup();
                cautaRuta();
            }
        } catch (err) {
            console.error("Eroare la click:", err);
        }
    });
}

// 4. Funcția principală de calcul rută
async function cautaRuta() {
    if (!map || !userCoords) {
        alert("Așteaptă localizarea GPS sau activează locația!");
        return;
    }

    const destinatieText = document.getElementById('destinatie').value;
    const mod = document.getElementById('modDeplasare').value;
    const oraInput = document.getElementById('oraPlecareInput').value;

    if (!destinatieText) return;

    // A. Geocodare (Transformăm text în coordonate)
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinatieText)}`;
    const geoRes = await fetch(geocodeUrl);
    const geoData = await geoRes.json();

    if (geoData.length === 0) return alert("Locație negăsită!");

    const destCoords = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];

    // B. Cerere Rută la API
    const routeUrl = `https://api.openrouteservice.org/v2/directions/${mod}?api_key=${API_KEY}&start=${userCoords[1]},${userCoords[0]}&end=${destCoords[1]},${destCoords[0]}&preference=fastest`;

    try {
        const routeRes = await fetch(routeUrl);
        const routeData = await routeRes.json();

        if (routeData.features && routeData.features.length > 0) {
            const summary = routeData.features[0].properties.summary;
            const coords = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
            const distanceVal = (summary.distance / 1000).toFixed(1);

            // Calcul Factor Trafic
            let dataPlecare = new Date();
            if (oraInput) {
                const [ore, minute] = oraInput.split(':');
                dataPlecare.setHours(parseInt(ore), parseInt(minute), 0);
            }
            const oraH = dataPlecare.getHours();

            // Simulare trafic simplă
            let factorTrafic = 1.0;
            if ((oraH >= 7 && oraH <= 9) || (oraH >= 16 && oraH <= 18)) {
                factorTrafic = 1.25; // +25% timp la ore de vârf
            }

            const durataCalculataS = summary.duration * factorTrafic;
            const formattedDuration = formatDuration(durataCalculataS);

            // Calcul ore sosire
            const oraSosireDate = new Date(dataPlecare.getTime() + durataCalculataS * 1000);
            const oraSosireStr = oraSosireDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // C. Curățare și Desenare
            if (routeLayer) map.removeLayer(routeLayer);
            if (destinationMarker) map.removeLayer(destinationMarker);

            routeLayer = L.polyline(coords, { color: '#0066ff', weight: 5 }).addTo(map);
            destinationMarker = L.marker(destCoords).addTo(map).bindPopup(destinatieText).openPopup();

            map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

            // D. Verificare Zonă Risc la destinație
            let alertaHtml = "";
            zoneRisc.forEach(z => {
                // Verificăm dacă destinația e în raza vreunei zone de risc
                if (distanceKm(destCoords[0], destCoords[1], z.lat, z.lon) <= z.raza) {
                    alertaHtml = `
                    <div class="warning-box">
                        ⚠️ Atenție: Zona de risc <b>${z.nume}</b>!<br>
                        Ai grijă la bunuri și evită zonele lăturalnice.
                    </div>`;
                }
            });

            // E. Afișare Card
            const card = document.getElementById('route-details-card');
            const content = document.getElementById('card-content');

            if (card && content) {
                card.style.display = 'block';
                const iconSymbol = mod === 'foot-walking' ? '🚶' : '🚗';

                content.innerHTML = `
                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px; color: #fff;">
                        ${iconSymbol} ${formattedDuration}
                    </div>
                    <div style="margin-bottom: 8px; color: #8cff8c; font-weight: 600;">
                        Distanță: ${distanceVal} km
                    </div>
                    <div style="font-size: 13px; line-height: 1.5; color: #ddd;">
                        <span>🏁 Sosire est.:</span> <b style="color: #fff;">${oraSosireStr}</b>
                    </div>
                    ${alertaHtml}
                `;
            }

            actualizeazaIstoric(destinatieText);
        }
    } catch (e) {
        console.error("Eroare API Rută:", e);
        alert("Nu s-a putut calcula ruta. Verifică conexiunea.");
    }
}

// 5. Gestionare Istoric și Căutare
function actualizeazaIstoric(dest) {
    const dropdown = document.getElementById('istoric-dropdown');
    // Verificăm să nu existe deja
    const exista = Array.from(dropdown.options).some(opt => opt.value === dest);
    if (!exista) {
        const option = document.createElement('option');
        option.value = dest;
        option.textContent = dest.substring(0, 30) + "..."; // Scurtăm textul în dropdown
        dropdown.appendChild(option);
    }
}

// Funcție pentru Butoanele Rapide (Chips)
function startNavigareRapida(lat, lng, nume) {
    const input = document.getElementById('destinatie');
    input.value = nume;
    // Simulăm apăsarea butonului de căutare
    cautaRuta();
}

// ==========================================
// 6. EVENT LISTENERS (La încărcarea paginii)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initMap();

    // Buton Căutare
    const btnSearch = document.getElementById('btn-search');
    if (btnSearch) {
        btnSearch.addEventListener('click', cautaRuta);
    }

    // Tasta Enter în input
    document.getElementById('destinatie').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') cautaRuta();
    });

    // Schimbare oră -> Update culori trafic
    document.getElementById('oraPlecareInput').addEventListener('change', actualizeazaCuloriTrafic);

    // Selectare din istoric
    const dropdown = document.getElementById('istoric-dropdown');
    dropdown.addEventListener('change', () => {
        if (dropdown.value && !dropdown.value.startsWith('--')) {
            document.getElementById('destinatie').value = dropdown.value;
            cautaRuta();
        }
    });

    // Ștergere istoric
    document.getElementById('btn-delete').addEventListener('click', () => {
        while (dropdown.options.length > 1) dropdown.remove(1);
        document.getElementById('route-details-card').style.display = 'none';
    });
});