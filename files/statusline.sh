#!/bin/sh
input=$(cat)

R=$(printf '\033[0m')
G=$(printf '\033[1;32m')
C=$(printf '\033[0;36m')
B=$(printf '\033[1;34m')
RE=$(printf '\033[0;31m')
YE=$(printf '\033[0;33m')
GR=$(printf '\033[0;32m')
PU=$(printf '\033[0;35m')
DIM=$(printf '\033[2m')
SEP="${R}${DIM} | ${R}"

# Dir + git
dir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty' 2>/dev/null)
[ -z "$dir" ] && dir="$HOME"
short_dir=$(basename "$dir")
branch=$(git --no-optional-locks -C "$dir" branch --show-current 2>/dev/null)
dirty=$([ -n "$branch" ] && git --no-optional-locks -C "$dir" status --porcelain 2>/dev/null)

out="${G}➜${R} ${C}${short_dir}${R}"
[ -n "$branch" ] && out="$out ${B}git:(${R}${RE}${branch}${R}${B})${R}"
[ -n "$dirty" ]  && out="$out ${YE}✗${R}"

# Color by percentage
pct_color() {
  p=$1
  if [ "$p" -ge 80 ] 2>/dev/null; then printf '%s' "$RE"
  elif [ "$p" -ge 50 ] 2>/dev/null; then printf '%s' "$YE"
  else printf '%s' "$GR"
  fi
}

# Model + effort
model=$(echo "$input" | jq -r '.model.display_name // empty' 2>/dev/null)
effort=$(echo "$input" | jq -r '.effort.level // empty' 2>/dev/null)
if [ -n "$model" ]; then
  label="$model"
  [ -n "$effort" ] && label="$label/$effort"
  out="$out${SEP}${PU}${label}${R}"
fi

# Compact token formatter: raw under 1000, Xk under 1M, X.Xm above
fmt_tok() {
  n=$1
  if [ -z "$n" ] || [ "$n" = "null" ]; then echo "?"; return; fi
  n=$(printf '%.0f' "$n")
  if [ "$n" -ge 1000000 ] 2>/dev/null; then
    printf '%.1fm' "$(echo "$n 1000000" | awk '{printf "%.1f", $1/$2}')"
  elif [ "$n" -ge 1000 ] 2>/dev/null; then
    printf '%dk' "$(( n / 1000 ))"
  else
    printf '%d' "$n"
  fi
}

# Context window
ctx_raw=$(echo "$input" | jq -r '.context_window.used_percentage // empty' 2>/dev/null)
tok_in=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty' 2>/dev/null)
tok_out=$(echo "$input" | jq -r '.context_window.total_output_tokens // empty' 2>/dev/null)
if [ -n "$ctx_raw" ]; then
  ctx=$(printf '%.2f' "$ctx_raw")
  col=$(pct_color "$ctx_raw")
  tok_str=""
  if [ -n "$tok_in" ] || [ -n "$tok_out" ]; then
    tok_str=" (in $(fmt_tok "$tok_in") | out $(fmt_tok "$tok_out"))"
  fi
  out="$out${SEP}${col}ctx ${ctx}%${tok_str}${R}"
fi

# 5h limit
five_raw=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty' 2>/dev/null)
five_reset=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty' 2>/dev/null)
if [ -n "$five_raw" ]; then
  five_pct=$(printf '%.2f' "$five_raw")
  col=$(pct_color "$five_raw")
  rst=""
  [ -n "$five_reset" ] && rst=" →$(date -r "$five_reset" '+%H:%M' 2>/dev/null)"
  out="$out${SEP}${col}5h ${five_pct}%${rst}${R}"
fi

# 7-day limit
seven_raw=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty' 2>/dev/null)
seven_reset=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty' 2>/dev/null)
if [ -n "$seven_raw" ]; then
  seven_pct=$(printf '%.2f' "$seven_raw")
  col=$(pct_color "$seven_raw")
  rst=""
  [ -n "$seven_reset" ] && rst=" →$(date -r "$seven_reset" '+%a %H:%M' 2>/dev/null)"
  out="$out${SEP}${col}7d ${seven_pct}%${rst}${R}"
fi

printf '%s\n' "$out"
