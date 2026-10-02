import os
import re
import json
import sqlite3
from functools import wraps

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'aturuang.db')

app = Flask(__name__)
# GANTI kunci ini dengan string acak milikmu sendiri sebelum dipakai serius / online
app.secret_key = os.environ.get('SECRET_KEY', 'ganti-kunci-rahasia-ini-ya')

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,20}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

DEFAULT_STATE = {
    "transactions": [],
    "wallets": [
        {"id": "tunai", "name": "Tunai", "icon": "💵"},
        {"id": "bank", "name": "Bank", "icon": "🏦"},
        {"id": "ewallet", "name": "E-Wallet", "icon": "📱"},
    ],
    "customCats": [],
    "budgets": {},
    "goals": [],
}


# ---------------- DATABASE ----------------
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS user_data (
            user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    db.commit()
    db.close()


# ---------------- AUTH HELPER ----------------
def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get('user_id'):
            return redirect(url_for('login'))
        return view(*args, **kwargs)
    return wrapped


# ---------------- ROUTES: AUTH ----------------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if session.get('user_id'):
        return redirect(url_for('index'))

    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')

        if not USERNAME_RE.match(username):
            error = 'Username 3-20 karakter, hanya huruf/angka/underscore.'
        elif not EMAIL_RE.match(email):
            error = 'Format email tidak valid.'
        elif len(password) < 6:
            error = 'Password minimal 6 karakter.'
        else:
            db = get_db()
            existing = db.execute(
                'SELECT id FROM users WHERE username = ? OR email = ?',
                (username, email)
            ).fetchone()
            if existing:
                error = 'Username atau email sudah dipakai orang lain.'
            else:
                pw_hash = generate_password_hash(password)
                cur = db.execute(
                    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                    (username, email, pw_hash)
                )
                user_id = cur.lastrowid
                db.execute(
                    'INSERT INTO user_data (user_id, data) VALUES (?, ?)',
                    (user_id, json.dumps(DEFAULT_STATE))
                )
                db.commit()
                session['user_id'] = user_id
                session['username'] = username
                return redirect(url_for('index'))

    return render_template('register.html', error=error)


@app.route('/login', methods=['GET', 'POST'])
def login():
    if session.get('user_id'):
        return redirect(url_for('index'))

    error = None
    if request.method == 'POST':
        identifier = request.form.get('identifier', '').strip()
        password = request.form.get('password', '')
        db = get_db()
        user = db.execute(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            (identifier, identifier.lower())
        ).fetchone()
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(url_for('index'))
        error = 'Username/email atau password salah.'

    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ---------------- ROUTES: APP ----------------
@app.route('/')
@login_required
def index():
    return render_template('index.html', username=session.get('username'))


@app.route('/api/data', methods=['GET'])
@login_required
def get_data():
    db = get_db()
    row = db.execute(
        'SELECT data FROM user_data WHERE user_id = ?', (session['user_id'],)
    ).fetchone()
    if row:
        return jsonify(json.loads(row['data']))
    return jsonify(DEFAULT_STATE)


@app.route('/api/data', methods=['POST'])
@login_required
def save_data():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'error': 'payload tidak valid'}), 400

    db = get_db()
    db.execute('''
        INSERT INTO user_data (user_id, data) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
    ''', (session['user_id'], json.dumps(payload)))
    db.commit()
    return jsonify({'ok': True})


if __name__ == '__main__':
    init_db()
    print("Database siap:", DB_PATH)
    print("Buka http://127.0.0.1:5000 di browser kamu")
    app.run(debug=True, port=5000)