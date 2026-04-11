#!/usr/bin/env bash
# Oliveira Assessoria — script de bootstrap
# Execute a partir da raiz do repositório:
#   bash scripts/run.sh

set -e

echo "=== Instalando dependências ==="
pip install psycopg2-binary pandas requests --quiet

echo ""
echo "=== Executando fix_and_import.py ==="
python3 scripts/fix_and_import.py
