#!/bin/bash
# Correction tracker
# Usage: ./log_correction.sh "context" "correction text"

CORRECTIONS_DIR="/root/.openclaw/workspace/memory/corrections"
TODAY=$(date +%Y-%m-%d)

log_correction() {
    local context="$1"
    local correction="$2"
    local timestamp=$(date +"%Y-%m-%d %H:%M")
    
    echo "[$timestamp] | $context | $correction | 1" >> "$CORRECTIONS_DIR/$TODAY.md"
    echo "✓ Logged correction"
}

# Check for repetition
check_repetition() {
    local correction="$1"
    local count=$(grep -c "$correction" "$CORRECTIONS_DIR"/*.md 2>/dev/null || echo 0)
    
    if [[ $count -ge 3 ]]; then
        echo "⚠️ Same correction seen 3x. Ask Sukrit: promote to permanent rule?"
    fi
}

# If called with args, log them
if [[ -n "$1" && -n "$2" ]]; then
    log_correction "$1" "$2"
    check_repetition "$2"
fi