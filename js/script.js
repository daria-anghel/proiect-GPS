let map;
let userMarker;
let routeLayer;
let userCoords;
let destinationMarker;
let routeInfoLabel;
const routesHistory = {};

// funcție pentru animarea rutei
function animateRoute(coords, routeStyle) {
    let index = 0;

    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    routeLayer = L.polyline([], routeStyle).addTo(map);

    const totalDuration = 1000; // 1 secunda vizibila
    const steps = 100;          // câți pași vizuali
    const pointsPerStep = Math.ceil(coords.length / steps);
    const stepTime = totalDuration / steps;

    function drawStep() {
        if (index >= coords.length) {
            return;
        }

        const nextIndex = Math.min(index + pointsPerStep, coords.length);
        routeLayer.setLatLngs(coords.slice(0, nextIndex));
        index = nextIndex;

        setTimeout(drawStep, stepTime);
    }

    drawStep();
}
// icon marker verde închis
const greenIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet-color-markers/img/marker-icon-2x-darkgreen.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const blueIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet-color-markers/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// funcție pentru formatarea duratei
function formatDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);

    if (totalMinutes < 60) {
        return `${totalMinutes} min`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return minutes === 0
        ? `${hours} h`
        : `${hours} h ${minutes} min`;
}

// inițializare hartă
function initMap() {

    map = L.map('map').setView([45.6579, 25.6012], 13); //bv

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // obține localizația utilizatorului
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoords = [pos.coords.latitude, pos.coords.longitude];
                userMarker = L.marker(userCoords).addTo(map).bindPopup("Ești aici!").openPopup();
                map.setView(userCoords, 14);
            },
            () => console.error("Nu am putut accesa locația ta.")
        );
    } else {
        console.error("Browserul tău nu suportă geolocația.");
    }

    //enter pentru input
    const destinatieInput = document.getElementById('destinatie');
    if (destinatieInput) {
        destinatieInput.addEventListener('keyup', function (event) {
            //verificare tasta Enter
            if (event.key === 'Enter' || event.keyCode === 13) {
                event.preventDefault();
                cautaRuta();
            }
        });
    }
}

// caută rută
async function cautaRuta() {
    //vericare initializare harta
    if (!map) {
        console.error("Harta nu este inițializată. Așteptați finalizarea initMap().");
        return;
    }

    const destinatie = document.getElementById('destinatie').value;
    if (!destinatie || !userCoords) {
        console.warn("Introdu o destinație și permite accesul la locație!");
        return;
    }

    const istoricDropdown = document.getElementById('istoric-dropdown');
    if (istoricDropdown) {
        // verifică dacă există deja ruta pentru a nu duplica
        const exista = Array.from(istoricDropdown.options).some(opt => opt.value === destinatie);
        if (!exista) {
            // limită la 20 de rute
            if (istoricDropdown.options.length >= 21) { // +1 pentru opțiunea default
                istoricDropdown.remove(1); // elimină primul element adăugat după placeholder
            }

            const option = document.createElement('option');
            option.value = destinatie;
            option.textContent = destinatie;
            istoricDropdown.appendChild(option);
        }
    }


    // geocodare text -> destinatie (Nominatim)
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinatie)}`;

    // implementare exponential backoff pentru Nominatim
    let geoData = [];
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const geoResponse = await fetch(geocodeUrl);
            geoData = await geoResponse.json();
            break;
        } catch (error) {
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            } else {
                console.error("Eroare la geocodare (Nominatim).", error);
                return;
            }
        }
    }


    if (geoData.length === 0) {
        console.warn("Locația destinatiei nu a fost găsită!");
        return;
    }

    const destCoords = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];

    // solicitare sursa 
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjVlNTNhMjUxYWE2ODQ0ZTdhY2JiNzhjMTI1ZGVmZWFhIiwiaCI6Im11cm11cjY0In0="; // înlocuiește cu cheia ta!
    const mod = document.getElementById('modDeplasare').value;

    const routeUrl = `https://api.openrouteservice.org/v2/directions/${mod}?api_key=${apiKey}&start=${userCoords[1]},${userCoords[0]}&end=${destCoords[1]},${destCoords[0]}`;

    let routeData;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const routeResponse = await fetch(routeUrl);
            routeData = await routeResponse.json();
            if (routeData.features && routeData.features.length > 0) break;

        } catch (error) {
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            } else {
                console.error("Eroare la solicitarea rutei (OpenRouteService).", error);
                return;
            }
        }
    }

    if (!routeData.features || routeData.features.length === 0) {
        console.error("Nu s-a putut genera ruta. Verificați răspunsul API-ului în consolă (F12).");
        console.log("Răspuns API:", routeData);
        return;
    }

    //convertire coordonate pentru Leaflet
    const coords = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
    const midIndex = Math.floor(coords.length / 2);
    const midPoint = coords[midIndex];
    const summary = routeData.features[0].properties.summary;
    const distanceKm = (summary.distance / 1000).toFixed(1);
    const formattedDuration = formatDuration(summary.duration);
    routesHistory[destinatie] = {
        coords: coords,
        destCoords: destCoords
    };
    //eliminare ruta veche daca exista
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    // eliminare eticheta veche (dacă există)
    if (routeInfoLabel) {
        map.removeLayer(routeInfoLabel);
        routeInfoLabel = null;
    }

    // stil rută în funcție de modul de deplasare
    const routeStyle = {
        color: '#0066ff',
        weight: 5,
        opacity: 1
    };

    // linie discontinua pentru mers pe jos
    if (mod === 'foot-walking') {
        routeStyle.weight = 4;
        routeStyle.opacity = 0.75;
        routeStyle.dashArray = '6, 10';
    }

    // adaugare ruta noua
    animateRoute(coords, routeStyle);
    const iconSymbol = mod === 'foot-walking' ? '🚶' : '🚗';

    // formatare durata
    routeInfoLabel = L.marker(midPoint, {
        icon: L.divIcon({
            className: 'route-info-wrapper',
            html: `
            <div class="route-label">
                ${iconSymbol} ${formattedDuration} • ${distanceKm} km
            </div>
        `,
            iconSize: null
        }),
        interactive: false
    }).addTo(map);

    // ștergere marker destinație anterior
    if (destinationMarker) {
        map.removeLayer(destinationMarker);
    }

    // adăugare marker destinație nou
    destinationMarker = L.marker(destCoords, { icon: blueIcon })
        .addTo(map)
        .bindPopup(`<b>${destinatie}</b>`)
        .openPopup();
    //ajustare vizualizare harta
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 17
    });

    if (statusMsg) {
        statusMsg.textContent = 'Rută generată';
        setTimeout(() => statusMsg.classList.remove('active'), 1200);
    }
    // delete marker of previous destination
}

document.getElementById("destinatie").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();   // evită refresh sau submit implicit
        cautaRuta();              // apelează funcția exact ca butonul
    }
});

document.getElementById('istoric-dropdown').addEventListener('change', function () {
    const selected = this.value;
    const route = routesHistory[selected];

    if (!route) {
        return;
    }
    document.getElementById('destinatie').value = selected;
    // ștergere rută veche
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    // ștergere marker destinație vechi
    if (destinationMarker) {
        map.removeLayer(destinationMarker);
    }

    const mod = document.getElementById('modDeplasare').value;

    const routeStyle = {
        color: '#0066ff',
        weight: 5,
        opacity: 1
    };

    if (mod === 'foot-walking') {
        routeStyle.dashArray = '8, 10';
    }

    // redesenare rută din istoric
    animateRoute(route.coords, routeStyle);

    // marker destinație
    destinationMarker = L.marker(route.destCoords, { icon: blueIcon })
        .addTo(map)
        .bindPopup(`<b>${selected}</b>`);

    const bounds = L.latLngBounds(route.coords);

    map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 17
    });
});

initMap();

document.getElementById('btn-delete').addEventListener('click', () => {
    const dropdown = document.getElementById('istoric-dropdown');
    while (dropdown.options.length > 1) {
        dropdown.remove(1);
    }
})