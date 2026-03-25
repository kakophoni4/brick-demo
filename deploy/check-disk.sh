#!/usr/bin/env bash
# Запуск на сервере по SSH: bash deploy/check-disk.sh
# Или скопируйте команды ниже вручную.

set -e
echo "=== Файловые системы (df) ==="
df -hT

echo ""
echo "=== Топ папок в / (первый уровень, может занять время) ==="
du -xh --max-depth=1 / 2>/dev/null | sort -hr | head -20

echo ""
echo "=== Частые тяжёлые места ==="
for d in /var/lib/docker /var/log /home /var/www /root /usr /opt; do
  if [ -d "$d" ]; then
    echo "--- $d ---"
    du -sh "$d" 2>/dev/null || true
  fi
done

echo ""
echo "=== Docker (если установлен) ==="
if command -v docker >/dev/null 2>&1; then
  docker system df 2>/dev/null || true
else
  echo "docker не найден"
fi

echo ""
echo "=== Журналы systemd (размер на диске) ==="
journalctl --disk-usage 2>/dev/null || true
