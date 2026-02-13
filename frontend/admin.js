async function loadEvents() {
    const res = await fetch("/admin/events");
    const events = await res.json();
    const list = document.getElementById("eventList");
    list.innerHTML = "";
    events.forEach(ev => {
        const li = document.createElement("li");
        li.innerHTML = `
            ${ev.name}
            <button onclick="deleteEvent(${ev.id})">Delete</button>
            <button onclick="updateEvent(${ev.id})">Update</button>
        `;
        list.appendChild(li);
    });
}

async function addEvent() {
    const name = document.getElementById("eventName").value;
    if (!name) return alert("Event name required");

    await fetch("/admin/events", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name})
    });
    document.getElementById("eventName").value = "";
    loadEvents();
}

async function deleteEvent(id) {
    await fetch(`/admin/events/${id}`, { method: "DELETE" });
    loadEvents();
}

async function updateEvent(id) {
    const newName = prompt("Enter new name:");
    if (!newName) return;
    await fetch(`/admin/events/${id}`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name: newName})
    });
    loadEvents();
}

loadEvents();
