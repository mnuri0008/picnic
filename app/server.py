from flask import Flask, render_template, request, jsonify, abort
from datetime import datetime, timedelta
import threading, itertools

app = Flask(__name__)

# In-memory “DB”
ROOMS = {}  # code -> {"owner": str, "date": str(ISO), "items":[{...}]}
IDGEN = itertools.count(1)
LOCK = threading.Lock()

def mask(code):  # 28** gibi göstermelik
    return f"{code[:2]}**"

def now_iso():
    return datetime.utcnow().isoformat(timespec="minutes")

@app.route("/")
def home():
    # Odaları; tarihi geçeli 2 gün olanları otomatik temizle
    with LOCK:
        to_delete = []
        for c, r in ROOMS.items():
            try:
                dt = datetime.fromisoformat((r.get("date") or now_iso())[:16])
            except Exception:
                dt = datetime.utcnow()
            if datetime.utcnow() > dt + timedelta(days=2):
                to_delete.append(c)
        for c in to_delete:
            del ROOMS[c]
        rooms = [
            {"code": c, "mask": mask(c), "date": r.get("date") or "—",
             "items": len(r.get("items", []))}
            for c, r in ROOMS.items()
        ]
    return render_template("index.html", rooms=rooms)

# ---------- HTML sayfaları ----------
@app.route("/room/<code>")
def room(code):
    username = request.args.get("username","guest")
    lang = request.args.get("lang","tr")
    # “Gör” linkinden gelindiyse sadece görüntüleme modu
    view = request.args.get("view") == "1"
    return render_template("room.html", code=code, username=username, lang=lang, view=view)

# ---------- API ----------
@app.post("/api/room")
def api_create_room():
    data = request.get_json(force=True)
    code = str(data["code"])
    owner = data["owner"]
    date  = (data.get("date") or now_iso())[:16]
    with LOCK:
        ROOMS.setdefault(code, {"owner": owner, "date": date, "items": []})
    return "", 201

@app.get("/api/rooms")
def api_rooms():
    with LOCK:
        out = []
        for c, r in ROOMS.items():
            out.append({"code": c, "mask": mask(c), "date": r.get("date"), "items": len(r.get("items",[]))})
    return jsonify(out)

@app.get("/api/room/<code>")
def api_room(code):
    with LOCK:
        r = ROOMS.setdefault(code, {"owner":"", "date": now_iso(), "items":[]})
        return jsonify(r)

@app.post("/api/room/<code>/items")
def api_add_item(code):
    data = request.get_json(force=True)
    name  = data["name"].strip()
    unit  = data["unit"]
    amount= float(data["amount"])
    cat   = data.get("cat","Diğer")
    user  = data["user"]
    with LOCK:
        r = ROOMS.setdefault(code, {"owner":"", "date": now_iso(), "items":[]})
        item = {
            "id": next(IDGEN), "name": name, "unit": unit, "amount": amount,
            "cat": cat, "user": user, "state": "needed"
        }
        r["items"].append(item)
    return "", 201

@app.patch("/api/room/<code>/items/<int:item_id>")
def api_patch_item(code, item_id):
    data = request.get_json(force=True)
    user = data.get("user","")
    state = data.get("state","needed")
    with LOCK:
        r = ROOMS.get(code)
        if not r: abort(404)
        owner = r.get("owner","")
        for it in r["items"]:
            if it["id"] == item_id:
                if user != it["user"] and user != owner:
                    abort(403)
                it["state"] = state
                return "", 204
    abort(404)

@app.delete("/api/room/<code>/items/<int:item_id>")
def api_del_item(code, item_id):
    user = request.args.get("user","")
    with LOCK:
        r = ROOMS.get(code)
        if not r: abort(404)
        owner = r.get("owner","")
        for it in list(r["items"]):
            if it["id"] == item_id:
                if user != it["user"] and user != owner:
                    abort(403)
                r["items"].remove(it)
                return "", 204
    abort(404)

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=8000)
