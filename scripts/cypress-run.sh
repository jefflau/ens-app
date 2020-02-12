#!/bin/bash
# Only record cypress runs if $CYPRESS_TOKEN variable is set
set -e
if [ -z ${CYPRESS_TOKEN+x} ]; then
  yarn run cypress run "$@"
else
  yarn run cypress run "$@" --record --key $CYPRESS_TOKEN
fi
