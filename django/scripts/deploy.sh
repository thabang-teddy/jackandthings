#!/usr/bin/env bash
# Usage: DEPLOY_HOST=USER@HOST DEPLOY_URL=https://app.yourdomain.co.za scripts/deploy.sh
set -euo pipefail
: "${DEPLOY_HOST:?set DEPLOY_HOST=user@host}"
: "${DEPLOY_URL:?set DEPLOY_URL=https://app.yourdomain.co.za}"
TAG="r$(date +%Y%m%d-%H%M)"
VENV='~/virtualenv/jackandthings/3.11/bin/activate'

echo "1/6 checks";   ruff check . && pytest -q
echo "2/6 build";    npm --prefix frontend ci && npm --prefix frontend run build
mkdir -p "releases/$TAG" && cp -r static/dist "releases/$TAG/"        # keep for rollback
echo "3/6 tag";      git tag "$TAG" && git push origin HEAD --tags
echo "4/6 code";     ssh "$DEPLOY_HOST" "cd ~/jackandthings && git fetch --tags origin && git checkout -f $TAG"
echo "5/6 assets";   scp -rq static/dist "$DEPLOY_HOST:~/jackandthings/static/"
echo "6/6 migrate";  ssh "$DEPLOY_HOST" "source $VENV && cd ~/jackandthings && ~/bin/backup.sh \
                      && pip install -q -r requirements.txt && python manage.py migrate --noinput \
                      && python manage.py collectstatic --noinput && python manage.py check --deploy \
                      && touch tmp/restart.txt"
curl -fsS "$DEPLOY_URL/healthz/" && echo " — live: $TAG"
