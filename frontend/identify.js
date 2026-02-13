const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const resultEl = document.getElementById('result');
const captureBtn = document.getElementById('captureBtn');
const eventSelect = document.getElementById('eventSelect');

// 🔹 Load events into dropdown
async function loadEvents() {
    const res = await fetch("/admin/events");
    const events = await res.json();
    eventSelect.innerHTML = '<option value="">Select Event</option>';
    events.forEach(ev => {
        const opt = document.createElement("option");
        opt.value = ev.id;
        opt.textContent = ev.name;
        eventSelect.appendChild(opt);
    });
}
loadEvents();

// 🔹 Camera
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio: false });
        video.srcObject = stream;
        await new Promise(resolve => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });
    } catch(err){
        resultEl.textContent = "Camera access denied or error: " + err.message;
    }
}
initCamera();

// 🔹 Capture & Identify
captureBtn.addEventListener('click', async () => {
    const eventId = eventSelect.value;
    if (!eventId) {
        resultEl.textContent = "❌ Please select an event first";
        return;
    }

    // Check if video is ready
    if (video.readyState !== 4) {
        resultEl.textContent = "❌ Camera not ready, please wait...";
        return;
    }

    // Check video dimensions
    if (!video.videoWidth || !video.videoHeight) {
        resultEl.textContent = "❌ Camera not ready, please wait...";
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(async blob => {
        if (!blob) {
            resultEl.textContent = "❌ Failed to capture image";
            return;
        }

        const formData = new FormData();
        formData.append('image', blob, 'face.jpg');
        formData.append('event_id', eventId); // 🔹 pass selected event
        resultEl.textContent = "Identifying...";

        try {
            const res = await fetch('/identify', { method: 'POST', body: formData });
            const data = await res.json();
            if(data.match){
                resultEl.textContent = `✅ Match found: ${data.user.name} (${data.user.event_name})`;
            } else {
                resultEl.textContent = "❌ " + (data.message || "No match in this event");
            }
        } catch(err){
            resultEl.textContent = "❌ Error identifying: " + err.message;
        }
    }, 'image/jpeg', 0.95);
});
