let map;
let userMarker;
let routeLayer;
let userCoords;
let destinationMarker;
let routeInfoLabel;
let geoWatchId = null;
let selectedPointMarker;
let selectedPointCoords;
let selectedPointAddress;
let selectedDestination = null;
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
    map = L.map('map', { zoomSnap: 0.1, zoomDelta: 0.5 })
        .setView([45.6579, 25.6012], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

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
            (err) => {
                console.error("Eroare geolocație:", err);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 2000,
                timeout: 10000
            }
        );
    }

    setOraCurenta();

    // --- CLICK PE HARTĂ PENTRU DESTINAȚIE ---
    map.on('click', async (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        // Curățăm selecția anterioară
        if (selectedPointMarker) {
            map.removeLayer(selectedPointMarker);
            selectedPointMarker = null;
        }

        selectedPointCoords = [lat, lng];
        selectedPointAddress = null;

        // Marker imediat
        selectedPointMarker = L.marker(selectedPointCoords).addTo(map);

        // Popup compact (fără adresă)
        const popupHtmlCompact = `
        <div style="text-align:left; min-width:180px;">
            <div style="font-weight:700; margin-bottom:8px;">Destinație selectată</div>
            <div id="map-pick-status" style="font-size:12px; color:#666; margin-bottom:10px;">
                Caut adresa...
            </div>
            <button id="btn-directions-from-map" style="
                width:100%;
                padding:8px 10px;
                border:none;
                border-radius:8px;
                cursor:pointer;
                font-weight:700;
                background:#0066ff;
                color:white;
            " disabled>Direcții</button>
        </div>
    `;

        selectedPointMarker.bindPopup(popupHtmlCompact, { closeButton: true, maxWidth: 260 }).openPopup();
        selectedPointMarker.on('popupclose', () => {
            if (selectedPointMarker) {
                map.removeLayer(selectedPointMarker);
                selectedPointMarker = null;
            }
            selectedPointCoords = null;
            selectedPointAddress = null;
        });
        // Reverse geocoding (NU afișăm adresa, doar activăm butonul când e gata)
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            selectedPointAddress =
                formatShortAddress(data) ||
                `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

            // Actualizăm status + activăm butonul, dar NU afișăm adresa
            setTimeout(() => {
                const statusEl = document.getElementById('map-pick-status');
                const btn = document.getElementById('btn-directions-from-map');

                if (statusEl) {
                    statusEl.textContent = "Adresă identificată.";
                }
                if (btn) {
                    btn.disabled = false;
                }
            }, 0);

        } catch (err) {
            console.error("Eroare la reverse geocoding:", err);
            setTimeout(() => {
                const statusEl = document.getElementById('map-pick-status');
                const btn = document.getElementById('btn-directions-from-map');

                if (statusEl) {
                    statusEl.textContent = "Nu am putut identifica adresa. Poți încerca direcții pe coordonate.";
                }
                // permitem direcții și fără adresă (fallback pe coordonate)
                if (btn) {
                    btn.disabled = false;
                }
            }, 0);
        }

        // Handler pentru Direcții (setează destinația ABIA acum)
        setTimeout(() => {
            const btn = document.getElementById('btn-directions-from-map');
            if (!btn) {
                return;
            }

            btn.addEventListener('click', async () => {
                const destinatieInput = document.getElementById('destinatie');
                if (!destinatieInput) {
                    return;
                }

                const valueToSet = selectedPointAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                destinatieInput.value = valueToSet;
                //salvam coordonatele reale ale punctului selectat
                selectedDestination = {
                    lat: lat,
                    lon: lng,
                    label: valueToSet
                };

                // Eliminăm markerul “selectat” ca să nu rămână 2 markere apropiate
                if (selectedPointMarker) {
                    map.removeLayer(selectedPointMarker);
                    selectedPointMarker = null;
                }

                await cautaRuta({ lat: lat, lon: lng, label: valueToSet });
            }, { once: true });
        }, 0);
    });



    // 3. Funcție formatare durată
    function formatDuration(seconds) {
        const totalMinutes = Math.round(seconds / 60);
        if (totalMinutes < 60) return `${totalMinutes} min`;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
    }
    // Centru Brașov (aprox.)
    const BRASOV_CENTER = [45.6579, 25.6012];

    // Raza în km în care considerăm "perimetrul Brașovului"
    const BRASOV_RADIUS_KM = 15;

    // Haversine (distanță în km între 2 coordonate [lat, lon])
    function distanceKm(a, b) {
        const R = 6371;
        const dLat = (b[0] - a[0]) * Math.PI / 180;
        const dLon = (b[1] - a[1]) * Math.PI / 180;

        const lat1 = a[0] * Math.PI / 180;
        const lat2 = b[0] * Math.PI / 180;

        const sinDLat = Math.sin(dLat / 2);
        const sinDLon = Math.sin(dLon / 2);

        const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    function isInBrasovArea(coords) {
        return distanceKm(coords, BRASOV_CENTER) <= BRASOV_RADIUS_KM;
    }
    // 4. Funcția principală de calcul rută
    async function cautaRuta(destOverride = null) {
        if (!map || !userCoords) {
            alert("Așteaptă localizarea GPS!");
            return;
        }

        const destinatie = document.getElementById('destinatie').value;
        const mod = document.getElementById('modDeplasare').value;
        const oraInput = document.getElementById('oraPlecareInput').value;

        if (!destinatie) return;

        let destCoords = null;

        // 1) Dacă avem coordonate dintr-o selecție (click pe hartă / rezultat), le folosim direct
        if (destOverride && typeof destOverride.lat === "number" && typeof destOverride.lon === "number") {
            destCoords = [destOverride.lat, destOverride.lon];
        } else if (selectedDestination && typeof selectedDestination.lat === "number" && typeof selectedDestination.lon === "number") {
            // 2) Dacă există o destinație selectată global, o folosim
            destCoords = [selectedDestination.lat, selectedDestination.lon];
        } else {
            // 3) Altfel, căutare normală după text (Nominatim)
            const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destinatie)}`;
            const geoRes = await fetch(geocodeUrl);
            const geoData = await geoRes.json();

            if (geoData.length === 0) {
                alert("Locație negăsită!");
                return;
            }

            destCoords = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];
        }
        // OpenRouteService API
        const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjVlNTNhMjUxYWE2ODQ0ZTdhY2JiNzhjMTI1ZGVmZWFhIiwiaCI6Im11cm11cjY0In0=";
        const routeUrl = `https://api.openrouteservice.org/v2/directions/${mod}?api_key=${apiKey}&start=${userCoords[1]},${userCoords[0]}&end=${destCoords[1]},${destCoords[0]}&preference=fastest`;

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

            // --- LOGICA TRAFIC (doar în perimetrul Brașovului) ---
            const traficInBrasov = (isInBrasovArea(userCoords) || isInBrasovArea(destCoords));

            let factorTrafic = 1.0; // implicit: fără trafic

            if (traficInBrasov) {
                factorTrafic = 1.05; // normal (ușor)
                if ((oraH >= 7 && oraH < 9) || (oraH >= 16 && oraH < 19)) {
                    factorTrafic = 1.20; // aglomerat (moderat, realist)
                } else if (oraH >= 0 && oraH < 6) {
                    factorTrafic = 0.95; // noaptea (ușor mai rapid)
                }
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
            const routeStyle = {
                color: '#0066ff',
                weight: 5
            };

            // Pe jos: linie punctată
            if (mod === 'foot-walking') {
                routeStyle.dashArray = '8 10';   // 8px linie, 10px spațiu (ajustezi după gust)
                routeStyle.lineCap = 'round';    // arată mai “punctat”/rotunjit
            }

            routeLayer = L.polyline(coords, routeStyle).addTo(map)
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
            const destKey = `${destinatie} (${destCoords[0].toFixed(5)}, ${destCoords[1].toFixed(5)})`;
            actualizeazaIstoric(destKey);
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
            // User caută manual după text -> anulăm selecția pe coordonate
            selectedDestination = null;
            cautaRuta();
        }
    });

    // schimbare mod deplasare fara enter
    const modDeplasareSelect = document.getElementById('modDeplasare');
    if (modDeplasareSelect) {
        modDeplasareSelect.addEventListener('change', () => {
            const destinatieInput = document.getElementById('destinatie');
            if (!destinatieInput) {
                return;
            }

            const destinatie = destinatieInput.value.trim();
            if (!destinatie) {
                return;
            }

            // Regenerează ruta cu noul mod (mașină / pe jos)
            cautaRuta();
        });
    }
    // schimbare ora plecarii fara enter
    const oraPlecareInput = document.getElementById('oraPlecareInput');
    if (oraPlecareInput) {
        oraPlecareInput.addEventListener('change', () => {
            const destinatieInput = document.getElementById('destinatie');
            if (!destinatieInput) {
                return;
            }

            const destinatie = destinatieInput.value.trim();
            if (!destinatie) {
                return;
            }

            cautaRuta();
        });
    }

    // cautare la click pe buton
    const btnSearch = document.getElementById('btn-search');
    if (btnSearch) {
        btnSearch.addEventListener('click', () => {
            selectedDestination = null;
            cautaRuta();
        });

        // opțional: să meargă și din tastatură (Enter / Space)
        btnSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                cautaRuta();
            }
        });
    }

    // stergere istoric
    document.getElementById('btn-delete').addEventListener('click', () => {
        const dropdown = document.getElementById('istoric-dropdown');
        while (dropdown.options.length > 1) dropdown.remove(1);
        // Ascundem cardul la ștergerea istoricului (opțional)
        document.getElementById('route-details-card').style.display = 'none';
    });
}
// Eveniment schimbare istoric
const istoricDropdown = document.getElementById('istoric-dropdown');
const destinatieInput = document.getElementById('destinatie');

function aplicaRutaDinIstoric() {
    if (!istoricDropdown || !destinatieInput) {
        return;
    }

    const selected = istoricDropdown.value;
    if (!selected || selected.startsWith('--')) {
        return;
    }

    destinatieInput.value = selected;
    destinatieInput.dispatchEvent(new Event('input', { bubbles: true }));

    setTimeout(() => {
        istoricDropdown.blur();   // opțional; îl poți scoate dacă vrei
        cautaRuta();
    }, 80);
}

if (istoricDropdown) {
    istoricDropdown.addEventListener('change', aplicaRutaDinIstoric);
}

// Funcție pentru formatarea unei adrese scurte din datele Nominatim
function formatShortAddress(nominatimData) {
    if (!nominatimData || !nominatimData.address) {
        return null;
    }

    const a = nominatimData.address;

    // Prioritate: POI / clădire / instituție
    const name =
        nominatimData.name ||
        a.amenity ||
        a.building ||
        a.tourism ||
        a.shop ||
        a.office ||
        a.road;

    const road = a.road || '';
    const houseNumber = a.house_number ? ` ${a.house_number}` : '';
    const city =
        a.city ||
        a.town ||
        a.municipality ||
        a.village ||
        '';

    // Dacă avem un nume de locație (ex: instituție)
    if (name && name !== road) {
        return city ? `${name}, ${city}` : name;
    }

    // Altfel: stradă + număr + oraș
    if (road) {
        return city
            ? `${road}${houseNumber}, ${city}`
            : `${road}${houseNumber}`;
    }

    // Fallback minimal
    return city || null;
}

// Pornire aplicație
initMap();