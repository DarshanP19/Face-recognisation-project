from flask import Flask, request, jsonify, send_from_directory, redirect
import os
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from PIL import Image
from io import BytesIO
import face_recognition
import numpy as np

# ----------------- Setup -----------------
app = Flask(__name__)
CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///faces.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# Folder to store face images
FACE_FOLDER = "faces"
os.makedirs(FACE_FOLDER, exist_ok=True)

# ----------------- Database Models -----------------
class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    faces = db.relationship("Face", backref="event", lazy=True)

class Face(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    image_path = db.Column(db.String(300), nullable=False)
    encoding = db.Column(db.PickleType, nullable=False)

# ----------------- Helpers -----------------
def validate_image(file_bytes):
    try:
        img = Image.open(BytesIO(file_bytes))
        img.verify()
        return True, None
    except:
        return False, "Invalid image file"

# ----------------- Routes -----------------
@app.route("/", strict_slashes=False)
def root_redirect():
    return redirect("/register")

@app.route("/register", strict_slashes=False)
def serve_register():
    return send_from_directory("frontend", "register.html")

@app.route("/identify", strict_slashes=False)
def serve_identify():
    return send_from_directory("frontend", "identify.html")

@app.route("/admin", strict_slashes=False)
def serve_admin():
    return send_from_directory("frontend", "admin.html")

@app.route("/frontend/<path:filename>")
def serve_frontend_static(filename):
    return send_from_directory("frontend", filename)

# ----------------- Admin APIs -----------------
@app.route("/admin/events", methods=["GET"])
def admin_list_events():
    events = Event.query.all()
    return jsonify([{"id": e.id, "name": e.name} for e in events])

@app.route("/admin/faces", methods=["GET"])
def admin_list_faces():
    faces = Face.query.all()
    return jsonify([
        {
            "id": f.id,
            "name": f.name,
            "event_id": f.event_id,
            "event_name": f.event.name,
            "image_path": f.image_path
        } for f in faces
    ])

@app.route("/admin/events", methods=["POST"])
def admin_add_event():
    data = request.get_json()
    name = data.get("name")
    if not name:
        return jsonify({"error": "Event name required"}), 400
    if Event.query.filter_by(name=name).first():
        return jsonify({"error": "Event already exists"}), 400
    ev = Event(name=name)
    db.session.add(ev)
    db.session.commit()
    return jsonify({"message": "Event created", "id": ev.id, "name": ev.name})

@app.route("/admin/events/<int:event_id>", methods=["DELETE"])
def admin_delete_event(event_id):
    ev = Event.query.get_or_404(event_id)
    db.session.delete(ev)
    db.session.commit()
    return jsonify({"message": "Event deleted"})

# ----------------- Register Face -----------------
@app.route("/register", methods=["POST"])
def register_face():
    name = request.form.get("name")
    event_id = request.form.get("event_id")
    file = request.files.get("image")

    if not name or not event_id or not file:
        return jsonify({"error": "Name, event and image required"}), 400

    event = Event.query.get(event_id)
    if not event:
        return jsonify({"error": "Invalid event"}), 400

    image_bytes = file.read()
    valid, err = validate_image(image_bytes)
    if not valid:
        return jsonify({"error": err}), 400

    img = face_recognition.load_image_file(BytesIO(image_bytes))
    encodings = face_recognition.face_encodings(img)

    if len(encodings) == 0:
        return jsonify({"error": "No face detected"}), 400

    encoding = encodings[0]

    face = Face(name=name, event_id=event.id, image_path="", encoding=encoding)
    db.session.add(face)
    db.session.flush()

    path = os.path.join(FACE_FOLDER, f"{face.id}.jpg")
    with open(path, "wb") as f:
        f.write(image_bytes)

    face.image_path = path
    db.session.commit()

    return jsonify({
        "id": face.id,
        "name": face.name,
        "event_name": event.name
    })

# ----------------- Identify Face -----------------
@app.route("/identify", methods=["POST"])
def identify_face():
    file = request.files.get("image")
    event_id = request.form.get("event_id")

    if not file or not event_id:
        return jsonify({"error": "Image and event required"}), 400

    image_bytes = file.read()
    img = face_recognition.load_image_file(BytesIO(image_bytes))
    encodings = face_recognition.face_encodings(img)

    if len(encodings) == 0:
        return jsonify({"match": False, "message": "No face detected"}), 200

    unknown_encoding = encodings[0]

    faces = Face.query.filter_by(event_id=event_id).all()
    if not faces:
        return jsonify({"match": False, "message": "No registered faces in this event"}), 200

    known_encodings = [f.encoding for f in faces]
    results = face_recognition.compare_faces(known_encodings, unknown_encoding, tolerance=0.5)

    if True in results:
        idx = results.index(True)
        user = faces[idx]
        return jsonify({
            "match": True,
            "user": {
                "id": user.id,
                "name": user.name,
                "event_name": user.event.name
            }
        })
    else:
        return jsonify({"match": False, "message": "No match"}), 200

# ----------------- Main -----------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=False, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
