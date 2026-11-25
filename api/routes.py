
import getpass
import os
import re
import secrets
import sqlite3
import sys
from datetime import datetime
from functools import wraps
from pathlib import Path

from flask import Blueprint, Flask, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

admin_bp = Blueprint("admin", __name__, url_prefix="/api/v1/admin") # Blueprint para facilitar a identificação e mellhorar a manunteção do codigo.

PASTA = Path(__file__).resolve().parent
CAMINHO_DB = Path(os.environ.get("AURORA_DB", PASTA / "aurora_admin.db"))
TOKEN_VALIDADE_S = 8 * 60 * 60  # 8 horas
SENHA_MIN = 8
PERMISSOES = ("Total", "Leitura + alertas", "Somente leitura")
CAMPOS_CADASTRO = ("nome", "email", "senha", "permissao")
RE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Chave secreta dos tokens: variavel de ambiente ou arquivo local persistente
# (assim os logins continuam validos quando a API reinicia)
# ---------------------------------------------------------------------------
def _chave_secreta() -> str:
    chave = os.environ.get("AURORA_SECRET_KEY")
    if chave:
        return chave
    arquivo = PASTA / ".aurora_secret"
    if arquivo.exists():
        return arquivo.read_text(encoding="utf-8").strip()
    chave = secrets.token_hex(32)
    arquivo.write_text(chave, encoding="utf-8")
    return chave


_serializer = URLSafeTimedSerializer(_chave_secreta(), salt="aurora-admin")


# ---------------------------------------------------------------------------
# Banco de dados (SQLite, arquivo aurora_admin.db ao lado deste arquivo)
# ---------------------------------------------------------------------------
def _conectar() -> sqlite3.Connection:
    con = sqlite3.connect(CAMINHO_DB)
    con.row_factory = sqlite3.Row
    return con


def criar_tabelas() -> None:
    with _conectar() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS administradores (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                nome         TEXT NOT NULL,
                email        TEXT NOT NULL UNIQUE COLLATE NOCASE,
                permissao    TEXT NOT NULL,
                senha_hash   TEXT NOT NULL,
                criado_em    TEXT NOT NULL,
                ultimo_login TEXT
            );
            CREATE TABLE IF NOT EXISTS acessos (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id  INTEGER,
                email     TEXT NOT NULL,
                sucesso   INTEGER NOT NULL,
                ip        TEXT,
                em        TEXT NOT NULL
            );
            """
        )


def db() -> sqlite3.Connection:
    if "aurora_db" not in g:
        g.aurora_db = _conectar()
    return g.aurora_db


@admin_bp.teardown_app_request
def _fechar_db(_erro):
    con = g.pop("aurora_db", None)
    if con is not None:
        con.close()


def _agora() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _publico(row: sqlite3.Row) -> dict:
    """Dados do administrador que podem ir para o site (sem a senha)."""
    return {
        "id": row["id"],
        "nome": row["nome"],
        "email": row["email"],
        "permissao": row["permissao"],
        "criado_em": row["criado_em"],
        "ultimo_login": row["ultimo_login"],
    }


def _erro(msg: str, codigo: int, **extra):
    return jsonify({"status": "erro", "erro": msg, **extra}), codigo


def validar_cadastro(nome: str, email: str, permissao: str, senha: str) -> list[str]:
    erros = []
    if len(nome) < 2:
        erros.append("Informe o nome")
    if not RE_EMAIL.match(email):
        erros.append("E-mail invalido")
    if permissao not in PERMISSOES:
        erros.append("Permissao invalida (use: " + ", ".join(PERMISSOES) + ")")
    if len(senha) < SENHA_MIN:
        erros.append(f"A senha deve ter pelo menos {SENHA_MIN} caracteres")
    elif not senha.strip():
        erros.append("A senha nao pode ser so espacos")
    return erros


def inserir_admin(con: sqlite3.Connection, nome: str, email: str, permissao: str, senha: str) -> int:
    cur = con.execute(
        "INSERT INTO administradores (nome, email, permissao, senha_hash, criado_em) "
        "VALUES (?, ?, ?, ?, ?)",
        (nome, email, permissao, generate_password_hash(senha), _agora()),
    )
    con.commit()
    return cur.lastrowid

# ---------------------------------------------------------------------------
# Autenticacao por token
# ---------------------------------------------------------------------------
def _admin_do_token():
    cab = request.headers.get("Authorization", "")
    if not cab.startswith("Bearer "):
        return None
    try:
        dados = _serializer.loads(cab[7:].strip(), max_age=TOKEN_VALIDADE_S)
    except (BadSignature, SignatureExpired):
        return None
    # Confere se o administrador ainda existe (pode ter sido removido)
    return db().execute(
        "SELECT * FROM administradores WHERE id = ?", (dados.get("id"),)
    ).fetchone()

def requer_admin(func):
    @wraps(func)
    def envolvida(*args, **kwargs):
        admin = _admin_do_token()
        if admin is None:
            return _erro("Login necessario ou sessao expirada", 401)
        g.admin = admin
        return func(*args, **kwargs)

    return envolvida

# ---------------------------------------------------------------------------
# Rotas
# ---------------------------------------------------------------------------
@admin_bp.post("/login")
def login():
    dados = request.get_json(silent=True) or {}
    email = str(dados.get("email", "")).strip().lower()
    senha = str(dados.get("senha", ""))
    if not email or not senha:
        return _erro("Informe e-mail e senha", 422)

    con = db()
    admin = con.execute("SELECT * FROM administradores WHERE email = ?", (email,)).fetchone()
    ok = admin is not None and check_password_hash(admin["senha_hash"], senha)

    con.execute(
        "INSERT INTO acessos (admin_id, email, sucesso, ip, em) VALUES (?, ?, ?, ?, ?)",
        (admin["id"] if admin else None, email, int(ok), request.remote_addr, _agora()),
    )
    if ok:
        con.execute(
            "UPDATE administradores SET ultimo_login = ? WHERE id = ?", (_agora(), admin["id"])
        )
    con.commit()

    if not ok:
        return _erro("E-mail ou senha incorretos", 401)

    admin = con.execute("SELECT * FROM administradores WHERE id = ?", (admin["id"],)).fetchone()
    return jsonify({
        "status": "sucesso",
        "token": _serializer.dumps({"id": admin["id"]}),
        "expira_em_s": TOKEN_VALIDADE_S,
        "usuario": _publico(admin),
    }), 200


@admin_bp.post("/cadastro")
@requer_admin
def cadastrar():
    dados = request.get_json(silent=True) or {}
    if not isinstance(dados, dict):
        dados = {}

    # Cada campo precisa ser texto; numero, lista etc. nao sao convertidos
    erros_tipo = [
        f"O campo '{campo}' deve ser texto"
        for campo in CAMPOS_CADASTRO
        if not isinstance(dados.get(campo, ""), str)
    ]
    if erros_tipo:
        return _erro("Dados invalidos", 422, erros=erros_tipo)

    nome = dados.get("nome", "").strip()
    email = dados.get("email", "").strip().lower()
    permissao = dados.get("permissao", "").strip()
    senha = dados.get("senha", "")

    erros = validar_cadastro(nome, email, permissao, senha)
    if erros:
        return _erro("Dados invalidos", 422, erros=erros)

    try:
        novo_id = inserir_admin(db(), nome, email, permissao, senha)
    except sqlite3.IntegrityError:
        return _erro("Ja existe um administrador com esse e-mail", 409)

    novo = db().execute("SELECT * FROM administradores WHERE id = ?", (novo_id,)).fetchone()
    return jsonify({"status": "sucesso", "usuario": _publico(novo)}), 201


@admin_bp.get("/me")
@requer_admin
def eu():
    return jsonify({"usuario": _publico(g.admin)}), 200


@admin_bp.get("/usuarios")
@requer_admin
def listar_usuarios():
    rows = db().execute("SELECT * FROM administradores ORDER BY nome COLLATE NOCASE").fetchall()
    return jsonify({"quantidade": len(rows), "usuarios": [_publico(r) for r in rows]}), 200


@admin_bp.delete("/usuarios/<int:admin_id>")
@requer_admin
def remover_usuario(admin_id: int):
    if admin_id == g.admin["id"]:
        return _erro("Voce nao pode remover a sua propria conta", 400)
    con = db()
    if con.execute("SELECT 1 FROM administradores WHERE id = ?", (admin_id,)).fetchone() is None:
        return _erro("Administrador nao encontrado", 404)
    con.execute("DELETE FROM administradores WHERE id = ?", (admin_id,))
    con.commit()
    return jsonify({"status": "sucesso"}), 200


@admin_bp.get("/acessos")
@requer_admin
def listar_acessos():
    rows = db().execute(
        "SELECT email, sucesso, ip, em FROM acessos ORDER BY id DESC LIMIT 50"
    ).fetchall()
    return jsonify({"acessos": [
        {"email": r["email"], "sucesso": bool(r["sucesso"]), "ip": r["ip"], "em": r["em"]}
        for r in rows
    ]}), 200


# Cria as tabelas assim que o modulo e importado
criar_tabelas()


def criar_app() -> Flask:
    """App Flask so com as rotas de administradores (para rodar sozinha)."""
    from flask_cors import CORS

    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(admin_bp)

    @app.get("/")
    def inicio():
        return jsonify({
            "status": "online",
            "api": "AURORA - administradores",
            "rotas": sorted(str(r) for r in app.url_map.iter_rules() if str(r).startswith("/api/")),
        }), 200

    return app


def criar_admin_terminal() -> None:
    """Cadastra um administrador pelo terminal (usado para criar o primeiro)."""
    print("=== AURORA - cadastrar administrador ===")
    nome = input("Nome: ").strip()
    email = input("E-mail: ").strip().lower()
    permissao = input(f"Permissao [{' / '.join(PERMISSOES)}] (Enter = Total): ").strip() or "Total"
    senha = getpass.getpass(f"Senha (min. {SENHA_MIN} caracteres): ")
    if senha != getpass.getpass("Confirme a senha: "):
        sys.exit("As senhas nao conferem.")
    erros = validar_cadastro(nome, email, permissao, senha)
    if erros:
        sys.exit("Erro: " + "; ".join(erros))
    try:
        with _conectar() as con:
            inserir_admin(con, nome, email, permissao, senha)
    except sqlite3.IntegrityError:
        sys.exit("Ja existe um administrador com esse e-mail.")
    print(f"Administrador {nome} <{email}> cadastrado. Agora rode: python routes.py")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "criar-admin":
        criar_admin_terminal()
    else:
        criar_app().run(host="0.0.0.0", port=int(os.environ.get("AURORA_ADMIN_PORT", 8001)))
