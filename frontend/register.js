const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const captureBtn = document.getElementById('captureBtn');
const submitBtn = document.getElementById('submitBtn');
const nameInput = document.getElementById('nameInput');
const eventSelect = document.getElementById('eventSelect');

let capturedBlob = null;

// Load events
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

// Camera
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video:true });
        video.srcObject = stream;
        video.play();
        statusEl.textContent = "Camera live ✅";
    } catch(err){
        statusEl.textContent = "Camera access denied";
        console.error(err);
    }
}
initCamera();

// Capture
captureBtn.addEventListener('click', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
        capturedBlob = blob;
        statusEl.textContent = "✅ Face captured! Click Submit.";
        submitBtn.disabled = false;
    }, 'image/jpeg');
});

// Submit
submitBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const eventId = eventSelect.value;

    if(!name){ statusEl.textContent="❌ Enter your name"; return; }
    if(!eventId){ statusEl.textContent="❌ Select event"; return; }
    if(!capturedBlob){ statusEl.textContent="❌ Capture first"; return; }

    submitBtn.disabled = true;
    statusEl.textContent = "Registering...";

    const formData = new FormData();
    formData.append('name', name);
    formData.append('event_id', eventId);
    formData.append('image', capturedBlob, 'face.jpg');

    try{
        const res = await fetch(`/register`, { method:'POST', body:formData });
        const data = await res.json();
        if(res.ok){
            statusEl.textContent = `✅ Registered: ${data.name} for ${data.event_name}`;
            nameInput.value='';
            eventSelect.value='';
            capturedBlob=null;
            submitBtn.disabled=true;
        } else if(data.error) statusEl.textContent=`❌ ${data.error}`;
        else statusEl.textContent="❌ Error registering";
    } catch(err){
        statusEl.textContent="❌ Network error";
    }
});
