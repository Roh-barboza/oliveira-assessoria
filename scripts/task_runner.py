#!/usr/bin/env python3
"""
Script para executar as 4 tarefas:
1. Autenticar no n8n
2. Corrigir WF02 (Anti-Ban Dispatch)
3. Criar tabela no PostgreSQL
4. Importar leads da planilha
"""

import requests
import json
import csv
import re
import io
import sys
from datetime import datetime

# ─────────────────────────────────────────────
# CREDENCIAIS
# ─────────────────────────────────────────────
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

# ─────────────────────────────────────────────
# TAREFA 1 — Autenticar no n8n
# ─────────────────────────────────────────────
def task1_login():
    print("\n" + "="*60)
    print("TAREFA 1 — Autenticando no n8n")
    print("="*60)

    session = requests.Session()
    session.verify = False  # ignora SSL autoassinado se houver
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    # Tenta /rest/login
    url = f"{N8N_URL}/rest/login"
    payload = {"email": N8N_EMAIL, "password": N8N_PASS}
    headers = {"Content-Type": "application/json"}

    try:
        resp = session.post(url, json=payload, headers=headers, timeout=30)
        print(f"  POST {url} → {resp.status_code}")
        if resp.status_code in (200, 201):
            print("  ✅ Login bem-sucedido")
            print(f"  Cookies: {dict(session.cookies)}")
            return session
        else:
            print(f"  ❌ Falha no login: {resp.status_code} — {resp.text[:300]}")
            return None
    except Exception as e:
        print(f"  ❌ Erro de conexão: {e}")
        return None


# ─────────────────────────────────────────────
# TAREFA 2 — Corrigir WF02
# ─────────────────────────────────────────────
def task2_fix_workflow(session):
    print("\n" + "="*60)
    print("TAREFA 2 — Corrigindo WF02 (Anti-Ban Dispatch)")
    print("="*60)

    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    # 2.1 GET workflow
    url_get = f"{N8N_URL}/api/v1/workflows/{WF_ID}"
    print(f"\n  GET {url_get}")
    resp = session.get(url_get, headers=headers, timeout=30)
    print(f"  Status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"  ❌ Erro ao buscar workflow: {resp.text[:300]}")
        return False

    wf = resp.json()

    # Inspecionar conexões atuais do Split in Batches
    connections = wf.get("connections", {})
    sib_key = None
    for k in connections:
        if "split" in k.lower() and "batch" in k.lower():
            sib_key = k
            break
    if sib_key is None:
        # Tenta match exato
        for k in connections:
            if "Split" in k:
                sib_key = k
                break

    print(f"\n  Nó encontrado: '{sib_key}'")
    if sib_key:
        print(f"  Conexões atuais: {json.dumps(connections[sib_key], indent=4)}")

    # 2.2 Corrigir conexões
    # main[0] = [] (saída "done" sem conexão)
    # main[1] = [{"node": "Code - Build Message", "type": "main", "index": 0}]
    if sib_key:
        wf["connections"][sib_key]["main"] = [
            [],   # output 0 — done (sem conexão)
            [{"node": "Code - Build Message", "type": "main", "index": 0}]  # output 1 — loop
        ]
        print(f"\n  Conexões corrigidas:")
        print(f"  {json.dumps(wf['connections'][sib_key], indent=4)}")
    else:
        print("  ⚠ Nó 'Split in Batches' não encontrado nas conexões, tentando inserir...")
        wf["connections"]["Split in Batches"] = {
            "main": [
                [],
                [{"node": "Code - Build Message", "type": "main", "index": 0}]
            ]
        }

    # 2.3 PUT (salvar)
    url_put = f"{N8N_URL}/api/v1/workflows/{WF_ID}"
    print(f"\n  PUT {url_put}")
    resp_put = session.put(url_put, json=wf, headers=headers, timeout=30)
    print(f"  Status: {resp_put.status_code}")
    if resp_put.status_code not in (200, 201):
        print(f"  ❌ Erro ao salvar: {resp_put.text[:400]}")
        return False
    print("  ✅ Workflow salvo")

    # 2.4 Ativar
    url_activate = f"{N8N_URL}/api/v1/workflows/{WF_ID}/activate"
    print(f"\n  POST {url_activate}")
    resp_act = session.post(url_activate, headers=headers, timeout=30)
    print(f"  Status: {resp_act.status_code}")
    if resp_act.status_code in (200, 201):
        data = resp_act.json()
        active = data.get("active", data.get("data", {}).get("active", "?"))
        print(f"  ✅ Workflow ativado — active: {active}")
        return True
    else:
        print(f"  ❌ Erro ao ativar: {resp_act.text[:300]}")
        return False


# ─────────────────────────────────────────────
# TAREFA 3 — Criar tabela no PostgreSQL
# ─────────────────────────────────────────────
def task3_create_table():
    print("\n" + "="*60)
    print("TAREFA 3 — Criando tabela no PostgreSQL")
    print("="*60)

    try:
        import psycopg2
    except ImportError:
        print("  ❌ psycopg2 não instalado")
        return None

    conn = None
    # Tenta sem SSL primeiro, depois com SSL
    for sslmode in [None, "require"]:
        try:
            conn_args = dict(
                host=PG_HOST, port=PG_PORT,
                user=PG_USER, password=PG_PASS,
                dbname=PG_DB, connect_timeout=15
            )
            if sslmode:
                conn_args["sslmode"] = sslmode
                print(f"\n  Tentando com sslmode={sslmode}...")
            else:
                print("\n  Tentando conexão sem SSL...")

            conn = psycopg2.connect(**conn_args)
            print(f"  ✅ Conectado ao PostgreSQL ({sslmode or 'sem SSL'})")
            break
        except Exception as e:
            print(f"  ⚠ Falha: {e}")
            conn = None

    if conn is None:
        print("  ❌ Não foi possível conectar ao PostgreSQL")
        return None

    cur = conn.cursor()

    ddl = """
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

    try:
        cur.execute(ddl)
        conn.commit()
        print("  ✅ Schema e tabela criados (ou já existem)")
    except Exception as e:
        conn.rollback()
        print(f"  ❌ Erro no DDL: {e}")
        cur.close()
        conn.close()
        return None

    # Contar leads existentes
    cur.execute("SELECT COUNT(*) FROM velloso.leads;")
    count = cur.fetchone()[0]
    print(f"  📊 Leads existentes no banco: {count}")

    cur.close()
    return conn


# ─────────────────────────────────────────────
# TAREFA 4 — Importar leads
# ─────────────────────────────────────────────
EMPRESAS_KW = [
    "ltda","s.a.","me ","epp","eireli","cnpj","construtora","imobili",
    "incorporadora","holding","associa","instituto","funda","sindicato",
    "cooperativa","cl\u00ednica","hospital","escola","col\u00e9gio","academia",
    "assessoria","consultoria","ag\u00eancia","financeira","seguradora",
    "corretora","distribuidora","tecnologia","contabilidade"
]
JURIDICO_KW = ["oab","advogado","advocacia","jur\u00eddico","procurador","defensoria"]
CONCORRENTES_KW = [
    "cidadania italiana","passaporte italiano","visto europeu","passaporto italiano"
]

SAUDE_KW      = ["m\u00e9dic","enfermeir","dentist","farm\u00e2ceut","fisioter",
                  "psic\u00f3log","nutricion","biom\u00e9dic","veterin\u00e1r",
                  "cirurgi","radiolog","fonoaud"]
ITALIA_KW     = ["bisav\u00f4","antepassado","ascend\u00eancia italiana","nona","nonno"]
PROFISSIONAL_KW = ["engenh","arquitet","contador","economista","administrador",
                   "gerente","diretor","professor","analista","coordenador"]

def normalize_phone(raw: str) -> str | None:
    """Normaliza telefone para formato 55DDNUMERO. Retorna None se inválido."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    # Remove DDI 55 se vier duplicado
    if digits.startswith("55") and len(digits) > 12:
        digits = digits[2:]
    # Adiciona DDI 55 se não tiver
    if not digits.startswith("55"):
        digits = "55" + digits
    # Valida: 55 + DDD(2) + número(8-9) = 12 ou 13 dígitos
    if len(digits) not in (12, 13):
        return None
    ddd = int(digits[2:4])
    if ddd < 11 or ddd > 99:
        return None
    return digits

def contains_any(text: str, keywords: list) -> bool:
    t = text.lower()
    return any(k in t for k in keywords)

def detect_category(nome: str, profissao: str, obs: str) -> str:
    combined = f"{nome} {profissao} {obs}".lower()
    if contains_any(combined, SAUDE_KW):
        return "SAUDE"
    if contains_any(combined, ITALIA_KW):
        return "ITALIA_SERVICOS"
    if contains_any(combined, PROFISSIONAL_KW):
        return "PERFIL_PROFISSIONAL"
    return "GERAL"

def calc_priority(has_phone: bool, has_email: bool, has_prof: bool, categoria: str) -> int:
    p = 0
    if has_phone:   p += 3
    if has_email:   p += 1
    if has_prof:    p += 1
    if categoria == "ITALIA_SERVICOS":   p += 4
    elif categoria == "SAUDE":           p += 2
    elif categoria == "PERFIL_PROFISSIONAL": p += 2
    return p

def find_col(headers: list, candidates: list) -> int | None:
    """Retorna índice da primeira coluna encontrada (case-insensitive)."""
    h_lower = [h.lower().strip() for h in headers]
    for c in candidates:
        try:
            return h_lower.index(c.lower())
        except ValueError:
            pass
    return None

def task4_import_leads(conn):
    print("\n" + "="*60)
    print("TAREFA 4 — Importando leads da planilha")
    print("="*60)

    # 4.1 Baixar CSV
    print(f"\n  Baixando CSV: {CSV_URL[:80]}...")
    try:
        resp = requests.get(CSV_URL, timeout=60)
        resp.raise_for_status()
        print(f"  ✅ CSV baixado ({len(resp.content)} bytes)")
    except Exception as e:
        print(f"  ❌ Erro ao baixar CSV: {e}")
        return False

    # 4.2 Parse
    content = resp.content.decode("utf-8-sig", errors="replace")
    reader  = csv.reader(io.StringIO(content))
    rows    = list(reader)
    if not rows:
        print("  ❌ CSV vazio")
        return False

    headers = rows[0]
    data_rows = rows[1:]
    total_linhas = len(data_rows)
    print(f"  Total de linhas (sem cabeçalho): {total_linhas}")
    print(f"  Colunas: {headers}")

    # Mapear colunas flexíveis
    idx_nome   = find_col(headers, ["nome","name","Nome","NOME"])
    idx_fone   = find_col(headers, ["telefone","whatsapp","celular","fone","Telefone","WhatsApp","celular","phone"])
    idx_email  = find_col(headers, ["email","e-mail","Email","E-mail"])
    idx_cidade = find_col(headers, ["cidade","city","Cidade"])
    idx_estado = find_col(headers, ["estado","state","uf","Estado"])
    idx_prof   = find_col(headers, ["profissao","profiss\u00e3o","cargo","ocupa\u00e7\u00e3o","ocupacao","Profiss\u00e3o","Cargo"])
    idx_obs    = find_col(headers, ["observacao","observa\u00e7\u00e3o","obs","bio","descricao","descri\u00e7\u00e3o","Observa\u00e7\u00e3o"])

    print(f"\n  Mapeamento de colunas:")
    for name, idx in [("nome",idx_nome),("telefone",idx_fone),("email",idx_email),
                      ("cidade",idx_cidade),("estado",idx_estado),("profissao",idx_prof),
                      ("observacao",idx_obs)]:
        col_name = headers[idx] if idx is not None else "NÃO ENCONTRADA"
        print(f"    {name}: col {idx} ({col_name})")

    def get(row, idx):
        if idx is None or idx >= len(row):
            return ""
        return (row[idx] or "").strip()

    # 4.3 Filtrar e processar
    approved = []
    seen_phones = set()

    excluidos = {
        "sem_telefone": 0,
        "telefone_invalido": 0,
        "duplicado": 0,
        "empresa": 0,
        "juridico": 0,
        "concorrente": 0,
    }

    for row in data_rows:
        nome    = get(row, idx_nome)   or "Lead"
        fone    = get(row, idx_fone)
        email   = get(row, idx_email)
        cidade  = get(row, idx_cidade)
        estado  = get(row, idx_estado)
        prof    = get(row, idx_prof)
        obs     = get(row, idx_obs)

        # Filtro: sem telefone
        if not fone:
            excluidos["sem_telefone"] += 1
            continue

        # Filtro: normalizar e validar telefone BR
        norm = normalize_phone(fone)
        if norm is None:
            excluidos["telefone_invalido"] += 1
            continue

        # Filtro: duplicado
        if norm in seen_phones:
            excluidos["duplicado"] += 1
            continue

        # Filtro: empresa
        nome_lower = nome.lower()
        if contains_any(nome_lower, EMPRESAS_KW):
            excluidos["empresa"] += 1
            continue
        # Verifica "grupo + palavra"
        if re.search(r"\bgrupo\b", nome_lower):
            excluidos["empresa"] += 1
            continue

        # Filtro: jurídico
        combined_check = f"{nome} {prof} {obs}".lower()
        if contains_any(combined_check, JURIDICO_KW):
            excluidos["juridico"] += 1
            continue

        # Filtro: concorrentes (na observação)
        if contains_any(obs.lower(), CONCORRENTES_KW):
            excluidos["concorrente"] += 1
            continue

        # Aprovado
        seen_phones.add(norm)
        categoria  = detect_category(nome, prof, obs)
        prioridade = calc_priority(True, bool(email), bool(prof), categoria)

        approved.append({
            "nome": nome,
            "telefone_original": fone,
            "telefone_normalizado": norm,
            "email": email or None,
            "cidade": cidade or None,
            "estado": estado or None,
            "profissao": prof or None,
            "observacao": obs or None,
            "categoria": categoria,
            "prioridade": prioridade,
        })

    total_aprovados = len(approved)
    total_excluidos = sum(excluidos.values())
    print(f"\n  Filtrados: {total_aprovados} aprovados / {total_excluidos} excluídos")
    print(f"  Motivos de exclusão: {excluidos}")

    # Distribuição por categoria
    cat_dist = {}
    for lead in approved:
        cat_dist[lead["categoria"]] = cat_dist.get(lead["categoria"], 0) + 1
    print(f"  Distribuição por categoria: {cat_dist}")

    if conn is None:
        print("  ⚠ Sem conexão com PostgreSQL — leads não inseridos")
        return True

    # 4.4 Inserir no banco
    import psycopg2.extras
    cur = conn.cursor()
    insert_sql = """
INSERT INTO velloso.leads
  (nome, telefone_original, telefone_normalizado, email,
   cidade, estado, profissao, observacao,
   categoria, prioridade)
VALUES
  (%(nome)s, %(telefone_original)s, %(telefone_normalizado)s, %(email)s,
   %(cidade)s, %(estado)s, %(profissao)s, %(observacao)s,
   %(categoria)s, %(prioridade)s)
ON CONFLICT (telefone_normalizado) DO NOTHING;
"""
    inserted = 0
    errors = 0
    for lead in approved:
        try:
            cur.execute(insert_sql, lead)
            if cur.rowcount > 0:
                inserted += 1
        except Exception as e:
            errors += 1
            if errors <= 3:
                print(f"  ⚠ Erro ao inserir {lead['telefone_normalizado']}: {e}")
            conn.rollback()
            cur = conn.cursor()

    conn.commit()
    cur.close()

    print(f"\n  ✅ Inseridos no banco: {inserted}")
    if errors:
        print(f"  ⚠ Erros de inserção: {errors}")

    # Relatório final
    print("\n" + "─"*60)
    print("RELATÓRIO FINAL — TAREFA 4")
    print("─"*60)
    print(f"  Total de linhas na planilha : {total_linhas}")
    print(f"  Total aprovados (filtrados) : {total_aprovados}")
    print(f"  Total excluídos             : {total_excluidos}")
    for motivo, qtd in excluidos.items():
        print(f"    {motivo:<25}: {qtd}")
    print(f"  Total inserido no banco     : {inserted}")
    print(f"  Distribuição por categoria  :")
    for cat, qtd in sorted(cat_dist.items(), key=lambda x: -x[1]):
        print(f"    {cat:<25}: {qtd}")

    return True


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    results = {}

    # T1
    session = task1_login()
    results["T1 - Login n8n"] = "✅" if session else "❌"

    # T2
    if session:
        ok2 = task2_fix_workflow(session)
        results["T2 - Corrigir WF02"] = "✅" if ok2 else "❌"
    else:
        results["T2 - Corrigir WF02"] = "⏭ Pulado (sem sessão)"

    # T3
    conn = task3_create_table()
    results["T3 - Criar tabela PG"] = "✅" if conn else "❌"

    # T4
    ok4 = task4_import_leads(conn)
    results["T4 - Importar leads"] = "✅" if ok4 else "❌"

    if conn:
        conn.close()

    print("\n" + "="*60)
    print("RESUMO FINAL")
    print("="*60)
    for task, status in results.items():
        print(f"  {status}  {task}")
    print()

if __name__ == "__main__":
    main()
