"""
Configuracao compartilhada dos testes da API de administradores.

IMPORTANTE: os testes NUNCA usam o banco real (api/aurora_admin.db).
Cada teste recebe um banco SQLite novo, em uma pasta temporaria.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

# Antes de importar routes.py: chave e banco de teste (routes.py le isso ao ser importado)
os.environ["AURORA_SECRET_KEY"] = "chave-somente-para-testes"
os.environ["AURORA_DB"] = str(Path(tempfile.mkdtemp()) / "import.db")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # pasta api/
import routes  # noqa: E402


@pytest.fixture
def app(tmp_path, monkeypatch):
    """App Flask com um banco vazio so para este teste."""
    monkeypatch.setattr(routes, "CAMINHO_DB", tmp_path / "teste.db")
    routes.criar_tabelas()
    app = routes.criar_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture
def client(app):
    """'Navegador falso' que chama as rotas sem subir o servidor."""
    return app.test_client()


@pytest.fixture
def admin_logado(app):
    """Administrador ja cadastrado no banco de teste (quem faz os cadastros)."""
    con = routes._conectar()
    admin_id = routes.inserir_admin(con, "Admin Teste", "admin@teste.com", "Total", "senha-admin-123")
    con.close()
    return {"id": admin_id, "email": "admin@teste.com", "senha": "senha-admin-123"}


@pytest.fixture
def headers(admin_logado):
    """Cabecalho com o token de login do admin_logado."""
    token = routes._serializer.dumps({"id": admin_logado["id"]})
    return {"Authorization": f"Bearer {token}"}
