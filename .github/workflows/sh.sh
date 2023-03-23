version="0.0.0-rc"
# if [[ ! $version =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([a-zA-Z0-9]+))?$ ]]; then
#   echo "Error: Version must have the format 'x.y.z' or 'x.y.z-<string>', where x, y, and z are numbers."
#   exit 1
# fi

if [[ ! $version =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-([a-zA-Z0-9_-]+))?$ ]]; then
  echo "Error: Version must have the format 'x.y.z' or 'x.y.z-<string>', where x, y, and z are numbers."
  exit 1
fi
