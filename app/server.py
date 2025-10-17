
import os, json, threading, datetime
from flask import Flask, jsonify, request, render_template, send_from_directory
from flask_socketio import SocketIO
from dotenv import load_dotenv
from flask import request as _rq
load_dotenv()
DATA_PATH=os.path.join(os.path.dirname(__file__),'..','data','picnic_data.json')
_lock=threading.Lock(); presence={}
def read():
    with open(DATA_PATH,'r',encoding='utf-8') as f: return json.load(f)
def write(d):
    tmp=DATA_PATH+'.tmp'
    with open(tmp,'w',encoding='utf-8') as f: json.dump(d,f,ensure_ascii=False,indent=2)
    os.replace(tmp,DATA_PATH)
def ensure_rules(d):
    created=datetime.datetime.fromisoformat(d['room']['created_at'].replace('Z',''))
    if datetime.datetime.utcnow()-created>datetime.timedelta(days=7):
        d['room']={'created_at':datetime.datetime.utcnow().isoformat()+'Z','event_date':None,'locked':False}
        d['users']=[]; d['items']=[]; d['seq']=1
    ev=d['room'].get('event_date')
    if ev:
        ev_dt=datetime.datetime.fromisoformat(ev.replace('Z',''))
        if ev_dt-datetime.datetime.utcnow()<=datetime.timedelta(days=2): d['room']['locked']=True
    return d
def create_app():
    app=Flask(__name__,template_folder='templates',static_folder='static')
    app.config['SECRET_KEY']=os.getenv('SECRET_KEY','dev')
    app.config['MAX_USERS']=int(os.getenv('MAX_USERS','50'))
    return app
app=create_app()
socketio=SocketIO(app,cors_allowed_origins='*',async_mode=('threading' if os.name=='nt' else 'eventlet'))
def state():
    d=ensure_rules(read())
    return {'room':d['room'],'users':d['users'],'online':sorted(set(presence.values())),'items':d['items'],
            'categories':d['categories'],'units':d['units'],
            'category_options':d.get('category_options',{}),'category_icons':d.get('category_icons',{}),
            'option_en_map':d.get('option_en_map',{}),'max_users':app.config['MAX_USERS']}
def broadcast(): socketio.emit('state',state())
@app.get('/')
def home(): return render_template('index.html')
@app.get('/manifest.webmanifest')
def mani(): return send_from_directory('static','manifest.webmanifest',mimetype='application/manifest+json')
@app.get('/sw.js')
def sw(): return send_from_directory('static','sw.js',mimetype='application/javascript')
@app.get('/api/all')
def all_api(): return jsonify(state())
@app.post('/api/users')
def add_user():
    b=request.get_json(silent=True) or {}; name=(b.get('name') or '').strip()
    if not name: return jsonify(error='name_required'),400
    with _lock:
        d=read(); s=set(d['users'])
        if name not in s:
            if len(s)>=app.config['MAX_USERS']: return jsonify(error='room_full'),403
            s.add(name); d['users']=sorted(s); write(d)
    broadcast(); return jsonify(ok=True)
@app.post('/api/items')
def add_item():
    b=request.get_json(silent=True) or {}
    title=(b.get('title') or '').strip(); category=(b.get('category') or 'Diğer').strip()
    unit=(b.get('unit') or 'adet').strip(); who=(b.get('who') or '').strip()
    try: amount=float(b.get('amount',0) or 0)
    except: return jsonify(error='bad_amount'),400
    if not title: return jsonify(error='title_required'),400
    with _lock:
        d=read(); iid=d['seq']; d['seq']+=1
        d['items'].append({'id':iid,'title':title,'category':category,'amount':amount,'unit':unit,'who':who,'status':'needed'}); write(d)
    broadcast(); return jsonify(ok=True,id=iid)
@app.patch('/api/items/<int:iid>')
def patch_item(iid):
    b=request.get_json(silent=True) or {}
    with _lock:
        d=read(); f=None
        for it in d['items']:
            if it['id']==iid: it.update({k:v for k,v in b.items() if k in {'title','category','unit','who','status','amount'}}); f=it; break
        if not f: return jsonify(error='not_found'),404
        write(d)
    broadcast(); return jsonify(f)
@app.delete('/api/items/<int:iid>')
def del_item(iid):
    with _lock:
        d=read(); n=len(d['items']); d['items']=[x for x in d['items'] if x['id']!=iid]
        if len(d['items'])==n: return jsonify(error='not_found'),404
        write(d)
    broadcast(); return ('',204)
@app.post('/api/date')
def set_date():
    b=request.get_json(silent=True) or {}
    date_txt=(b.get('event_date') or '').strip(); who=(b.get('who') or '').strip()
    try:
        dd,mm,yy_time = date_txt.split('/'); yy, timepart = yy_time.split(' ',1)
        hh,mins = timepart.split(':'); dt = datetime.datetime(int(yy),int(mm),int(dd),int(hh),int(mins))
    except Exception:
        return jsonify(error='bad_date_format'),400
    with _lock:
        d=read(); d['room']['event_date']=dt.isoformat()+'Z'; d['room']['locked']=False; write(d)
    socketio.emit('notify',{'type':'date_changed','by':who or 'Anon','date':d['room']['event_date']}); broadcast(); return jsonify(ok=True)
@socketio.on('join')
def on_join(data): presence[_rq.sid]=(data.get('name') or '').strip(); broadcast()
@socketio.on('disconnect')
def on_disc(): presence.pop(_rq.sid,None); broadcast()
if __name__=='__main__':
    socketio.run(app,host='127.0.0.1',port=8000)
