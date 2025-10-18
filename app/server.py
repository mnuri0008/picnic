from flask import Flask, render_template, request, redirect, url_for
import random

app = Flask(__name__)

@app.route("/", methods=["GET"])
def index():
    lang = request.args.get("lang", "tr")
    return render_template("index.html", lang=lang)

@app.route("/create_room", methods=["POST"])
def create_room():
    username = (request.form.get("username") or "").strip() or "guest"
    date = request.form.get("picnic_date") or ""
    lang = request.form.get("lang") or "tr"
    code = str(random.randint(1000, 9999))
    return redirect(url_for("room", code=code, username=username, lang=lang, date=date))

@app.route("/join_room", methods=["POST"])
def join_room():
    username = (request.form.get("username_join") or "").strip() or "guest"
    code = (request.form.get("join_code") or "").strip()
    lang = request.form.get("lang") or "tr"
    if not (code.isdigit() and len(code) == 4):
        return redirect(url_for("index", lang=lang))
    return redirect(url_for("room", code=code, username=username, lang=lang))

@app.route("/room/<code>", methods=["GET"])
def room(code):
    lang = request.args.get("lang", "tr")
    username = request.args.get("username", "guest")
    date = request.args.get("date", "")
    return render_template("room.html", code=code, lang=lang, username=username, date=date)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
