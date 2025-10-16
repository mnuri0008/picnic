
import os, json, threading, datetime
from flask import Flask, jsonify, request, render_template, send_from_directory
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv

load_dotenv()
DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'picnic_data.json')
_lock = threading.Lock()
# in-memory presence
presence = {}  # sid -> name

def read_data():
    if not os.path.exists(DATA_PATH):
        return {"room":{"created_at":datetime.datetime.utcnow().isoformat()+'Z',"event_date":None,"locked":False},
                "users":[], "items":[], "seq":1, "categories":["Yiyecek","İçecek","Baharat","Tatlı","Araç-gereç"], "units":["kg","g","lt","ml","adet","paket"]}
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def write_data(d):
    tmp = DATA_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_PATH)

def cleanup_if_expired(d):
    # auto delete room if older than 7 days
    try:
        created = datetime.datetime.fromisoformat((d.get("room") or {}).get("created_at","").replace("Z","") or "1970-01-01")
    except Exception:
        created = datetime.datetime.utcnow()
    if datetime.datetime.utcnow() - created > datetime.timedelta(days=7):
        d["room"] = {"created_at": datetime.datetime.utcnow().isoformat()+"Z", "event_date": None, "locked": False}
        d["users"] = []
        d["items"] = []
        d["seq"] = 1
    # lock date if less than 2 days remain
    ev = (d.get("room") or {}).get("event_date")
    if ev:
        try:
            ev_dt = datetime.datetime.fromisoformat(ev.replace("Z",""))
            if ev_dt - datetime.datetime.utcnow() <= datetime.timedelta(days=2):
                d["room"]["locked"] = True
        except Exception:
            pass
    return d

def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret')
    app.config['MAX_USERS'] = int(os.getenv('MAX_USERS', '50'))
    return app

app = create_app()
async_mode = 'threading' if os.name == 'nt' else 'eventlet'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=async_mode)

def state_payload():
    with _lock:
        d = cleanup_if_expired(read_data())
        write_data(d)
        online = sorted(set(presence.values()))
        return {"room": d["room"], "users": d["users"], "online": online,
                "items": d["items"], "categories": d["categories"], "units": d["units"],
                "max_users": app.config['MAX_USERS']}

def broadcast_state():
    socketio.emit("state", state_payload())

@app.get('/')
def home():
    return render_template('index.html')

@app.get('/manifest.webmanifest')
def manifest():
    return send_from_directory('static', 'manifest.webmanifest', mimetype='application/manifest+json')

@app.get('/sw.js')
def service_worker():
    return send_from_directory('static', 'sw.js', mimetype='application/javascript')

# ---- Room ----
@app.get('/api/room')
def api_room():
    return jsonify(state_payload()["room"])

@app.post('/api/room')
def api_room_set():
    body = request.get_json(silent=True) or {}
    date_iso = (body.get("event_date") or "").strip()
    with _lock:
        d = read_data()
        d = cleanup_if_expired(d)
        if d["room"].get("locked"):
            return jsonify(error="locked"), 403
        # set or change event date
        try:
            dt = datetime.datetime.fromisoformat(date_iso.replace("Z",""))
        except Exception:
            return jsonify(error="bad_date"), 400
        d["room"]["event_date"] = dt.isoformat()+"Z"
        # if less than 2 days remain, lock immediately
        if dt - datetime.datetime.utcnow() <= datetime.timedelta(days=2):
            d["room"]["locked"] = True
        write_data(d)
    broadcast_state()
    return jsonify(ok=True)

# ---- Users ----
@app.get('/api/users')
def api_users():
    with _lock:
        d = read_data()
    return jsonify(users=d["users"], max=app.config['MAX_USERS'], online=list(sorted(set(presence.values()))))

@app.post('/api/users')
def api_add_user():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name: return jsonify(error="name_required"), 400
    with _lock:
        d = read_data()
        users = set(d["users"])
        if name not in users:
            if len(users) >= app.config['MAX_USERS']:
                return jsonify(error="room_full"), 403
            users.add(name)
            d["users"] = sorted(users)
            write_data(d)
    broadcast_state()
    return jsonify(ok=True)

# ---- Items ----
@app.get('/api/items')
def api_items():
    with _lock:
        d = read_data()
        d = cleanup_if_expired(d); write_data(d)
    return jsonify(items=d["items"])

@app.get('/api/categories')
def api_categories():
    with _lock:
        d = read_data()
    return jsonify(categories=d.get("categories", []), units=d.get("units", []))

@app.post('/api/items')
def api_add_item():
    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    category = (body.get("category") or "Diğer").strip()
    unit = (body.get("unit") or "kg").strip()
    who = (body.get("who") or "").strip()
    try: amount = float(body.get("amount", 0) or 0)
    except Exception: return jsonify(error="bad_amount"), 400
    if not title: return jsonify(error="title_required"), 400
    with _lock:
        d = read_data()
        iid = d["seq"]; d["seq"] += 1
        item = {"id": iid, "title": title, "category": category, "amount": amount, "unit": unit, "who": who, "status": "needed"}
        d["items"].append(item); write_data(d)
    broadcast_state()
    return jsonify(item), 201

@app.patch('/api/items/<int:iid>')
def api_patch_item(iid: int):
    body = request.get_json(silent=True) or {}
    allowed = {"needed","claimed","brought"}
    patch = {}
    if "title" in body: patch["title"] = (body["title"] or "").strip()
    if "category" in body: patch["category"] = (body["category"] or "").strip()
    if "unit" in body: patch["unit"] = (body["unit"] or "").strip()
    if "who" in body: patch["who"] = (body["who"] or "").strip()
    if "amount" in body:
        try: patch["amount"] = float(body["amount"])
        except Exception: return jsonify(error="bad_amount"), 400
    if "status" in body:
        st = (body["status"] or "").strip()
        if st not in allowed: return jsonify(error="bad_status", allowed=list(allowed)), 400
        patch["status"] = st
    with _lock:
        d = read_data()
        found = None
        for it in d["items"]:
            if it["id"] == iid:
                it.update({k:v for k,v in patch.items() if v is not None})
                found = it; break
        if not found: return jsonify(error="not_found"), 404
        write_data(d)
    broadcast_state()
    return jsonify(found)

@app.delete('/api/items/<int:iid>')
def api_delete_item(iid: int):
    with _lock:
        d = read_data()
        n = len(d["items"])
        d["items"] = [x for x in d["items"] if x["id"] != iid]
        if len(d["items"]) == n:
            return jsonify(error="not_found"), 404
        write_data(d)
    broadcast_state()
    return ("", 204)

# ---- Socket presence ----
@socketio.on('connect')
def on_connect():
    emit("hello", {"msg":"connected"})

@socketio.on('join')
def on_join(data):
    name = (data.get("name") or "").strip()
    presence[request.sid] = name or ""
    broadcast_state()

@socketio.on('disconnect')
def on_disconnect():
    try: presence.pop(request.sid, None)
    except Exception: pass
    broadcast_state()

if __name__ == "__main__":
    socketio.run(app, host="127.0.0.1", port=8000)
