let map;
let userMarker;
let routeLayer;
let userCoords;
let destinationMarker;
let routeInfoLabel;
const routesHistory = {};

// 1. Funcție pentru a seta/reseta ora la momentul curent
function setOraCurenta() {
    const acum = new Date();
    const oraFormatata = acum.getHours().toString().padStart(2, '0') + ":" + 
                         acum.getMinutes().toString().padStart(2, '0');
    const inputOra = document.getElementById('oraPlecareInput');
    if (inputOra) inputOra.value = oraFormatata;
}

// 2. Inițializare Hartă
function initMap() {
    map = L.map('map', {
        zoomSnap: 0.1,
        zoomDelta: 0.5
    }).setView([45.6579, 25.6012], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoords = [pos.coords.latitude, pos.coords.longitude];
                
                // Creăm iconița personalizată (cercul albastru tip GPS)
                const blueDotIcon = L.divIcon({
                    className: 'user-location-icon',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8]
                });

                userMarker = L.marker(userCoords, { icon: blueDotIcon }).addTo(map);
                userMarker.bindPopup("Ești aici!").openPopup();
                map.setView(userCoords, 14);
            },
            () => console.error("Eroare la obținerea locației.")
        );
    }
    
    // Setăm ora curentă la pornirea aplicației
    setOraCurenta();
}

// 3. Funcție formatare durată
function formatDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

// 4. Funcția principală de calcul rută
async function cautaRuta() {
    if (!map || !userCoords) {
        alert("Așteaptă localizarea GPS!");
        return;
    }

    const destinatie = document.getElementById('destinatie').value;
    const mod = document.getElementById('modDeplasare').value;
    const oraInput = document.getElementById('oraPlecareInput').value;
    
    if (!destinatie) return;

    // Geocodare Nominatim
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinatie)}`;
    const geoRes = await fetch(geocodeUrl);
    const geoData = await geoRes.json();
    if (geoData.length === 0) return alert("Locație negăsită!");

    const destCoords = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];

    // OpenRouteService API
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjVlNTNhMjUxYWE2ODQ0ZTdhY2JiNzhjMTI1ZGVmZWFhIiwiaCI6Im11cm11cjY0In0=";
    const routeUrl = `https://api.openrouteservice.org/v2/directions/${mod}?api_key=${apiKey}&start=${userCoords[1]},${userCoords[0]}&end=${destCoords[1]},${destCoords[0]}`;

    const routeRes = await fetch(routeUrl);
    const routeData = await routeRes.json();

    if (routeData.features && routeData.features.length > 0) {
        const summary = routeData.features[0].properties.summary;
        const coords = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);

        const distanceKm = (summary.distance / 1000).toFixed(1);
        const iconSymbol = mod === 'foot-walking' ? '🚶' : '🚗';

        // --- LOGICA ORA PLECARE ALEASĂ ---
        let dataPlecare = new Date();
        if (oraInput) {
            const [ore, minute] = oraInput.split(':');
            dataPlecare.setHours(parseInt(ore), parseInt(minute), 0);
        }
        const oraH = dataPlecare.getHours();

        // --- LOGICA TRAFIC BAZATĂ PE ORA ALEASĂ ---
        let factorTrafic = 1.1; // Trafic normal
        if ((oraH >= 7 && oraH < 9) || (oraH >= 12 && oraH < 15) || (oraH >= 18 && oraH < 20)) {
            factorTrafic = 1.5; // Trafic mare
        } else if (oraH >= 0 && oraH < 7) {
            factorTrafic = 0.8; // Trafic liber (noapte)
        }

        const durataCalculataS = summary.duration * factorTrafic;
        const formattedDuration = formatDuration(durataCalculataS);

        // --- CALCUL ORE ---
        const oraPlecareStr = dataPlecare.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const oraSosireDate = new Date(dataPlecare.getTime() + durataCalculataS * 1000);
        const oraSosireStr = oraSosireDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // --- CURĂȚARE HARTĂ ---
        if (routeLayer) map.removeLayer(routeLayer);
        if (destinationMarker) map.removeLayer(destinationMarker);
        if (routeInfoLabel) map.removeLayer(routeInfoLabel);

        // --- DESENARE RUTĂ ---
        routeLayer = L.polyline(coords, { color: '#0066ff', weight: 5 }).addTo(map);
        destinationMarker = L.marker(destCoords).addTo(map).bindPopup(destinatie).openPopup();

        // --- AFIȘARE ÎN CARDUL DIN DREAPTA JOS ---
        const card = document.getElementById('route-details-card');
        const content = document.getElementById('card-content');

        if (card && content) {
            card.style.display = 'block';
            content.innerHTML = `
                <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px; color: #fff;">
                    ${iconSymbol} ${formattedDuration}
                </div>
                <div style="margin-bottom: 8px; color: #8cff8c; font-weight: 600;">
                    Distanță: ${distanceKm} km
                </div>
                <div style="font-size: 13px; line-height: 1.5;">
                    <span style="color: #aaa;">🛫 Plecare la:</span> <b>${oraPlecareStr}</b><br>
                    <span style="color: #aaa;">🏁 Sosire est.:</span> <b>${oraSosireStr}</b>
                </div>
            `;
        }

        map.fitBounds(routeLayer.getBounds());
        actualizeazaIstoric(destinatie);
    }
}

// 5. Gestionare Istoric
function actualizeazaIstoric(dest) {
    const dropdown = document.getElementById('istoric-dropdown');
    const exista = Array.from(dropdown.options).some(opt => opt.value === dest);
    if (!exista) {
        const option = document.createElement('option');
        option.value = dest;
        option.textContent = dest;
        dropdown.appendChild(option);
    }
}

// cautare la enter
document.getElementById('destinatie').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        cautaRuta();
    }
});


// stergere istoric
document.getElementById('btn-delete').addEventListener('click', () => {
    const dropdown = document.getElementById('istoric-dropdown');
    while (dropdown.options.length > 1) dropdown.remove(1);
    // Ascundem cardul la ștergerea istoricului (opțional)
    document.getElementById('route-details-card').style.display = 'none';
});



// Pornire aplicație
initMap();