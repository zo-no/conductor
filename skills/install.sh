#!/usr/bin/env bash
# Install Conductor skills for Claude Code and Codex CLI
# Usage: bash skills/install.sh

set -e

SKILLS_DIR="$(cd "$(dirname "$0")" && pwd)"

install_skills() {
  local target_dir="$1"
  local agent_name="$2"
  local installed=0

  for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name="$(basename "$skill_dir")"
    [ -f "$skill_dir/SKILL.md" ] || continue

    dest="$target_dir/$skill_name"
    mkdir -p "$dest"
    cp "$skill_dir/SKILL.md" "$dest/SKILL.md"
    echo "  ✓ $skill_name"
    installed=$((installed + 1))
  done

  if [ "$installed" -eq 0 ]; then
    echo "  (no skills found)"
  fi
}

# Claude Code
CLAUDE_SKILLS="$HOME/.claude/skills"
if [ -d "$HOME/.claude" ]; then
  echo "Claude Code → $CLAUDE_SKILLS"
  mkdir -p "$CLAUDE_SKILLS"
  install_skills "$CLAUDE_SKILLS" "Claude Code"
else
  echo "Claude Code not detected (no ~/.claude), skipping"
fi

echo ""

# Codex CLI
CODEX_SKILLS="$HOME/.codex/skills"
if [ -d "$HOME/.codex" ]; then
  echo "Codex → $CODEX_SKILLS"
  mkdir -p "$CODEX_SKILLS"
  install_skills "$CODEX_SKILLS" "Codex"
else
  echo "Codex not detected (no ~/.codex), skipping"
fi

echo ""
echo "Done. Restart your agent to pick up the new skills."
echo "Then run /plan-project to set up your first project."
