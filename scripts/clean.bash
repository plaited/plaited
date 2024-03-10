#!/bin/bash
if [ -z "${1}" ]
then
  declare -a dirs=("docs" "libs" "libs-storybook");

  ## now loop through the above array
  for i in "${dirs[@]}"
  do
    rm -rf node_modules $i/*/node_modules i/*/dist
  done
else
  rm -rf node_modules $1/*/node_modules $1/*/dist
fi