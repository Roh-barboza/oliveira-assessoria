#!/usr/bin/env python3
"""
Oliveira Assessoria — Script de Correção WF02 + Importação de Leads
====================================================================
Executa 4 tarefas sequenciais:
  T1. Autenticar no n8n
  T2. Corrigir conexões do WF02 (Anti-Ban Dispatch)
  T3. Criar schema/tabela velloso.leads no PostgreSQL
  T4. Baixar CSV, filtrar e inserir leads no banco

COMO USAR
---------
1. Instale as dependências:
   pip install psycopg2-binary pandas requests

2. Execute (de um ambiente com acesso de rede ao n8n e PostgreSQL):
   python3 scripts/fix_and_import.py

CREDENCIAIS (hardcoded — ajuste se necessário)
----------------------------------------------
Ver constantes no início do arquivo.
"""

import requests
import json
import csv
import re
import io
import sys

# ─────────────────────────────────────────────────────────────────────────────
# CREDENCIAIS
# ─────────────────────────────────────────────────────────────────────────────
N8N_URL   = "https://chaoticcow-n8n.cloudfy.live"
N8N_EMAIL = "rodrigo.barboza1994@gmail.com"
N8N_PASS  = "XY3IJIHRD13s%8$a"
WF_ID     = "iKUKUTSuzMZg2u0Z"

PG_HOST = "chaoticcow-postgres.cloudfy.live"
PG_PORT = 8277
PG_USER = "postgres"
PG_DB   = "db"
PG_PASS = "ltKPcRzBdQuFZXrTwBZQ"

CSV_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vSJNAR8FC899iEkZ5yxzFwR91vKR81XoeAMZVgNX--IHQRxwx_9DGNEAf-"
    "gNzoWthbSeJ4yDVmKGuVw/pub?output=csv"
)

# ─────────────────────────────────────────────────────────────────────────────
# FILTROS — LISTAS DE PALAVRAS-CHAVE
# ─────────────────────────────────────────────────────────────────────────────
EMPRESA_KW = [
    "ltda", "s.a.", " me ", " epp ", "eireli", "cnpj", "construtora",
    "imobili", "incorporadora", "holding", "associa", "instituto",
    "funda\u00e7\u00e3o", "sindicato", "cooperativa", "cl\u00ednica", "hospital",
    "escola", "col\u00e9gio", "academia", "assessoria", "consultoria",
    "ag\u00eancia", "financeira", "seguradora", "corretora", "distribuidora",
    "tecnologia", "contabilidade",
]
JURIDICO_KW    = ["oab", "advogado", "advocacia", "jur\u00eddico", "procurador", "defensoria"]
CONCORRENTE_KW = [
    "cidadania italiana", "passaporte italiano",
    "visto europeu", "passaporto italiano",
]

SAUDE_KW       = ["m\u00e9dic", "enfermeir", "dentist", "farm\u00e2ceut", "fisioter",
                   "psic\u00f3log", "nutricion", "biom\u00e9dic", "veterin\u00e1r",
                   "cirurgi", "radiolog", "fonoaud"]
ITALIA_KW      = ["bisav\u00f4", "antepassado", "ascend\u00eancia italiana", "nona", "nonno"]
PROFISSIONAL_KW = ["engenh", "arquitet", "contador", "economista", "administrador",
                    "gerente", "diretor", "professor", "analista", "coordenador"]

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _contains(text: str, keywords: list) -> bool:
    t = (text or "").lower()
    return any(k in t for k in keywords)


def normalize_phone(raw: str):
    """
    Normaliza telefone para 55DDNUMERO.
    Retorna None se inválido (não BR, DDD fora de 11-99, tamanho errado).
    """
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    # Remove DDI 55 duplicado
    if digits.startswith("55") and len(digits) > 13:
        digits = digits[2:]
    # Adiciona DDI se ausente
    if not digits.startswith("55"):
        digits = "55" + digits
    # Valida comprimento: 55 + DDD(2) + número(8-9) = 12 ou 13 dígitos
    if len(digits) not in (12, 13):
        return None
    ddd = int(digits[2:4])
    if not (11 <= ddd <= 99):
        return None
    return digits


def detect_category(nome: str, profissao: str, obs: str) -> str:
    txt = f"{nome} {profissao} {obs}"
    if _contains(txt, SAUDE_KW):        return "SAUDE"
    if _contains(txt, ITALIA_KW):       return "ITALIA_SERVICOS"
    if _contains(txt, PROFISSIONAL_KW): return "PERFIL_PROFISSIONAL"
    return "GERAL"


def calc_priority(has_email: bool, has_prof: bool, categoria: str) -> int:
    p = 3  # tem telefone (já filtrado)
    if has_email: p += 1
    if has_prof:  p += 1
    if categoria == "ITALIA_SERVICOS":   p += 4
    elif categoria == "SAUDE":           p += 2
    elif categoria == "PERFIL_PROFISSIONAL": p += 2
    return p


def find_col(headers: list, candidates: list):
    """Retorna índice (int) da primeira coluna que bater (case-insensitive), ou None."""
    h = [h.lower().strip() for h in headers]
    for c in candidates:
        try:
            return h.index(c.lower().strip())
        except ValueError:
            pass
    return None


def get_cell(row: list, idx, default="") -> str:
    if idx is None or idx >= len(row):
        return default
    return (row[idx] or "").strip()


# ─────────────────────────────────────────────────────────────────────────────
# TAREFA 1 — Autenticar no n8n
# ─────────────────────────────────────────────────────────────────────────────
def task1_login():
    print("\n" + "=" * 60)
    print("TAREFA 1 — Autenticando no n8n")
    print("=" * 60)

    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    session = requests.Session()
    session.verify = False

    url = f"{N8N_URL}/rest/login"
    try:
        resp = session.post(
            url,
            json={"email": N8N_EMAIL, "password": N8N_PASS},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        print(f"  POST {url} → HTTP {resp.status_code}")
        if resp.status_code in (200, 201):
            print("  Cookie de sessão obtido com sucesso")
            print(f"  Cookies: {dict(session.cookies)}")
            print("  ✅ Login OK")
            return session
        else:
            print(f"  ❌ Falha: {resp.status_code} — {resp.text[:300]}")
            return None
    except Exception as e:
        print(f"  ❌ Erro de conexão: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# TAREFA 2 — Corrigir WF02
# ─────────────────────────────────────────────────────────────────────────────
def task2_fix_workflow(session):
    print("\n" + "=" * 60)
    print("TAREFA 2 — Corrigindo WF02 (Anti-Ban Dispatch)")
    print("=" * 60)

    hdrs = {"Content-Type": "application/json", "Accept": "application/json"}

    # GET
    url_get = f"{N8N_URL}/api/v1/workflows/{WF_ID}"
    print(f"\n  GET {url_get}")
    resp = session.get(url_get, headers=hdrs, timeout=30)
    print(f"  HTTP {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ❌ {resp.text[:300]}")
        return False

    wf = resp.json()
    connections = wf.get("connections", {})

    # Encontrar o nó "Split in Batches" (case-insensitive)
    sib_key = next(
        (k for k in connections if "split" in k.lower() and "batch" in k.lower()),
        None,
    )
    if sib_key is None:
        sib_key = "Split in Batches"  # força inserção
        print(f"  ⚠ Nó não encontrado — criando entrada '{sib_key}'")
    else:
        print(f"\n  Nó encontrado: '{sib_key}'")
        print(f"  Conexões ANTES: {json.dumps(connections[sib_key], indent=4)}")

    # Aplicar correção
    wf["connections"][sib_key] = {
        "main": [
            [],   # output 0 — "done" (sem conexão)
            [{"node": "Code - Build Message", "type": "main", "index": 0}],  # output 1 — loop
        ]
    }
    print(f"\n  Conexões DEPOIS: {json.dumps(wf['connections'][sib_key], indent=4)}")

    # PUT
    url_put = f"{N8N_URL}/api/v1/workflows/{WF_ID}"
    print(f"\n  PUT {url_put}")
    resp_put = session.put(url_put, json=wf, headers=hdrs, timeout=30)
    print(f"  HTTP {resp_put.status_code}")
    if resp_put.status_code not in (200, 201):
        print(f"  ❌ {resp_put.text[:400]}")
        return False
    print("  ✅ Workflow salvo")

    # Ativar
    url_act = f"{N8N_URL}/api/v1/workflows/{WF_ID}/activate"
    print(f"\n  POST {url_act}")
    resp_act = session.post(url_act, headers=hdrs, timeout=30)
    print(f"  HTTP {resp_act.status_code}")
    if resp_act.status_code in (200, 201):
        data = resp_act.json()
        active = data.get("active", data.get("data", {}).get("active", "?"))
        print(f"  ✅ Workflow ativo: {active}")
        return True
    else:
        print(f"  ❌ {resp_act.text[:300]}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# TAREFA 3 — Criar tabela no PostgreSQL
# ─────────────────────────────────────────────────────────────────────────────
DDL = """
CREATE SCHEMA IF NOT EXISTS velloso;

CREATE TABLE IF NOT EXISTS velloso.leads (
  id                   BIGSERIAL PRIMARY KEY,
  nome                 TEXT NOT NULL DEFAULT 'Lead',
  telefone_original    TEXT,
  telefone_normalizado TEXT UNIQUE NOT NULL,
  email                TEXT,
  cidade               TEXT,
  estado               TEXT,
  profissao            TEXT,
  observacao           TEXT,
  categoria            TEXT NOT NULL DEFAULT 'GERAL',
  prioridade           INTEGER NOT NULL DEFAULT 0,
  status_envio         TEXT NOT NULL DEFAULT 'AGUARDANDO',
  etapa_envio          INTEGER NOT NULL DEFAULT 0,
  respondeu            BOOLEAN NOT NULL DEFAULT FALSE,
  data_ultimo_envio    TIMESTAMPTZ,
  proximo_followup     TIMESTAMPTZ,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status
  ON velloso.leads(status_envio);

CREATE INDEX IF NOT EXISTS idx_leads_prioridade
  ON velloso.leads(prioridade DESC, id ASC);
"""


def task3_create_table():
    print("\n" + "=" * 60)
    print("TAREFA 3 — Criando schema/tabela no PostgreSQL")
    print("=" * 60)

    try:
        import psycopg2
    except ImportError:
        print("  ❌ psycopg2 não instalado. Execute: pip install psycopg2-binary")
        return None

    conn = None
    for sslmode in (None, "require"):
        label = f"sslmode={sslmode}" if sslmode else "sem SSL"
        print(f"\n  Conectando ({label})…")
        try:
            args = dict(
                host=PG_HOST, port=PG_PORT,
                user=PG_USER, password=PG_PASS,
                dbname=PG_DB, connect_timeout=20,
            )
            if sslmode:
                args["sslmode"] = sslmode
            conn = psycopg2.connect(**args)
            print(f"  ✅ Conectado ({label})")
            break
        except Exception as e:
            print(f"  ⚠ Falha: {e}")
            conn = None

    if conn is None:
        print("  ❌ Não foi possível conectar ao PostgreSQL")
        return None

    cur = conn.cursor()
    try:
        cur.execute(DDL)
        conn.commit()
        print("  ✅ Schema e tabela criados (ou já existiam)")
    except Exception as e:
        conn.rollback()
        print(f"  ❌ Erro no DDL: {e}")
        cur.close()
        conn.close()
        return None

    cur.execute("SELECT COUNT(*) FROM velloso.leads;")
    count = cur.fetchone()[0]
    print(f"  Leads existentes no banco: {count}")

    cur.close()
    return conn


# ─────────────────────────────────────────────────────────────────────────────
# TAREFA 4 — Importar leads
# ─────────────────────────────────────────────────────────────────────────────
INSERT_SQL = """
INSERT INTO velloso.leads
  (nome, telefone_original, telefone_normalizado, email,
   cidade, estado, profissao, observacao, categoria, prioridade)
VALUES
  (%(nome)s, %(telefone_original)s, %(telefone_normalizado)s, %(email)s,
   %(cidade)s, %(estado)s, %(profissao)s, %(observacao)s,
   %(categoria)s, %(prioridade)s)
ON CONFLICT (telefone_normalizado) DO NOTHING;
"""


def task4_import_leads(conn):
    print("\n" + "=" * 60)
    print("TAREFA 4 — Importando leads da planilha")
    print("=" * 60)

    # 4.1 Baixar CSV
    print(f"\n  Baixando CSV…")
    try:
        resp = requests.get(CSV_URL, timeout=60)
        resp.raise_for_status()
        print(f"  ✅ {len(resp.content):,} bytes baixados")
    except Exception as e:
        print(f"  ❌ Erro ao baixar CSV: {e}")
        return False

    # 4.2 Parse
    content  = resp.content.decode("utf-8-sig", errors="replace")
    reader   = csv.reader(io.StringIO(content))
    all_rows = list(reader)
    if not all_rows:
        print("  ❌ CSV vazio")
        return False

    headers   = all_rows[0]
    data_rows = all_rows[1:]
    total     = len(data_rows)
    print(f"  Total de linhas: {total}")
    print(f"  Colunas: {headers}")

    # Mapeamento flexível de colunas
    idx_nome   = find_col(headers, ["nome", "name"])
    idx_fone   = find_col(headers, ["telefone", "whatsapp", "celular", "fone", "phone", "tel"])
    idx_email  = find_col(headers, ["email", "e-mail"])
    idx_cidade = find_col(headers, ["cidade", "city"])
    idx_estado = find_col(headers, ["estado", "state", "uf"])
    idx_prof   = find_col(headers, ["profissao", "profiss\u00e3o", "cargo", "ocupa\u00e7\u00e3o", "ocupacao"])
    idx_obs    = find_col(headers, ["observacao", "observa\u00e7\u00e3o", "obs", "bio", "descricao", "descri\u00e7\u00e3o"])

    print("\n  Mapeamento de colunas:")
    for label, idx in [
        ("nome", idx_nome), ("telefone", idx_fone), ("email", idx_email),
        ("cidade", idx_cidade), ("estado", idx_estado),
        ("profissao", idx_prof), ("observacao", idx_obs),
    ]:
        col = headers[idx] if idx is not None else "—NÃO ENCONTRADA—"
        print(f"    {label:<12}: col {str(idx):<4} ({col})")

    if idx_fone is None:
        print("  ❌ Coluna de telefone não encontrada no CSV — abortando")
        return False

    # 4.3 Filtrar
    approved    = []
    seen_phones = set()
    excluidos   = {
        "sem_telefone":    0,
        "fone_invalido":   0,
        "duplicado":       0,
        "empresa":         0,
        "juridico":        0,
        "concorrente":     0,
    }

    for row in data_rows:
        nome   = get_cell(row, idx_nome) or "Lead"
        fone   = get_cell(row, idx_fone)
        email  = get_cell(row, idx_email)
        cidade = get_cell(row, idx_cidade)
        estado = get_cell(row, idx_estado)
        prof   = get_cell(row, idx_prof)
        obs    = get_cell(row, idx_obs)

        if not fone:
            excluidos["sem_telefone"] += 1
            continue

        norm = normalize_phone(fone)
        if norm is None:
            excluidos["fone_invalido"] += 1
            continue

        if norm in seen_phones:
            excluidos["duplicado"] += 1
            continue

        # Empresa: nome contém palavra-chave OU padrão "grupo \w+"
        nome_l = nome.lower()
        if _contains(nome_l, EMPRESA_KW) or re.search(r"\bgrupo\b", nome_l):
            excluidos["empresa"] += 1
            continue

        # Jurídico
        if _contains(f"{nome} {prof} {obs}", JURIDICO_KW):
            excluidos["juridico"] += 1
            continue

        # Concorrente (observação)
        if _contains(obs, CONCORRENTE_KW):
            excluidos["concorrente"] += 1
            continue

        # Aprovado
        seen_phones.add(norm)
        categoria  = detect_category(nome, prof, obs)
        prioridade = calc_priority(bool(email), bool(prof), categoria)

        approved.append({
            "nome":                 nome,
            "telefone_original":    fone,
            "telefone_normalizado": norm,
            "email":                email or None,
            "cidade":               cidade or None,
            "estado":               estado or None,
            "profissao":            prof or None,
            "observacao":           obs or None,
            "categoria":            categoria,
            "prioridade":           prioridade,
        })

    total_excluido = sum(excluidos.values())
    cat_dist = {}
    for lead in approved:
        cat_dist[lead["categoria"]] = cat_dist.get(lead["categoria"], 0) + 1

    print(f"\n  Aprovados : {len(approved)}")
    print(f"  Excluídos : {total_excluido}")
    for motivo, qtd in excluidos.items():
        print(f"    {motivo:<20}: {qtd}")
    print(f"  Distribuição por categoria: {cat_dist}")

    # 4.4 Inserir no banco
    if conn is None:
        print("\n  ⚠ Sem conexão com o banco — leads NÃO inseridos")
        return True

    import psycopg2
    cur      = conn.cursor()
    inserted = 0
    errors   = 0

    for lead in approved:
        try:
            cur.execute(INSERT_SQL, lead)
            inserted += cur.rowcount
        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  ⚠ Erro ({lead['telefone_normalizado']}): {e}")
            conn.rollback()
            cur = conn.cursor()

    conn.commit()
    cur.close()

    # Relatório final
    print("\n" + "─" * 60)
    print("RELATÓRIO — TAREFA 4")
    print("─" * 60)
    print(f"  Total linhas na planilha  : {total:>6}")
    print(f"  Total aprovados           : {len(approved):>6}")
    print(f"  Total excluídos           : {total_excluido:>6}")
    for motivo, qtd in excluidos.items():
        print(f"    {motivo:<22}: {qtd:>4}")
    print(f"  Inseridos no banco        : {inserted:>6}")
    if errors:
        print(f"  Erros de inserção         : {errors:>6}")
    print(f"  Distribuição por categoria:")
    for cat, qtd in sorted(cat_dist.items(), key=lambda x: -x[1]):
        print(f"    {cat:<25}: {qtd:>4}")
    return True


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    results = {}

    session = task1_login()
    results["T1 — Login n8n"]         = "✅" if session else "❌"

    if session:
        ok2 = task2_fix_workflow(session)
        results["T2 — Corrigir WF02"] = "✅" if ok2 else "❌"
    else:
        results["T2 — Corrigir WF02"] = "⏭  (sem sessão)"

    conn = task3_create_table()
    results["T3 — Criar tabela PG"]   = "✅" if conn else "❌"

    ok4 = task4_import_leads(conn)
    results["T4 — Importar leads"]    = "✅" if ok4 else "❌"

    if conn:
        conn.close()

    print("\n" + "=" * 60)
    print("RESUMO FINAL")
    print("=" * 60)
    for task, status in results.items():
        print(f"  {status}  {task}")
    print()


if __name__ == "__main__":
    main()
