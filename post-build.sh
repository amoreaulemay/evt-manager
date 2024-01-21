#!/usr/bin/env bash

for file in $(find ./dist -name "*.d.ts"); do
  grep -qxF "/// <reference no-default-lib=\"true\"/>" "$file" || { sed -i '' '1i\
/// <reference no-default-lib=\"true\"/>\
' "$file"; echo "" >> "$file"; }
  grep -qxF "/// <reference lib=\"dom\" />" "$file" || { sed -i '' '2i\
/// <reference lib=\"dom\" />\
' "$file"; echo "" >> "$file"; }
  grep -qxF "/// <reference lib=\"dom.iterable\" />" "$file" || { sed -i '' '3i\
/// <reference lib=\"dom.iterable\" />\
' "$file"; echo "" >> "$file"; }
  grep -qxF "/// <reference lib=\"esnext\" />" "$file" || { sed -i '' '4i\
/// <reference lib=\"esnext\" />\
' "$file"; echo "" >> "$file"; }
done

