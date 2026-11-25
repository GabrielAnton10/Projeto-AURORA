"""
Testes da rota de cadastro de administradores: POST /api/v1/admin/cadastro

Rodar (dentro da pasta api):   python -m pytest -v
"""
import pytest
from werkzeug.security import check_password_hash

import routes

URL = "/api/v1/admin/cadastro"


def dados_validos(**mudancas):
    """Um cadastro valido; cada teste muda so o campo que quer testar."""
    dados = {
        "nome": "Maria Souza",
        "email": "maria@aurora.com",
        "senha": "senhaForte123",
        "permissao": "Somente leitura",
    }
    dados.update(mudancas)
    return dados


def contar_admins() -> int:
    con = routes._conectar()
    total = con.execute("SELECT COUNT(*) FROM administradores").fetchone()[0]
    con.close()
    return total


def buscar_admin(email: str):
    con = routes._conectar()
    row = con.execute("SELECT * FROM administradores WHERE email = ?", (email,)).fetchone()
    con.close()
    return row


# ===========================================================================
# A) Testes unitarios da funcao validar_cadastro (sem banco, sem rede)
# ===========================================================================
class TestValidarCadastro:
    def test_dados_validos_nao_geram_erro(self):
        assert routes.validar_cadastro("Maria", "maria@aurora.com", "Total", "senhaForte123") == []

    def test_nome_com_menos_de_2_letras(self):
        assert "Informe o nome" in routes.validar_cadastro("M", "maria@aurora.com", "Total", "senhaForte123")

    @pytest.mark.parametrize("email", ["", "maria", "maria@", "maria@aurora", "ma ria@aurora.com"])
    def test_email_invalido(self, email):
        assert "E-mail invalido" in routes.validar_cadastro("Maria", email, "Total", "senhaForte123")

    @pytest.mark.parametrize("permissao", routes.PERMISSOES)
    def test_todas_as_permissoes_validas_sao_aceitas(self, permissao):
        assert routes.validar_cadastro("Maria", "maria@aurora.com", permissao, "senhaForte123") == []

    @pytest.mark.parametrize("permissao", ["", "Admin", "total"])
    def test_permissao_invalida(self, permissao):
        erros = routes.validar_cadastro("Maria", "maria@aurora.com", permissao, "senhaForte123")
        assert any(e.startswith("Permissao invalida") for e in erros)

    def test_senha_com_7_caracteres_e_recusada(self):
        erros = routes.validar_cadastro("Maria", "maria@aurora.com", "Total", "1234567")
        assert "A senha deve ter pelo menos 8 caracteres" in erros

    def test_senha_com_exatamente_8_caracteres_e_aceita(self):
        assert routes.validar_cadastro("Maria", "maria@aurora.com", "Total", "abcd1234") == []

    def test_varios_erros_sao_devolvidos_juntos(self):
        assert len(routes.validar_cadastro("", "x", "?", "1")) == 4


# ===========================================================================
# B) Testes da rota POST /api/v1/admin/cadastro
# ===========================================================================
class TestRotaCadastroPermissao:
    """Quem pode cadastrar: so administrador logado."""

    def test_sem_login_retorna_401(self, client, admin_logado):
        resp = client.post(URL, json=dados_validos())
        assert resp.status_code == 401
        assert contar_admins() == 1  # nada foi gravado

    def test_token_falso_retorna_401(self, client, admin_logado):
        resp = client.post(URL, json=dados_validos(), headers={"Authorization": "Bearer token-falso"})
        assert resp.status_code == 401

    def test_token_de_admin_removido_retorna_401(self, client, admin_logado, headers):
        con = routes._conectar()
        con.execute("DELETE FROM administradores")
        con.commit()
        con.close()
        resp = client.post(URL, json=dados_validos(), headers=headers)
        assert resp.status_code == 401


class TestRotaCadastroSucesso:
    def test_cadastro_valido_retorna_201(self, client, headers):
        resp = client.post(URL, json=dados_validos(), headers=headers)
        assert resp.status_code == 201
        corpo = resp.get_json()
        assert corpo["status"] == "sucesso"
        assert corpo["usuario"]["nome"] == "Maria Souza"
        assert corpo["usuario"]["email"] == "maria@aurora.com"
        assert corpo["usuario"]["permissao"] == "Somente leitura"
        assert corpo["usuario"]["ultimo_login"] is None

    def test_cadastro_grava_no_banco(self, client, headers):
        client.post(URL, json=dados_validos(), headers=headers)
        assert contar_admins() == 2  # admin_logado + Maria
        assert buscar_admin("maria@aurora.com")["nome"] == "Maria Souza"

    def test_resposta_nunca_mostra_a_senha(self, client, headers):
        corpo = client.post(URL, json=dados_validos(), headers=headers).get_json()
        texto = str(corpo)
        assert "senha" not in corpo["usuario"]
        assert "senha_hash" not in corpo["usuario"]
        assert "senhaForte123" not in texto

    def test_senha_e_salva_com_hash_e_nao_em_texto_puro(self, client, headers):
        client.post(URL, json=dados_validos(), headers=headers)
        salvo = buscar_admin("maria@aurora.com")["senha_hash"]
        assert salvo != "senhaForte123"
        assert check_password_hash(salvo, "senhaForte123")

    def test_email_e_salvo_em_minusculas_e_sem_espacos(self, client, headers):
        resp = client.post(URL, json=dados_validos(email="  MARIA@Aurora.COM "), headers=headers)
        assert resp.get_json()["usuario"]["email"] == "maria@aurora.com"

    def test_nome_e_salvo_sem_espacos_nas_pontas(self, client, headers):
        resp = client.post(URL, json=dados_validos(nome="   Maria Souza  "), headers=headers)
        assert resp.get_json()["usuario"]["nome"] == "Maria Souza"

    def test_admin_cadastrado_consegue_fazer_login(self, client, headers):
        client.post(URL, json=dados_validos(), headers=headers)
        resp = client.post("/api/v1/admin/login", json={"email": "maria@aurora.com", "senha": "senhaForte123"})
        assert resp.status_code == 200
        assert resp.get_json()["token"]


class TestRotaCadastroErros:
    def test_email_repetido_retorna_409(self, client, headers):
        client.post(URL, json=dados_validos(), headers=headers)
        resp = client.post(URL, json=dados_validos(nome="Outra Maria"), headers=headers)
        assert resp.status_code == 409
        assert contar_admins() == 2

    def test_email_repetido_com_maiusculas_tambem_retorna_409(self, client, headers):
        client.post(URL, json=dados_validos(), headers=headers)
        resp = client.post(URL, json=dados_validos(email="MARIA@AURORA.COM"), headers=headers)
        assert resp.status_code == 409

    @pytest.mark.parametrize("campo", ["nome", "email", "senha", "permissao"])
    def test_campo_faltando_retorna_422(self, client, headers, campo):
        dados = dados_validos()
        del dados[campo]
        resp = client.post(URL, json=dados, headers=headers)
        assert resp.status_code == 422
        assert resp.get_json()["erros"]
        assert contar_admins() == 1  # nada foi gravado

    def test_corpo_que_nao_e_json_retorna_422(self, client, headers):
        resp = client.post(URL, data="isso nao e json", headers=headers)
        assert resp.status_code == 422

    def test_erros_vem_em_lista_para_o_site_mostrar(self, client, headers):
        resp = client.post(URL, json={"nome": "", "email": "x", "senha": "1", "permissao": "?"}, headers=headers)
        corpo = resp.get_json()
        assert corpo["status"] == "erro"
        assert len(corpo["erros"]) == 4


# ===========================================================================
# C) Novas regras criadas com TDD (teste escrito ANTES do codigo)
# ===========================================================================
class TestTDDSenhaEmBranco:
    """Ciclo TDD 1: senha so com espacos nao pode ser aceita."""

    def test_validar_recusa_senha_so_com_espacos(self):
        erros = routes.validar_cadastro("Maria", "maria@aurora.com", "Total", " " * 10)
        assert "A senha nao pode ser so espacos" in erros

    def test_rota_recusa_senha_so_com_espacos(self, client, headers):
        resp = client.post(URL, json=dados_validos(senha="          "), headers=headers)
        assert resp.status_code == 422
        assert contar_admins() == 1  # nada foi gravado

    def test_senha_com_espacos_no_meio_continua_valida(self):
        assert routes.validar_cadastro("Maria", "maria@aurora.com", "Total", "minha senha 1") == []


class TestTDDCamposDevemSerTexto:
    """Ciclo TDD 2: nome, email, senha e permissao precisam ser texto (string)."""

    @pytest.mark.parametrize("campo", ["nome", "email", "senha", "permissao"])
    @pytest.mark.parametrize("valor", [["Maria", "Souza"], {"x": 1}, 12345678, True])
    def test_campo_que_nao_e_texto_retorna_422(self, client, headers, campo, valor):
        resp = client.post(URL, json=dados_validos(**{campo: valor}), headers=headers)
        assert resp.status_code == 422
        assert f"O campo '{campo}' deve ser texto" in resp.get_json()["erros"]
        assert contar_admins() == 1  # nada foi gravado

    def test_lista_no_nome_nao_vira_texto_no_banco(self, client, headers):
        client.post(URL, json=dados_validos(nome=["Maria", "Souza"]), headers=headers)
        assert buscar_admin("maria@aurora.com") is None

    def test_corpo_json_que_e_lista_retorna_422_e_nao_500(self, client, headers):
        resp = client.post(URL, json=[1, 2, 3], headers=headers)
        assert resp.status_code == 422
