#!/usr/bin/env bash
# Roda as migrations, o seed e os testes de RLS (pgTAP) num Postgres temporário,
# sem Docker e sem Supabase CLI. Útil em CI ou em máquinas sem Docker.
#
# Requisitos: PostgreSQL 15+ (postgres, initdb, pg_ctl, psql), extensão pgTAP e pg_prove.
#   Debian/Ubuntu: apt-get install postgresql-16 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl
#
# Com Docker disponível, prefira: npm run db:start && npm run db:test
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORTA="${PORTA_PG_TESTE:-54329}"

if [[ -n "${PG_BIN:-}" ]]; then
  BIN="$PG_BIN"
elif compgen -G "/usr/lib/postgresql/*/bin" > /dev/null; then
  BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
else
  BIN="$(pg_config --bindir)"
fi

# O Postgres não roda como root: nesse caso usa o usuário postgres do sistema.
COMO=()
if [[ "$(id -u)" == "0" ]]; then
  COMO=(runuser -u postgres --)
fi

DIR="$(mktemp -d)"
chmod 755 "$DIR"
[[ ${#COMO[@]} -gt 0 ]] && chown postgres "$DIR"

parar() {
  "${COMO[@]}" "$BIN/pg_ctl" -D "$DIR/dados" -m immediate stop > /dev/null 2>&1 || true
  rm -rf "$DIR"
}
trap parar EXIT

echo "→ Iniciando Postgres temporário ($BIN, porta $PORTA)"
"${COMO[@]}" "$BIN/initdb" -D "$DIR/dados" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 > "$DIR/initdb.log"
"${COMO[@]}" "$BIN/pg_ctl" -D "$DIR/dados" -l "$DIR/postgres.log" -w \
  -o "-p $PORTA -k $DIR -c listen_addresses=''" start > /dev/null

export PGHOST="$DIR" PGPORT="$PORTA" PGUSER=postgres PGDATABASE=postgres
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -c "alter database postgres set search_path = \"\$user\", public, extensions;"

echo "→ Aplicando imitação do Supabase (papéis e schema auth)"
"${PSQL[@]}" -f "$RAIZ/scripts/sql/supabase-stub.sql"

echo "→ Aplicando migrations"
for arquivo in "$RAIZ"/supabase/migrations/*.sql; do
  echo "   $(basename "$arquivo")"
  "${PSQL[@]}" -f "$arquivo"
done

echo "→ Aplicando seed"
"${PSQL[@]}" -f "$RAIZ/supabase/seed.sql"

echo "→ Rodando testes"
pg_prove --ext .sql -r "$RAIZ/supabase/tests"
