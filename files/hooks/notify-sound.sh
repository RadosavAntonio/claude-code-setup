#!/bin/bash
[ -f "/tmp/claude-nosound" ] && exit 0
afplay "${1:-/System/Library/Sounds/Glass.aiff}" >/dev/null 2>&1
