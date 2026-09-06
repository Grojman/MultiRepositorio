#!/usr/bin/env bash
# Escanea el repositorio y genera data/index.json con el árbol completo de
# carpetas y archivos (ignorando solo la infraestructura propia de la web).
# Ejecuta este script manualmente cada vez que añadas o quites recursos,
# y confirma (commit) el data/index.json resultante.
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: este script necesita 'jq'. Instálalo con 'sudo apt install jq' o 'brew install jq'." >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_FILE="$ROOT_DIR/data/index.json"

# Carpetas y archivos propios de la web que no forman parte del contenido.
EXCLUDE_DIRS=("assets" "data" ".git" ".github")
EXCLUDE_FILES=("index.html" "scan.sh" "README.md" ".nojekyll" ".gitignore")

is_excluded_at_root() {
  local base="$1"
  local d f
  for d in "${EXCLUDE_DIRS[@]}"; do [[ "$base" == "$d" ]] && return 0; done
  for f in "${EXCLUDE_FILES[@]}"; do [[ "$base" == "$f" ]] && return 0; done
  return 1
}

kind_for_ext() {
  case "$1" in
    txt|md|markdown) echo "text" ;;
    pdf) echo "pdf" ;;
    png|jpg|jpeg|gif|webp|svg|bmp) echo "image" ;;
    mp4|webm|mov|mkv|avi) echo "video" ;;
    mp3|wav|ogg|m4a|flac) echo "audio" ;;
    json) echo "test" ;;
    *) echo "other" ;;
  esac
}

# Devuelve (por stdout) un array JSON con los hijos directos de $1 ("" para el
# nombre relativo == raíz). Se llama a sí misma para las subcarpetas.
scan_children() {
  local dir="$1" relpath="$2" is_root="$3"
  local nodes=()

  while IFS= read -r -d '' entry; do
    local base rel_path
    base="$(basename "$entry")"

    if [[ "$is_root" == "1" ]] && is_excluded_at_root "$base"; then
      continue
    fi

    if [[ -n "$relpath" ]]; then rel_path="$relpath/$base"; else rel_path="$base"; fi

    local node
    if [[ -d "$entry" ]]; then
      local sub_children
      sub_children="$(scan_children "$entry" "$rel_path" "0")"
      node="$(jq -n --arg name "$base" --arg path "$rel_path" --argjson children "$sub_children" \
        '{name:$name, type:"dir", path:$path, children:$children}')"
    else
      local ext ext_lower kind size
      if [[ "$base" == *.* ]]; then ext="${base##*.}"; else ext=""; fi
      ext_lower="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
      kind="$(kind_for_ext "$ext_lower")"
      size="$(stat -c%s "$entry" 2>/dev/null || stat -f%z "$entry" 2>/dev/null || echo 0)"
      node="$(jq -n --arg name "$base" --arg path "$rel_path" --arg ext "$ext_lower" --arg kind "$kind" --argjson size "$size" \
        '{name:$name, type:"file", path:$path, ext:$ext, kind:$kind, size:$size}')"
    fi
    nodes+=("$node")
  done < <(find "$dir" -mindepth 1 -maxdepth 1 -print0 | sort -z)

  if [[ "${#nodes[@]}" -eq 0 ]]; then
    echo "[]"
  else
    printf '%s\n' "${nodes[@]}" | jq -s '.'
  fi
}

mkdir -p "$ROOT_DIR/data"
children_json="$(scan_children "$ROOT_DIR" "" "1")"
generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

jq -n --arg generatedAt "$generated_at" --argjson children "$children_json" \
  '{generatedAt:$generatedAt, root:{name:"root", type:"dir", path:"", children:$children}}' \
  > "$OUT_FILE"

echo "Índice generado en: $OUT_FILE"
