let map;
let userMarker;
let routeLayer;
let userCoords;

// 🔹 Inițializare hartă
function initMap() {
    map = L.map('map').setView([45.6579, 25.6012], 13); // Brașov

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // 🔹 Obține locația utilizatorului
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userCoords = [pos.coords.latitude, pos.coords.longitude];
                userMarker = L.marker(userCoords).addTo(map).bindPopup("Ești aici!").openPopup();
                map.setView(userCoords, 14);
            },
            () => alert("Nu am putut accesa locația ta.")
        );
    } else {
        alert("Browserul tău nu suportă geolocația.");
    }
}

// 🔹 Caută rută spre o destinație
async function cautaRuta() {
    const destinatie = document.getElementById('destinatie').value;
    if (!destinatie || !userCoords) {
        alert("Introdu o destinație și permite accesul la locație!");
        return;
    }

    // 🔸 Geocodare — text -> coordonate
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinatie)}`;
    const geoResponse = await fetch(geocodeUrl);
    const geoData = await geoResponse.json();

    if (geoData.length === 0) {
        alert("Locația nu a fost găsită!");
        return;
    }

    const destCoords = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];

    // 🔸 Solicită ruta de la OpenRouteService
    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjVlNTNhMjUxYWE2ODQ0ZTdhY2JiNzhjMTI1ZGVmZWFhIiwiaCI6Im11cm11cjY0In0="; // înlocuiește cu cheia ta!
    const routeUrl = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${userCoords[1]},${userCoords[0]}&end=${destCoords[1]},${destCoords[0]}`;

    const routeResponse = await fetch(routeUrl);
    const routeData = await routeResponse.json();

    console.log("Răspuns API:", routeData);

    if (!routeData.features || routeData.features.length === 0) {
        alert("Nu s-a putut genera ruta!");
        return;
    }

    const coords = routeData.features[0].geometry.coordinates.map(c => [c[1], c[0]]);

    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    routeLayer = L.polyline(coords, { color: 'blue', weight: 4 }).addTo(map);
    L.marker(destCoords).addTo(map).bindPopup(destinatie);
    map.fitBounds(routeLayer.getBounds());
}

initMap();
