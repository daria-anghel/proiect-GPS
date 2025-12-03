let map;
let userMarker;
let routeLayer;
let userCoords;

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

// inițializare hartă
function initMap() {

    map = L.map('map').setView([45.6579, 25.6012], 13); // bv

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

    document.getElementById('btn-delete').addEventListener('click', () => {
        const dropdown = document.getElementById('istoric-dropdown');
        // păstrează doar primul element (placeholder)
        while (dropdown.options.length > 1) {
            dropdown.remove(1);
        }
    });


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

    //eliminare ruta veche daca exista
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    //adaugare ruta noua
    routeLayer = L.polyline(coords, { color: '#39ff14', weight: 5, opacity: 0.8 }).addTo(map);

    //adaugare marker destinatie
    L.marker(destCoords, { icon: blueIcon })
        .addTo(map)
        .bindPopup(`<b> ${destinatie}</b>`)
        .openPopup();

    //ajustare vizualizare harta
    map.fitBounds(routeLayer.getBounds());
}

initMap();