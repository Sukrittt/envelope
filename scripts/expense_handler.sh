#!/bin/bash
# Expense handler - minimal, fast, non-repetitive
# Usage: ./expense_handler.sh "item amount" [item amount...]

WORKSPACE_DIR="/root/.openclaw/workspace"
EXPENSES="$WORKSPACE_DIR/productivity/expenses.csv"
SYNC_SCRIPT="$WORKSPACE_DIR/scripts/sync_expenses.mjs"

log_expense() {
    local item="$1"
    local amount="$2"
    local date=$(date +%Y-%m-%d)
    local timestamp=$(date +%Y-%m-%dT%H:%M:%S+05:30)
    
    # Auto-categorize
    case "$item" in
        *football*|*Football*) category="Football" ;;
        *metro*|*Rapido*|*auto*|*Auto*|*travel*|*Travel*) category="Travel" ;;
        *groceries*|*Zepto*|*food*|*Food*|*dinner*|*lunch*|*breakfast*) category="Food" ;;
        *Netflix*|*Spotify*|*subscription*|*Subscription*) category="Subscription" ;;
        *rent*|*Rent*) category="Bills" ;;
        *) category="Shopping" ;;
    esac
    
    echo "$timestamp,$date,$item,$amount,$category,,manual-chat" >> "$EXPENSES"
}

# Handle commands
if [[ "$1" == "/e" ]]; then
    case "$2" in
        view)
            echo "=== TODAY'S EXPENSES ==="
            date +%Y-%m-%d | xargs -I{} grep {} "$EXPENSES" | tail -5
            ;;
        stats)
            echo "=== MARCH STATS ==="
            awk -F',' 'NR>1 && $2 ~ /^2026-03/ {cat[$5]+=$4; total+=$4} END {for(c in cat) print c ": ₹" cat[c]; print "Total: ₹" total}' "$EXPENSES"
            ;;
        *)
            echo "Commands: /e view, /e stats"
            ;;
    esac
    exit 0
fi

# Handle expenses
count=0
for arg in "$@"; do
    # Parse "item amount" format
    item=$(echo "$arg" | sed 's/[0-9.]*$//' | sed 's/ $//')
    amount=$(echo "$arg" | grep -o '[0-9.]*')
    
    if [[ -n "$item" && -n "$amount" ]]; then
        log_expense "$item" "$amount"
        ((count++))
    fi
done

if [[ $count -eq 0 ]]; then
    echo "Usage: expense_handler.sh 'lunch 120' 'coffee 40'"
elif [[ $count -ge 1 ]]; then
    if [[ -f "$SYNC_SCRIPT" ]]; then
        node "$SYNC_SCRIPT" >/dev/null 2>&1
    fi
    if [[ $count -eq 1 ]]; then
        echo "✓ logged"
    else
        echo "✓ $count items logged"
    fi
fi