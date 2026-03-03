// API Configuration
const API_BASE_URL = 'http://localhost:8000';

// State Management
let map;
let marker;
let allComplaints = [];
let areas = new Set();
let currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// Initialize the Application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMap();
    fetchAnalytics();
    fetchComplaints();
    setupEventListeners();
});

// Theme Logic
function initTheme() {
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    initTheme();

    // Optional: Update map tiles to match theme if using a provider that supports it
    // For OSM standard, we'll keep it as is, or use a filter via CSS if needed
}

// Map Logic
function initMap() {
    map = L.map('map', {
        zoomControl: false // Custom placement later if needed
    }).setView([19.0760, 72.8777], 13);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setMarker(lat, lng);

        document.getElementById('formLat').value = lat;
        document.getElementById('formLon').value = lng;
        document.getElementById('latLonDisplay').innerHTML = `<span class="text-indigo-500 font-black">📍 POINT LOCKED:</span> ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        document.getElementById('submitBtn').disabled = false;

        if (document.getElementById('modalOverlay').classList.contains('hidden')) {
            openModal();
        }
    });
}

function setMarker(lat, lng) {
    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            document.getElementById('formLat').value = pos.lat;
            document.getElementById('formLon').value = pos.lng;
            document.getElementById('latLonDisplay').innerHTML = `<span class="text-indigo-500 font-black">📍 POINT LOCKED:</span> ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
        });
    }
}

// Fetch Analytics
async function fetchAnalytics() {
    try {
        const response = await fetch(`${API_BASE_URL}/analytics`);
        const data = await response.json();

        animateValue('statTotal', data.total);
        animateValue('statPending', data.pending);
        animateValue('statResolved', data.resolved);

        document.getElementById('statAvgTime').innerText = data.avg_resolution_days;
        document.getElementById('topAreaName').innerText = data.most_reported_area || '--';
    } catch (error) {
        console.error('Error fetching analytics:', error);
    }
}

function animateValue(id, value) {
    const el = document.getElementById(id);
    const start = parseInt(el.innerText) || 0;
    const duration = 1000;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(progress * (value - start) + start);
        el.innerText = isNaN(current) ? value : current;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// Fetch Complaints
async function fetchComplaints() {
    const status = document.getElementById('filterStatus').value;
    const area = document.getElementById('filterArea').value;

    let url = `${API_BASE_URL}/complaints`;
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (area) params.append('area', area);
    if (params.toString()) url += `?${params.toString()}`;

    try {
        const response = await fetch(url);
        allComplaints = await response.json();
        renderTable(allComplaints);
        updateMapMarkers(allComplaints);
        updateAreaFilter(allComplaints);
    } catch (error) {
        console.error('Error fetching complaints:', error);
    }
}

// Render Table
function renderTable(complaints) {
    const tbody = document.getElementById('complaintTableBody');
    tbody.innerHTML = '';

    if (complaints.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-10 text-slate-400 font-light italic">No incidents found in this sector...</td></tr>';
        return;
    }

    complaints.forEach((c, index) => {
        const date = new Date(c.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const statusClass = getStatusClass(c.status);

        const tr = document.createElement('tr');
        tr.className = "group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all duration-300";
        tr.style.animation = `slideUp 0.5s ease forwards ${index * 0.05}s`;
        tr.style.opacity = '0'; // For animation

        tr.innerHTML = `
            <td class="px-6 py-5">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-8 rounded-full bg-${statusClass === 'resolved' ? 'green' : statusClass === 'progress' ? 'yellow' : 'red'}-500 shadow-sm"></div>
                    <div>
                        <div class="font-black text-sm tracking-tight">${c.complaint_type}</div>
                        <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${date}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-5">
                <div class="text-xs font-bold text-slate-600 dark:text-slate-300">${c.area}</div>
                <div class="text-[10px] text-slate-400 truncate max-w-[150px] leading-tight">${c.address}</div>
            </td>
            <td class="px-6 py-5">
                <span class="badge badge-${statusClass}">${c.status}</span>
            </td>
            <td class="px-6 py-5 text-right">
                ${c.status !== 'Resolved' ? `<button onclick="updateStatus(${c.id}, '${c.status}')" class="bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">Update</button>` : '<span class="text-green-500 text-[10px] font-black tracking-widest">VERIFIED ✓</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Update Map Markers
let complaintMarkers = [];
function updateMapMarkers(complaints) {
    complaintMarkers.forEach(m => map.removeLayer(m));
    complaintMarkers = [];

    complaints.forEach(c => {
        const statusClass = getStatusClass(c.status);
        const icon = L.divIcon({
            className: `status-marker-${statusClass}`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const m = L.marker([c.latitude, c.longitude], { icon }).addTo(map);
        m.bindPopup(`
            <div class="p-2 min-w-[150px]">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Incident Report</div>
                <h4 class="font-black text-lg leading-tight mb-2">${c.complaint_type}</h4>
                <div class="flex items-center gap-2 mb-3">
                    <span class="w-2 h-2 rounded-full bg-marker-${statusClass}"></span>
                    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500">${c.status}</span>
                </div>
                <p class="text-[10px] text-slate-400 leading-relaxed bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">${c.address}</p>
            </div>
        `, { closeButton: false });
        complaintMarkers.push(m);
    });
}

function getStatusClass(status) {
    if (status === 'Submitted') return 'submitted';
    if (status === 'In Progress') return 'progress';
    if (status === 'Resolved') return 'resolved';
    return '';
}

function updateAreaFilter(complaints) {
    const filter = document.getElementById('filterArea');
    const currentVal = filter.value;

    complaints.forEach(c => areas.add(c.area));

    filter.innerHTML = '<option value="">All Sectors</option>';
    Array.from(areas).sort().forEach(area => {
        const opt = document.createElement('option');
        opt.value = area;
        opt.innerText = area;
        if (area === currentVal) opt.selected = true;
        filter.appendChild(opt);
    });
}

// Event Listeners
function setupEventListeners() {
    document.getElementById('showReportForm').addEventListener('click', openModal);
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') closeModal();
    });

    document.getElementById('complaintForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('filterStatus').addEventListener('change', fetchComplaints);
    document.getElementById('filterArea').addEventListener('change', fetchComplaints);
    document.getElementById('refreshData').addEventListener('click', () => {
        const btn = document.getElementById('refreshData');
        btn.classList.add('animate-spin');
        Promise.all([fetchAnalytics(), fetchComplaints()]).finally(() => {
            setTimeout(() => btn.classList.remove('animate-spin'), 600);
        });
    });
}

function openModal() {
    const modal = document.getElementById('modalOverlay');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.querySelector('.glass').style.transform = 'scale(1)';
        modal.querySelector('.glass').style.opacity = '1';
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('modalOverlay');
    modal.querySelector('.glass').style.transform = 'scale(0.95)';
    modal.querySelector('.glass').style.opacity = '0';
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}

// API Interactions
async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = 'UPLOADING REPORT...';

    const area = document.getElementById('formArea').value;
    const address = document.getElementById('formAddress').value;
    const type = document.getElementById('formType').value;
    const description = document.getElementById('formDescription').value;
    const lat = document.getElementById('formLat').value;
    const lon = document.getElementById('formLon').value;

    const query = new URLSearchParams({
        area, address, complaint_type: type, description,
        latitude: lat, longitude: lon
    });

    try {
        const response = await fetch(`${API_BASE_URL}/report?${query.toString()}`, {
            method: 'POST'
        });

        if (response.ok) {
            closeModal();
            document.getElementById('complaintForm').reset();
            document.getElementById('latLonDisplay').innerText = 'PIN LOCATION ON MAP TO ACTIVATE SUBMISSION';
            if (marker) map.removeLayer(marker);
            marker = null;

            fetchComplaints();
            fetchAnalytics();
        }
    } catch (error) {
        console.error('Error submitting report:', error);
    } finally {
        btn.disabled = false;
        btn.innerText = 'SUBMIT REPORT';
    }
}

async function updateStatus(id, currentStatus) {
    let nextStatus = '';
    if (currentStatus === 'Submitted') nextStatus = 'In Progress';
    else if (currentStatus === 'In Progress') nextStatus = 'Resolved';

    if (!nextStatus) return;

    try {
        const response = await fetch(`${API_BASE_URL}/update-status/${id}?status=${encodeURIComponent(nextStatus)}`, {
            method: 'PUT'
        });

        if (response.ok) {
            fetchComplaints();
            fetchAnalytics();
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}
