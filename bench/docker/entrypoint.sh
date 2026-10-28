#!/bin/sh
# Each round starts from the same snapshot. The running user can write /tmp, not the mount.
if [ -f /seed/sqlite.db ]; then
	cp /seed/sqlite.db /tmp/sqlite.db
fi
exec "$@"
